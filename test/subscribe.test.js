// Run: TEST_DATABASE_URL=postgres://... npm test
// Uses a disposable database. Without TEST_DATABASE_URL the DB tests are skipped.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { Client } = require("pg");

const DB = process.env.TEST_DATABASE_URL;

function call(handler, { method = "POST", body, ip = "203.0.113.7" } = {}) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [raw] : []);
  req.method = method;
  req.headers = { "x-forwarded-for": ip, "content-type": "application/json" };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(data) { resolve({ status: this.statusCode, body: data ? JSON.parse(data) : null, headers: this.headers }); },
    };
    Promise.resolve(handler(req, res));
  });
}

function fresh(env) {
  for (const k of Object.keys(require.cache)) if (k.includes("/api/")) delete require.cache[k];
  for (const k of ["DATABASE_URL", "INSTAGRAM_URL"]) delete process.env[k];
  Object.assign(process.env, env);
  return { subscribe: require("../api/subscribe.js"), config: require("../api/config.js") };
}

test("not configured: no DATABASE_URL → 503, never success", async () => {
  const { subscribe, config } = fresh({});
  const r = await call(subscribe, { body: { email: "a@example.com" } });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "not_configured");
  const c = await call(config, { method: "GET" });
  assert.equal(c.body.subscribeEnabled, false);
  assert.equal(c.body.instagramUrl, null);
});

test("unreachable database → storage_error, never success", async () => {
  const { subscribe } = fresh({ DATABASE_URL: "postgres://nobody:x@127.0.0.1:1/none" });
  const r = await call(subscribe, { body: { email: "a@example.com" } });
  assert.equal(r.status, 502);
  assert.equal(r.body.code, "storage_error");
});

test("instagram url validation", async () => {
  let { config } = fresh({ INSTAGRAM_URL: "javascript:alert(1)" });
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, null);
  ({ config } = fresh({ INSTAGRAM_URL: "https://evil.example/instagram.com" }));
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, null);
  ({ config } = fresh({ INSTAGRAM_URL: "https://www.instagram.com/twt/" }));
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, "https://www.instagram.com/twt/");
});

const dbTest = DB ? test : test.skip;
let admin;

before(async () => {
  if (!DB) return;
  admin = new Client({ connectionString: DB });
  await admin.connect();
  await admin.query("DROP TABLE IF EXISTS twt_subscribers, twt_subscribe_attempts, other_app_users");
  // Stand-in for another app's data sharing the same database (I'M OK / POOL).
  await admin.query("CREATE TABLE other_app_users (id serial primary key, email text unique)");
  await admin.query("INSERT INTO other_app_users (email) VALUES ('keep@example.com')");
});

after(async () => {
  if (admin) await admin.end();
  for (const k of Object.keys(require.cache)) if (k.includes("/api/")) delete require.cache[k];
});

dbTest("subscribe → duplicate → validation → honeypot → rate limit", async () => {
  const { subscribe, config } = fresh({ DATABASE_URL: DB });

  assert.equal((await call(config, { method: "GET" })).body.subscribeEnabled, true);

  let r = await call(subscribe, { body: { email: "  Field.Notes@Example.com " }, ip: "198.51.100.1" });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "subscribed");

  r = await call(subscribe, { body: { email: "field.notes@example.com" }, ip: "198.51.100.2" });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "duplicate");

  r = await call(subscribe, { body: { email: "not-an-email" }, ip: "198.51.100.3" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "invalid_email");

  r = await call(subscribe, { body: { email: "bot@example.com", website: "x" }, ip: "198.51.100.4" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "invalid_request");

  r = await call(subscribe, { body: "{bad", ip: "198.51.100.5" });
  assert.equal(r.status, 400);

  r = await call(subscribe, { method: "GET" });
  assert.equal(r.status, 405);

  for (let i = 1; i <= 8; i++) {
    r = await call(subscribe, { body: { email: `r${i}@example.com` }, ip: "192.0.2.50" });
    assert.equal(r.status, 201, `attempt ${i}`);
  }
  r = await call(subscribe, { body: { email: "r9@example.com" }, ip: "192.0.2.50" });
  assert.equal(r.status, 429);

  const rows = (await admin.query("SELECT email, status FROM twt_subscribers ORDER BY id")).rows;
  assert.equal(rows.length, 9);
  assert.deepEqual(rows[0], { email: "field.notes@example.com", status: "subscribed" });
  assert.equal(rows.some((x) => x.email === "r9@example.com" || x.email === "bot@example.com"), false);

  // DB-level guarantees: unique email, lowercase only.
  await assert.rejects(admin.query("INSERT INTO twt_subscribers (email) VALUES ('field.notes@example.com')"), /twt_subscribers_email_key/);
  await assert.rejects(admin.query("INSERT INTO twt_subscribers (email) VALUES ('UPPER@example.com')"), /twt_subscribers_email_lower/);

  // Unsubscribed address can subscribe again.
  await admin.query("UPDATE twt_subscribers SET status = 'unsubscribed' WHERE email = 'r1@example.com'");
  r = await call(subscribe, { body: { email: "r1@example.com" }, ip: "198.51.100.9" });
  assert.equal(r.body.status, "subscribed");

  // IPs are stored only as hashes.
  const ips = (await admin.query("SELECT ip_hash FROM twt_subscribe_attempts")).rows.map((x) => x.ip_hash);
  assert.ok(ips.every((h) => /^[0-9a-f]{32}$/.test(h)));

  // Other application data untouched.
  const other = (await admin.query("SELECT email FROM other_app_users")).rows;
  assert.deepEqual(other, [{ email: "keep@example.com" }]);
});

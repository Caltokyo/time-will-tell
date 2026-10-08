// Run: TEST_DATABASE_URL=postgres://... npm test
// Uses a disposable database. Without TEST_DATABASE_URL the DB tests are skipped.
// Resend is never called for real: global fetch is replaced with a stub.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { Client } = require("pg");

const DB = process.env.TEST_DATABASE_URL;
const FAKE_KEY = "re_test_SECRET_should_never_leak";

// ---- Resend stub -------------------------------------------------------------
const sent = [];
let resendMode = "ok"; // ok | fail | invalid | network
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  if (!String(url).startsWith("https://api.resend.com/")) return realFetch(url, opts);
  assert.equal(opts.headers.Authorization, `Bearer ${FAKE_KEY}`);
  if (resendMode === "network") throw new TypeError("fetch failed");
  const body = JSON.parse(opts.body);
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  if (resendMode === "fail") return json(500, { statusCode: 500, name: "internal_server_error", message: "boom" });
  if (resendMode === "invalid") return json(422, { statusCode: 422, name: "validation_error", message: "Invalid `to` field. Please use our testing email address instead of domains like `example.com`." });
  sent.push(body);
  return json(200, { id: `email_${sent.length}` });
};

// ---- helpers -----------------------------------------------------------------
function call(handler, { method = "POST", body, ip = "203.0.113.7", url = "/api/subscribe", host = "twt.example" } = {}) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [raw] : []);
  req.method = method;
  req.url = url;
  req.headers = { "x-forwarded-for": ip, "content-type": "application/json", host };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(data) {
        const ct = this.headers["content-type"] || "";
        resolve({ status: this.statusCode, raw: data, body: ct.includes("json") && data ? JSON.parse(data) : null, headers: this.headers });
      },
    };
    Promise.resolve(handler(req, res));
  });
}

function fresh(env) {
  for (const k of Object.keys(require.cache)) if (k.includes("/api/")) delete require.cache[k];
  for (const k of ["DATABASE_URL", "INSTAGRAM_URL", "RESEND_API_KEY", "RESEND_FROM", "SITE_URL"]) delete process.env[k];
  Object.assign(process.env, env);
  return {
    subscribe: require("../api/subscribe.js"),
    config: require("../api/config.js"),
    unsubscribe: require("../api/unsubscribe.js"),
  };
}

// Capture console output to prove the key never appears in logs.
const logs = [];
for (const m of ["log", "error", "warn"]) {
  const orig = console[m];
  console[m] = (...a) => { logs.push(a.map(String).join(" ")); if (process.env.SHOW_LOGS) orig(...a); };
}

beforeEach(() => { resendMode = "ok"; });

// ---- tests without a database -------------------------------------------------
test("not configured: missing DATABASE_URL or RESEND_API_KEY → 503, never success", async () => {
  for (const env of [{}, { RESEND_API_KEY: FAKE_KEY }, { DATABASE_URL: "postgres://u@127.0.0.1:1/x" }]) {
    const { subscribe, config } = fresh(env);
    const r = await call(subscribe, { body: { email: "a@example.com" } });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, "not_configured");
    assert.equal((await call(config, { method: "GET" })).body.subscribeEnabled, false);
  }
});

test("unreachable database → storage_error, no email sent", async () => {
  const { subscribe } = fresh({ DATABASE_URL: "postgres://nobody:x@127.0.0.1:1/none", RESEND_API_KEY: FAKE_KEY });
  const before = sent.length;
  const r = await call(subscribe, { body: { email: "a@example.com" } });
  assert.equal(r.status, 502);
  assert.equal(r.body.code, "storage_error");
  assert.equal(sent.length, before);
});

test("instagram url validation", async () => {
  let { config } = fresh({ INSTAGRAM_URL: "javascript:alert(1)" });
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, null);
  ({ config } = fresh({ INSTAGRAM_URL: "https://evil.example/instagram.com" }));
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, null);
  ({ config } = fresh({ INSTAGRAM_URL: "https://www.instagram.com/twt/" }));
  assert.equal((await call(config, { method: "GET" })).body.instagramUrl, "https://www.instagram.com/twt/");
});

test("confirmation email content", () => {
  const { confirmationEmail } = require("../api/_email.js");
  const m = confirmationEmail({ email: "a<b>@example.com", unsubscribeUrl: "https://twt.example/api/unsubscribe?token=x", siteUrl: "https://twt.example/" });
  assert.match(m.subject, /Field Notes/);
  assert.match(m.text, /sent irregularly/);
  assert.match(m.text, /不定期/);
  assert.ok(!m.html.includes("a<b>"), "email address is HTML-escaped");
  assert.match(m.html, /Unsubscribe/);
});

// ---- database tests -----------------------------------------------------------
const dbTest = DB ? test : test.skip;
let admin;

before(async () => {
  if (!DB) return;
  admin = new Client({ connectionString: DB });
  await admin.connect();
  await admin.query("DROP TABLE IF EXISTS twt_subscribers, twt_subscribe_attempts, other_app_users");
  // Pre-migration table shape (as deployed before this change) to prove the upgrade path.
  await admin.query(`CREATE TABLE twt_subscribers (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'subscribed',
    source TEXT NOT NULL DEFAULT 'lp', subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT twt_subscribers_email_key UNIQUE (email),
    CONSTRAINT twt_subscribers_email_lower CHECK (email = lower(email)),
    CONSTRAINT twt_subscribers_status_check CHECK (status IN ('subscribed','unsubscribed')))`);
  await admin.query("INSERT INTO twt_subscribers (email) VALUES ('legacy@example.com')");
  // Stand-in for another app's data sharing the same database (I'M OK / POOL).
  await admin.query("CREATE TABLE other_app_users (id serial primary key, email text unique)");
  await admin.query("INSERT INTO other_app_users (email) VALUES ('keep@example.com')");
});

after(async () => {
  if (admin) await admin.end();
  for (const k of Object.keys(require.cache)) if (k.includes("/api/")) delete require.cache[k];
});

dbTest("subscribe flow with Resend: success, duplicate, failures, unsubscribe", async () => {
  const env = { DATABASE_URL: DB, RESEND_API_KEY: FAKE_KEY };
  const { subscribe, config, unsubscribe } = fresh(env);
  assert.equal((await call(config, { method: "GET" })).body.subscribeEnabled, true);
  const count = async () => Number((await admin.query("SELECT count(*) FROM twt_subscribers")).rows[0].count);

  // success → row stored + one email from utaki.me
  let r = await call(subscribe, { body: { email: "  Field.Notes@Example.com " }, ip: "198.51.100.1" });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "subscribed");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["field.notes@example.com"]);
  assert.match(sent[0].from, /@utaki\.me>$/);
  assert.match(sent[0].headers["List-Unsubscribe"], /^<https:\/\/twt\.example\/api\/unsubscribe\?token=[0-9a-f]{48}>$/);
  let row = (await admin.query("SELECT * FROM twt_subscribers WHERE email = 'field.notes@example.com'")).rows[0];
  assert.equal(row.status, "subscribed");
  assert.ok(row.confirmation_sent_at);
  assert.match(row.unsubscribe_token, /^[0-9a-f]{48}$/);

  // duplicate → no second email
  r = await call(subscribe, { body: { email: "FIELD.NOTES@example.com" }, ip: "198.51.100.2" });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "duplicate");
  assert.equal(sent.length, 1);

  // legacy row (created before this change) is treated as a duplicate too
  r = await call(subscribe, { body: { email: "legacy@example.com" }, ip: "198.51.100.2" });
  assert.equal(r.body.status, "duplicate");

  // invalid address (format) → 400, nothing sent
  r = await call(subscribe, { body: { email: "not-an-email" }, ip: "198.51.100.3" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "invalid_email");

  // Resend rejects recipient → invalid_email, row rolled back
  let n = await count();
  resendMode = "invalid";
  r = await call(subscribe, { body: { email: "rejected@example.com" }, ip: "198.51.100.4" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "invalid_email");
  assert.equal(await count(), n);

  // Resend 5xx / network failure → send_failed, row rolled back, can retry later
  for (const mode of ["fail", "network"]) {
    resendMode = mode;
    r = await call(subscribe, { body: { email: "retry@example.com" }, ip: "198.51.100.5" });
    assert.equal(r.status, 502);
    assert.equal(r.body.code, "send_failed");
    assert.equal(await count(), n);
  }
  resendMode = "ok";
  r = await call(subscribe, { body: { email: "retry@example.com" }, ip: "198.51.100.5" });
  assert.equal(r.body.status, "subscribed");

  // honeypot / bad JSON / wrong method
  r = await call(subscribe, { body: { email: "bot@example.com", website: "x" }, ip: "198.51.100.6" });
  assert.equal(r.body.code, "invalid_request");
  r = await call(subscribe, { body: "{bad", ip: "198.51.100.6" });
  assert.equal(r.status, 400);
  r = await call(subscribe, { method: "GET" });
  assert.equal(r.status, 405);

  // rate limit: 8 per IP per hour
  for (let i = 1; i <= 8; i++) {
    r = await call(subscribe, { body: { email: `r${i}@example.com` }, ip: "192.0.2.50" });
    assert.equal(r.status, 201, `attempt ${i}`);
  }
  r = await call(subscribe, { body: { email: "r9@example.com" }, ip: "192.0.2.50" });
  assert.equal(r.status, 429);

  // unsubscribe: GET shows a confirm page only; POST unsubscribes; then re-subscribe works
  const token = row.unsubscribe_token;
  r = await call(unsubscribe, { method: "GET", url: `/api/unsubscribe?token=${token}` });
  assert.equal(r.status, 200);
  assert.match(r.raw, /<form method="post"/);
  assert.equal((await admin.query("SELECT status FROM twt_subscribers WHERE unsubscribe_token = $1", [token])).rows[0].status, "subscribed");
  r = await call(unsubscribe, { method: "POST", url: `/api/unsubscribe?token=${token}` });
  assert.equal(r.status, 200);
  assert.match(r.raw, /UNSUBSCRIBED/);
  row = (await admin.query("SELECT status FROM twt_subscribers WHERE email = 'field.notes@example.com'")).rows[0];
  assert.equal(row.status, "unsubscribed");
  r = await call(unsubscribe, { method: "POST", url: "/api/unsubscribe?token=" + "0".repeat(48) });
  assert.equal(r.status, 404);
  r = await call(unsubscribe, { method: "GET", url: "/api/unsubscribe?token=<script>" });
  assert.equal(r.status, 400);
  r = await call(subscribe, { body: { email: "field.notes@example.com" }, ip: "198.51.100.8" });
  assert.equal(r.body.status, "subscribed");

  // the API key never appears in responses or logs
  assert.ok(!logs.some((l) => l.includes(FAKE_KEY)), "key not logged");

  // other application data untouched
  assert.deepEqual((await admin.query("SELECT email FROM other_app_users")).rows, [{ email: "keep@example.com" }]);
});

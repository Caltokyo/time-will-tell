// Staff browsers are not counted in Vercel Web Analytics (scripts/analytics-tag.js, api/staff.js, /staff/).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { TAG } = require("../scripts/analytics-tag.js");
const staff = require("../api/staff.js");
const ROOT = path.join(__dirname, "..");
const RAW = '<script defer src="/_vercel/insights/script.js"></script>';

function htmlFiles(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) htmlFiles(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

test("every counted page uses the staff-aware tag; none loads the analytics script directly", () => {
  const counted = [];
  for (const f of htmlFiles(ROOT)) {
    const s = fs.readFileSync(f, "utf8");
    const rel = path.relative(ROOT, f);
    assert.ok(!s.includes(RAW), `${rel}: loads /_vercel/insights/script.js without the staff check`);
    if (s.includes("_vercel/insights")) {
      assert.ok(s.includes(TAG), `${rel}: analytics tag differs from scripts/analytics-tag.js`);
      counted.push(rel);
    }
  }
  for (const must of ["index.html", "essays/index.html", "essays/01/index.html", "instagram/index.html", "log/land/so-we-decided-to-find-out/index.html"]) {
    assert.ok(counted.includes(must), `${must} is no longer counted`);
  }
  for (const never of ["dash/index.html", "staff/index.html", "fig006-map-preview.html"]) {
    assert.ok(!counted.includes(never), `${never} must not be counted`);
  }
});

// Run the tag's inline script against a fake browser and report whether the analytics script was requested.
function runTag({ cookie = "", storage = {}, storageThrows = false } = {}) {
  const appended = [];
  const document = {
    cookie,
    createElement: () => ({}),
    head: { appendChild: (el) => appended.push(el) },
  };
  const localStorage = {
    getItem: (k) => {
      if (storageThrows) throw new Error("SecurityError");
      return k in storage ? storage[k] : null;
    },
  };
  const window = {};
  const code = TAG.replace(/^<script>/, "").replace(/<\/script>$/, "");
  vm.runInNewContext(code, { window, document, localStorage });
  return { appended, window };
}

test("an ordinary visitor loads the analytics script (counted)", () => {
  const { appended, window } = runTag({ cookie: "other=1" });
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, "/_vercel/insights/script.js");
  assert.equal(typeof window.va, "function");
});

test("a staff browser never requests the analytics script (cookie or site storage)", () => {
  assert.equal(runTag({ cookie: "a=1; twt_staff=1" }).appended.length, 0);
  assert.equal(runTag({ cookie: "twt_staff=1" }).appended.length, 0);
  assert.equal(runTag({ storage: { twt_staff: "1" } }).appended.length, 0);
  // look-alikes do not count as staff
  assert.equal(runTag({ cookie: "xtwt_staff=1; twt_staff=10" }).appended.length, 1);
  // storage blocked (private mode): the cookie still decides
  assert.equal(runTag({ cookie: "twt_staff=1", storageThrows: true }).appended.length, 0);
  assert.equal(runTag({ storageThrows: true }).appended.length, 1);
});

function fakeRes() {
  return { statusCode: 0, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
}
const req = (body, headers = { origin: "https://utaki.me", host: "utaki.me" }, method = "POST") => ({ method, headers, body });
const CODE = "v1.mh0abc12.nonce-123456." + "A".repeat(43);

test("api/staff: only POST from this site", async () => {
  let res = fakeRes();
  await staff(req({ action: "clear" }, undefined, "GET"), res);
  assert.equal(res.statusCode, 405);
  res = fakeRes();
  await staff(req({ action: "clear" }, { origin: "https://evil.example", host: "utaki.me" }), res);
  assert.equal(res.statusCode, 403);
  res = fakeRes();
  await staff(req({ action: "clear" }, { host: "utaki.me" }), res);
  assert.equal(res.statusCode, 403);
});

test("api/staff: clear removes the mark", async () => {
  const res = fakeRes();
  await staff(req({ action: "clear" }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["set-cookie"], /^twt_staff=; Path=\/; Max-Age=0; Secure; SameSite=Lax$/);
});

test("api/staff: register needs a code that 6000 KNOCKS confirms", async () => {
  const calls = [];
  const answer = { status: 200, body: { ok: true } };
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: answer.status < 300, status: answer.status, json: async () => answer.body };
  };

  // no / malformed code: refused without asking
  let res = fakeRes();
  await staff(req({ action: "register" }), res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await staff(req({ action: "register", code: "guess" }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);

  // confirmed → staff cookie (400 days, first-party)
  res = fakeRes();
  await staff(req({ action: "register", code: CODE }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "staff");
  assert.match(res.headers["set-cookie"], /^twt_staff=1; Path=\/; Max-Age=34560000; Secure; SameSite=Lax$/);
  assert.deepEqual(calls[0], { url: "https://6000-knocks.vercel.app/api/twt-staff/redeem", body: { code: CODE } });

  // refused by 6000 KNOCKS → no cookie
  Object.assign(answer, { status: 400, body: { ok: false, reason: "EXPIRED" } });
  res = fakeRes();
  await staff(req({ action: "register", code: CODE }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers["set-cookie"], undefined);

  // 6000 KNOCKS unreachable → no cookie
  global.fetch = async () => { throw new Error("network"); };
  res = fakeRes();
  await staff(req({ action: "register", code: CODE }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.headers["set-cookie"], undefined);
});

test("/staff/ shows no settings to a visitor who is not staff and has no code", () => {
  const s = fs.readFileSync(path.join(ROOT, "staff/index.html"), "utf8");
  assert.match(s, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.match(s, /<section id="v-none">/); // the only section not hidden by default
  for (const id of ["v-busy", "v-staff", "v-cleared", "v-error"]) assert.match(s, new RegExp(`<section id="${id}" hidden>`));
});

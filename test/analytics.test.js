const test = require("node:test");
const assert = require("node:assert/strict");

const mod = require("../api/analytics.js");
const { jstMidnight, jstDate } = mod._internal;

function fakeRes() {
  return { statusCode: 0, headers: {}, body: "", setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
}

test("Japan-time day boundaries", () => {
  // 2026-10-24 09:30 JST = 00:30 UTC → day starts 2026-10-23 15:00 UTC
  const t = Date.parse("2026-10-24T00:30:00Z");
  assert.equal(new Date(jstMidnight(t)).toISOString(), "2026-10-23T15:00:00.000Z");
  assert.equal(jstDate(jstMidnight(t)), "2026-10-24");
  // 2026-10-24 23:59 JST is still the 24th
  assert.equal(jstDate(Date.parse("2026-10-24T14:59:00Z")), "2026-10-24");
});

test("analytics: not configured without a token", async () => {
  delete process.env.VERCEL_ANALYTICS_TOKEN;
  const res = fakeRes();
  await mod({ method: "GET" }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, "not_configured");
});

test("analytics: builds totals, 30 days, hours and breakdowns; token stays server-side", async () => {
  process.env.VERCEL_ANALYTICS_TOKEN = "test-token";
  const calls = [];
  global.fetch = async (url, opts) => {
    const u = new URL(url);
    calls.push({ by: u.searchParams.getAll("by"), auth: opts.headers.Authorization, since: u.searchParams.get("since") });
    const by = u.searchParams.get("by");
    const rows = {
      environment: [{ environment: "production", visitors: 1, pageviews: 9 }],
      hour: [{ timestamp: "2026-10-24T00:00:00.000Z", visitors: 1, pageviews: 9 }],
      requestPath: [{ requestPath: "/", visitors: 1, pageviews: 1 }],
      country: [{ country: "JP", visitors: 1, pageviews: 9 }],
      referrerHostname: [{ referrerHostname: "", visitors: 1, pageviews: 9 }],
    }[by];
    return { ok: true, json: async () => ({ data: rows }) };
  };
  const res = fakeRes();
  const realNow = Date.now;
  Date.now = () => Date.parse("2026-10-24T01:00:00Z");
  try { await mod({ method: "GET" }, res); } finally { Date.now = realNow; }
  assert.equal(res.statusCode, 200);
  const j = JSON.parse(res.body);
  assert.equal(j.today, "2026-10-24");
  assert.equal(j.daily.length, 30);
  assert.equal(j.daily[29].date, "2026-10-24");
  assert.equal(j.daily[0].date, "2026-09-25");
  assert.equal(j.hourly[9].pageviews, 9); // 00:00 UTC = 09:00 JST
  assert.deepEqual(j.totals.today, { visitors: 1, pageviews: 9 });
  assert.equal(j.breakdown.today.countries[0].name, "JP");
  assert.ok(calls.every((c) => c.auth === "Bearer test-token"));
  assert.ok(!res.body.includes("test-token"));
  assert.match(res.headers["cache-control"], /s-maxage=600/);
  // the hourly query never exceeds the API's 168-hour cap
  assert.ok(calls.filter((c) => c.by[0] === "hour").length === 1);
});

test("analytics: upstream failure is a 502 without details", async () => {
  process.env.VERCEL_ANALYTICS_TOKEN = "test-token";
  global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { code: "forbidden" } }) });
  const res = fakeRes();
  const err = console.error; console.error = () => {};
  try { await mod({ method: "GET" }, res); } finally { console.error = err; }
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).code, "upstream_error");
});

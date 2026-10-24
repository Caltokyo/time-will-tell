// GET /api/analytics — public site statistics for /dash/, read from Vercel Web Analytics.
//
// Needs VERCEL_ANALYTICS_TOKEN (a Vercel access token for the Cal team). The token is used only
// in the server-side Authorization header and is never sent to the browser or logged.
// All days are Japan time (Asia/Tokyo). Hobby keeps about 30 days of data.

// Same response shape as send() in _lib.js, kept local so this endpoint doesn't load the DB driver.
function send(res, status, body, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

const API = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const PROJECT_ID = "prj_Ntov0w2nnamYr2272QVNkaRQtVj0";
const TEAM_ID = "team_ofPmxhVnepwLF8cFsWZPIWju";
const DAYS = 30;
const JST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function token() {
  return (process.env.VERCEL_ANALYTICS_TOKEN || "").trim() || null;
}

// Midnight (Japan time) of the day containing `ms`, as a UTC timestamp.
function jstMidnight(ms) {
  return Math.floor((ms + JST) / DAY) * DAY - JST;
}

function jstDate(ms) {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

async function aggregate(by, since, until, limit = 10) {
  const q = new URLSearchParams({
    projectId: PROJECT_ID,
    teamId: TEAM_ID,
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    limit: String(limit),
  });
  for (const b of [].concat(by)) q.append("by", b);
  const r = await fetch(`${API}?${q}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = new Error("upstream_error");
    err.status = r.status;
    err.code = (body.error && body.error.code) || "upstream_error";
    throw err;
  }
  const body = await r.json();
  return Array.isArray(body.data) ? body.data : [];
}

// Unique visitors and page views for one window ("environment" yields a single production row).
async function total(since, until) {
  const rows = await aggregate("environment", since, until, 1);
  const row = rows[0] || {};
  return { visitors: row.visitors || 0, pageviews: row.pageviews || 0 };
}

const pick = (key) => (rows) =>
  rows.map((r) => ({ name: r[key] == null ? "" : String(r[key]), visitors: r.visitors || 0, pageviews: r.pageviews || 0 }));

// Run tasks with a small concurrency cap so a cold cache doesn't fan out 40 requests at once.
async function pool(tasks, size = 6) {
  const out = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < tasks.length) { const n = i++; out[n] = await tasks[n](); }
  }));
  return out;
}

async function breakdown(since, until) {
  const [pages, countries, referrers] = await Promise.all([
    aggregate("requestPath", since, until, 20).then(pick("requestPath")),
    aggregate("country", since, until, 20).then(pick("country")),
    aggregate("referrerHostname", since, until, 20).then(pick("referrerHostname")),
  ]);
  return { pages, countries, referrers };
}

async function build(now) {
  const today = jstMidnight(now);
  const tomorrow = today + DAY;
  const days = Array.from({ length: DAYS }, (_, k) => today - (DAYS - 1 - k) * DAY);

  const [daily, totals, hourlyRows, todayBreakdown, monthBreakdown] = await Promise.all([
    pool(days.map((d) => () => total(d, d + DAY).then((t) => ({ date: jstDate(d), ...t })))),
    Promise.all([total(today, tomorrow), total(today - 6 * DAY, tomorrow), total(days[0], tomorrow)]),
    aggregate("hour", today, tomorrow, 24),
    breakdown(today, tomorrow),
    breakdown(days[0], tomorrow),
  ]);

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, visitors: 0, pageviews: 0 }));
  for (const r of hourlyRows) {
    const h = Math.floor((Date.parse(r.timestamp) - today) / (60 * 60 * 1000));
    if (h >= 0 && h < 24) hourly[h] = { hour: h, visitors: r.visitors || 0, pageviews: r.pageviews || 0 };
  }

  return {
    generatedAt: new Date(now).toISOString(),
    timezone: "Asia/Tokyo",
    today: jstDate(today),
    totals: { today: totals[0], last7: totals[1], last30: totals[2] },
    daily,
    hourly,
    breakdown: { today: todayBreakdown, last30: monthBreakdown },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  if (!token()) return send(res, 503, { status: "error", code: "not_configured" }, "no-store");
  try {
    const data = await build(Date.now());
    // Cached at the edge for 10 minutes; a stale copy is served while it refreshes.
    return send(res, 200, data, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (err) {
    console.error("analytics failed", err.code || err.message, err.status || "");
    return send(res, 502, { status: "error", code: "upstream_error" }, "no-store");
  }
};

module.exports._internal = { jstMidnight, jstDate, build };

// POST /api/staff — mark THIS browser as TWT staff (its visits are not sent to Vercel Web Analytics), or undo it.
//
//   { "action": "register", "code": "<code>" }  The code comes from 6000 KNOCKS: only a signed-in, active member can
//        get one (https://6000-knocks.vercel.app/api/twt-staff/link → /staff/#c=<code>). It is valid for 5 minutes and
//        is checked by 6000 KNOCKS itself (server to server), so knowing the /staff/ URL is not enough.
//        On success: first-party cookie `twt_staff=1` for 400 days (the browser maximum).
//   { "action": "clear" }  Remove the staff mark from this browser (no login needed — it is the visitor's own browser).
//
// The analytics tag on every page (scripts/analytics-tag.js) checks the mark before loading the analytics script.
// Nothing is stored on the server; past analytics data is not touched.

const KNOCKS_ORIGIN = "https://6000-knocks.vercel.app";
const COOKIE = "twt_staff";
const MAX_AGE = 400 * 24 * 60 * 60;

// Same response shape as send() in _lib.js, kept local so this endpoint doesn't load the DB driver.
function send(res, status, body, cookie) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2048) throw new Error("body_too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

// Only this site's own pages may call it (the browser always sends Origin on a POST).
function sameOrigin(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

const staffCookie = () => `${COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`;
const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;

// Ask 6000 KNOCKS whether it issued this code to a signed-in member in the last 5 minutes.
async function redeem(code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${KNOCKS_ORIGIN}/api/twt-staff/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: ctrl.signal,
    });
    const body = await r.json().catch(() => ({}));
    return r.ok && body && body.ok === true ? "ok" : r.status >= 500 ? "unavailable" : "refused";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  if (!sameOrigin(req)) return send(res, 403, { status: "error", code: "forbidden" });
  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { status: "error", code: "invalid_request" });
  }
  const action = body && body.action;
  if (action === "clear") return send(res, 200, { status: "cleared" }, clearCookie());
  if (action !== "register") return send(res, 400, { status: "error", code: "invalid_request" });

  const code = typeof body.code === "string" ? body.code : "";
  if (!/^v1\.[0-9a-z]{1,12}\.[A-Za-z0-9_-]{8,32}\.[A-Za-z0-9_-]{43}$/.test(code)) {
    return send(res, 400, { status: "error", code: "invalid_code" });
  }
  const r = await redeem(code);
  if (r === "ok") return send(res, 200, { status: "staff" }, staffCookie());
  if (r === "unavailable") return send(res, 502, { status: "error", code: "verify_unavailable" });
  return send(res, 403, { status: "error", code: "invalid_code" });
};

module.exports._internal = { sameOrigin, staffCookie, clearCookie, KNOCKS_ORIGIN };

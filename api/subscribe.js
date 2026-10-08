// POST /api/subscribe  { email, website? }
// Stores Field Notes subscribers in Upstash Redis. Never reports success
// unless the address was actually written.

const { redisConfig, redis, send, readJson, clientIpHash } = require("./_lib");

const SET_KEY = "twt:field-notes:subscribers";
const RECORD_PREFIX = "twt:field-notes:subscriber:";
const RATE_LIMIT = 8; // attempts per IP per hour
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  if (!redisConfig()) {
    return send(res, 503, { status: "error", code: "not_configured" });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { status: "error", code: "invalid_request" });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (body.website) return send(res, 400, { status: "error", code: "invalid_request" });

  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return send(res, 400, { status: "error", code: "invalid_email" });
  }

  try {
    const rateKey = `twt:rate:subscribe:${clientIpHash(req)}`;
    const [count] = await redis([["INCR", rateKey]]);
    if (count === 1) await redis([["EXPIRE", rateKey, 3600]]);
    if (count > RATE_LIMIT) return send(res, 429, { status: "error", code: "rate_limited" });

    const [added] = await redis([["SADD", SET_KEY, email]]);
    if (added === 0) return send(res, 200, { status: "duplicate" });

    await redis([["HSET", RECORD_PREFIX + email, "email", email, "subscribed_at", new Date().toISOString(), "source", "lp"]]);
    return send(res, 201, { status: "subscribed" });
  } catch (err) {
    console.error("subscribe failed:", err.message);
    return send(res, 502, { status: "error", code: "storage_error" });
  }
};

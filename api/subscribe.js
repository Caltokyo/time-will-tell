// POST /api/subscribe  { email, website? }
// Stores Field Notes subscribers in Neon PostgreSQL (table twt_subscribers).
// Never reports success unless the row was actually written.

const { databaseUrl, query, send, readJson, clientIpHash } = require("./_lib");

const RATE_LIMIT = 8; // attempts per IP per hour
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

const RATE_SQL = `
  INSERT INTO twt_subscribe_attempts AS a (ip_hash, window_start, attempts)
  VALUES ($1, now(), 1)
  ON CONFLICT (ip_hash) DO UPDATE SET
    attempts     = CASE WHEN a.window_start < now() - interval '1 hour' THEN 1 ELSE a.attempts + 1 END,
    window_start = CASE WHEN a.window_start < now() - interval '1 hour' THEN now() ELSE a.window_start END
  RETURNING attempts`;

// New address → inserted. Previously unsubscribed → reactivated. Already subscribed → no row.
const SUBSCRIBE_SQL = `
  INSERT INTO twt_subscribers AS s (email, status, source)
  VALUES ($1, 'subscribed', 'lp')
  ON CONFLICT (email) DO UPDATE SET status = 'subscribed', updated_at = now()
    WHERE s.status <> 'subscribed'
  RETURNING id`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  if (!databaseUrl()) {
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
    const rate = await query(RATE_SQL, [clientIpHash(req)]);
    if (rate.rows[0].attempts > RATE_LIMIT) return send(res, 429, { status: "error", code: "rate_limited" });

    const result = await query(SUBSCRIBE_SQL, [email]);
    if (result.rowCount === 0) return send(res, 200, { status: "duplicate" });
    return send(res, 201, { status: "subscribed" });
  } catch (err) {
    console.error("subscribe failed:", err.code || err.message);
    return send(res, 502, { status: "error", code: "storage_error" });
  }
};

// POST /api/subscribe  { email, website? }
// Stores Field Notes subscribers in Neon PostgreSQL (table twt_subscribers) and sends
// a confirmation email via Resend. The row is committed only if the email was accepted
// by Resend, so success is never shown for an address that did not receive it.

const crypto = require("crypto");
const { databaseUrl, query, transaction, siteOrigin, send, readJson, clientIpHash } = require("./_lib");
const { resendKey, sendConfirmation } = require("./_email");

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
  INSERT INTO twt_subscribers AS s (email, status, source, unsubscribe_token)
  VALUES ($1, 'subscribed', 'lp', $2)
  ON CONFLICT (email) DO UPDATE
    SET status = 'subscribed', updated_at = now(), unsubscribe_token = EXCLUDED.unsubscribe_token
    WHERE s.status <> 'subscribed'
  RETURNING id`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  if (!databaseUrl() || !resendKey()) {
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

  const origin = siteOrigin(req);
  if (!origin) return send(res, 400, { status: "error", code: "invalid_request" });

  try {
    const rate = await query(RATE_SQL, [clientIpHash(req)]);
    if (rate.rows[0].attempts > RATE_LIMIT) return send(res, 429, { status: "error", code: "rate_limited" });

    const token = crypto.randomBytes(24).toString("hex");
    const outcome = await transaction(async (client) => {
      const r = await client.query(SUBSCRIBE_SQL, [email, token]);
      if (r.rowCount === 0) return "duplicate";
      // Throws on failure → transaction rolls back → nothing is stored.
      await sendConfirmation({
        email,
        siteUrl: origin + "/",
        unsubscribeUrl: `${origin}/api/unsubscribe?token=${token}`,
      });
      await client.query("UPDATE twt_subscribers SET confirmation_sent_at = now() WHERE id = $1", [r.rows[0].id]);
      return "subscribed";
    });

    if (outcome === "duplicate") return send(res, 200, { status: "duplicate" });
    return send(res, 201, { status: "subscribed" });
  } catch (err) {
    if (err.code === "invalid_email") return send(res, 400, { status: "error", code: "invalid_email" });
    if (err.code === "send_failed") {
      console.error("subscribe: confirmation email failed, status", err.status);
      return send(res, 502, { status: "error", code: "send_failed" });
    }
    console.error("subscribe: storage error", err.code || err.name);
    return send(res, 502, { status: "error", code: "storage_error" });
  }
};

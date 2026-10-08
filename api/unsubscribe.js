// GET  /api/unsubscribe?token=…  → confirmation page with a button (link scanners don't unsubscribe).
// POST /api/unsubscribe?token=…  → unsubscribes (also used by one-click List-Unsubscribe).

const { databaseUrl, query } = require("./_lib");

const TOKEN_RE = /^[0-9a-f]{48}$/;

function page(res, status, title, en, ja, formToken) {
  const form = formToken
    ? `<form method="post" action="/api/unsubscribe?token=${formToken}"><button type="submit">UNSUBSCRIBE / 配信停止</button></form>`
    : `<p><a href="/">TIME WILL TELL →</a></p>`;
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — TIME WILL TELL</title><meta name="robots" content="noindex">
<style>
body{margin:0;background:#f1eee6;color:#111110;font-family:"Helvetica Neue",Arial,sans-serif;}
main{max-width:560px;margin:0 auto;padding:72px 16px;border-top:2px solid #111110;}
.k{font:11px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.08em;color:#4a4843}
h1{font-weight:900;font-size:44px;line-height:.95;margin:28px 0 24px}
p{font:19px/1.45 Georgia,serif;margin:0 0 10px}.ja{font:12px/1.8 "Hiragino Sans","Noto Sans JP",sans-serif;color:#4a4843;margin-bottom:28px}
button{border:0;background:#111110;color:#f1eee6;padding:16px 22px;font-weight:800;letter-spacing:.08em;cursor:pointer}
a{color:#111110}
</style></head><body><main><div class="k">FIELD NOTES — 001 / 100</div><h1>${title}</h1><p>${en}</p><p class="ja">${ja}</p>${form}</main></body></html>`);
}

module.exports = async function handler(req, res) {
  const token = String(new URL(req.url, "http://x").searchParams.get("token") || "");
  if (!TOKEN_RE.test(token)) {
    return page(res, 400, "INVALID LINK.", "This unsubscribe link is not valid.", "この配信停止リンクは無効です。");
  }
  if (!databaseUrl()) {
    return page(res, 503, "UNAVAILABLE.", "Please try again later.", "時間をおいて再度お試しください。");
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return page(res, 200, "UNSUBSCRIBE?", "Stop receiving Field Notes at this address.", "このアドレスへのField Notesの配信を停止します。", token);
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return page(res, 405, "NOT ALLOWED.", "", "");
  }

  try {
    const r = await query(
      "UPDATE twt_subscribers SET status = 'unsubscribed', updated_at = now() WHERE unsubscribe_token = $1 RETURNING id",
      [token]
    );
    if (r.rowCount === 0) {
      return page(res, 404, "INVALID LINK.", "This unsubscribe link is not valid.", "この配信停止リンクは無効です。");
    }
    return page(res, 200, "UNSUBSCRIBED.", "You will no longer receive Field Notes.", "Field Notesの配信を停止しました。");
  } catch (err) {
    console.error("unsubscribe: storage error", err.code || err.name);
    return page(res, 502, "ERROR.", "Please try again later.", "時間をおいて再度お試しください。");
  }
};

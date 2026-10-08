// Field Notes confirmation email, sent through Resend from utaki.me.
// RESEND_API_KEY is only ever placed in the Authorization header; it is never logged or returned.

const DEFAULT_FROM = "TIME WILL TELL <field-notes@utaki.me>";

function resendKey() {
  const k = (process.env.RESEND_API_KEY || "").trim();
  return k || null;
}

function fromAddress() {
  const f = (process.env.RESEND_FROM || "").trim();
  return /@utaki\.me>?$/i.test(f) ? f : DEFAULT_FROM;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function confirmationEmail({ email, unsubscribeUrl, siteUrl }) {
  const subject = "Field Notes — registered | TIME WILL TELL";
  const text = [
    "TIME WILL TELL",
    "FIELD NOTES — REGISTERED",
    "",
    `Your address (${email}) has been recorded.`,
    "Field Notes are sent irregularly — only when there is something to record.",
    "",
    "Field Notesへの登録が完了しました。",
    "配信は不定期です。記録すべきことがあるときだけお送りします。",
    "",
    "JAPAN / OKINAWA / MIYAKOJIMA — 001 / 100",
    siteUrl,
    "",
    "If you did not sign up, or no longer wish to receive Field Notes, unsubscribe here:",
    "心当たりがない場合、または配信停止はこちら：",
    unsubscribeUrl,
  ].join("\n");

  const mono = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
  const sans = "'Helvetica Neue',Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1eee6;color:#111110;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eee6;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-top:2px solid #111110;">
<tr><td style="padding:16px 0 0;font-family:${mono};font-size:11px;letter-spacing:.08em;color:#4a4843;">FIELD NOTES — 001 / 100</td></tr>
<tr><td style="padding:28px 0 0;font-family:${sans};font-weight:900;font-size:40px;line-height:.95;letter-spacing:-.01em;">TIME<br>WILL<br>TELL.</td></tr>
<tr><td style="padding:32px 0 0;font-family:${sans};font-weight:800;font-size:18px;letter-spacing:.06em;">REGISTERED.</td></tr>
<tr><td style="padding:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.45;">
Your address <span style="font-family:${mono};font-size:15px;">${esc(email)}</span> has been recorded.<br>
Field Notes are sent irregularly — only when there is something to record.</td></tr>
<tr><td style="padding:14px 0 0;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;font-size:12px;line-height:1.8;color:#4a4843;">
Field Notesへの登録が完了しました。<br>配信は不定期です。記録すべきことがあるときだけお送りします。</td></tr>
<tr><td style="padding:32px 0 0;"><div style="border-top:1px solid #c9c5bb;"></div></td></tr>
<tr><td style="padding:14px 0 0;font-family:${mono};font-size:11px;letter-spacing:.06em;color:#4a4843;">
JAPAN / OKINAWA / MIYAKOJIMA<br><a href="${esc(siteUrl)}" style="color:#111110;">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
<tr><td style="padding:28px 0 0;font-family:${mono};font-size:10.5px;line-height:1.7;color:#8b877c;">
If you did not sign up, or no longer wish to receive Field Notes:<br>
心当たりがない場合、または配信停止はこちら：<br>
<a href="${esc(unsubscribeUrl)}" style="color:#4a4843;">Unsubscribe / 配信停止</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

class SendError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

// Returns the Resend email id. Throws SendError("invalid_email" | "send_failed").
async function sendConfirmation({ email, unsubscribeUrl, siteUrl }) {
  const key = resendKey();
  if (!key) throw new SendError("send_failed", 0);
  const { subject, text, html } = confirmationEmail({ email, unsubscribeUrl, siteUrl });

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [email],
        subject,
        text,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SendError("send_failed", 0);
  }

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.id) return data.id;
  // 422 validation errors on the recipient mean the address itself is unusable.
  if (res.status === 422 && data.name === "validation_error" && /`to`|invalid.*(email|recipient)/i.test(String(data.message || ""))) {
    throw new SendError("invalid_email", res.status);
  }
  throw new SendError("send_failed", res.status);
}

module.exports = { resendKey, sendConfirmation, confirmationEmail, SendError };

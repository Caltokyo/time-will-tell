# TIME WILL TELL — Landing Page

Japan / Okinawa / Miyakojima. 001 / 100.

Static site (HTML / CSS / JavaScript) plus two Vercel serverless functions in `api/`. No build step.

## Run locally

```bash
python3 -m http.server 8000
# or
npx serve .
```

## Files

- `index.html` — all copy and section structure (12 sections, English primary / Japanese secondary)
- `styles.css` — design tokens on `:root`; Japanese size ratio is `--ja` (body) and `--ja-head` (display headings)
- `main.js` — generated survey drawings (FIG. 001, 006, 09.7), quiet reveal, section 05 strike-through
- `assets/fonts/` — self-hosted Archivo (SIL Open Font License). Instrument Serif, JetBrains Mono and Noto Sans JP load from Google Fonts.

## To replace

- `index.html` → "FOLLOW THE PROJECT" link `href="#"` (marked with a TODO comment).
- Section 09 fragments are drawn placeholders. Swap any `<svg>` inside a `.frag` for an `<img>` once real drawings / model / material / site photos are ready.

## Deploy

Vercel / Netlify / GitHub Pages: publish the repository root, no build command.

## FOLLOW THE PROJECT (section 13)

- `api/subscribe.js` — `POST /api/subscribe`. Validates the address, rate-limits per IP (hashed), stores it in Upstash Redis.
  - Set `twt:field-notes:subscribers` holds every address; `twt:field-notes:subscriber:<email>` holds `subscribed_at` and `source`.
  - Responses: `subscribed` (201), `duplicate` (200), `invalid_email` (400), `rate_limited` (429), `not_configured` (503), `storage_error` (502).
- `api/config.js` — `GET /api/config` returns `{ subscribeEnabled, instagramUrl }` (no secrets).
- When storage env vars are missing, the form is disabled and says registration is not open — it never shows a fake success.
- When `INSTAGRAM_URL` is missing or not an `https://instagram.com/...` URL, the Instagram button stays disabled with no link.

Environment variables: see `.env.example`. Subscriber data lives only in the Redis database, never in this repository.

Export subscribers (Upstash console → Data Browser, or CLI): `SMEMBERS twt:field-notes:subscribers`.

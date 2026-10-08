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

- `api/subscribe.js` — `POST /api/subscribe`. Validates the address, rate-limits per IP (8/hour, IP stored only as a SHA-256 hash), stores it in Neon PostgreSQL.
  - Responses: `subscribed` (201), `duplicate` (200), `invalid_email` (400), `rate_limited` (429), `not_configured` (503), `storage_error` (502).
- `api/config.js` — `GET /api/config` returns `{ subscribeEnabled, instagramUrl }` (no secrets).
- Without `DATABASE_URL` the form is disabled and says registration is not open. If the database cannot be reached the visitor sees an error. Success is shown only after the row is written.
- Without a valid `INSTAGRAM_URL` (`https://instagram.com/...`) the Instagram button stays disabled with no link.

### Database

`db/schema.sql` creates two tables (and nothing else):

| table | purpose |
| --- | --- |
| `twt_subscribers` | `email` (unique, lowercase), `status` (`subscribed` / `unsubscribed`), `source`, `subscribed_at`, `updated_at` |
| `twt_subscribe_attempts` | per-IP-hash attempt counter for rate limiting |

The function runs this schema automatically (`CREATE TABLE IF NOT EXISTS`) on first use. You can also run it yourself in the Neon SQL Editor.

List subscribers (Neon SQL Editor):

```sql
SELECT email, subscribed_at FROM twt_subscribers WHERE status = 'subscribed' ORDER BY subscribed_at;
```

Environment variables: see `.env.example`. Subscriber data lives only in the database, never in this repository.

### Tests

```bash
npm install
TEST_DATABASE_URL=postgres://user@localhost:5432/scratch_db npm test   # use a disposable database
```

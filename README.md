# TIME WILL TELL — Landing Page

Japan / Okinawa / Miyakojima. 001 / 100.

Static site (HTML / CSS / JavaScript). No build step.

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

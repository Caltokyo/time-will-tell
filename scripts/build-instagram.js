#!/usr/bin/env node
// Builds /instagram/ — the Instagram index linked from the @twt_project profile.
//
//   content/instagram/posts.json  one entry per post (see its "note")
//   assets/instagram/<file>       the post images, kept in the repository
//
// Each tile opens the place on the LP that matches the post. Every target is checked
// against the built site: an anchor must exist in index.html, a page must exist on disk.
// Posts without an image show their text on a plain tile marked IMAGE PENDING — the
// image is never invented. No Instagram API is used.
//
// `node scripts/build-instagram.js --check` writes nothing and fails if the page is stale.

const { TAG } = require("./analytics-tag.js");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "content", "instagram", "posts.json");
const OUT = path.join(ROOT, "instagram", "index.html");
const SITE = "https://utaki.me";
const CHECK = process.argv.includes("--check");

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const lp = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

function checkHref(where, href) {
  const m = /^\/(?:([a-z0-9/_-]+\/))?(?:#([A-Za-z][\w-]*))?$/.exec(href || "");
  if (!m) throw new Error(`${where}: "${href}" must be a site path like /#id or /essays/01/`);
  const [, dir, id] = m;
  const file = path.join(ROOT, dir || "", "index.html");
  if (!fs.existsSync(file)) throw new Error(`${where}: ${href} — no page at ${path.relative(ROOT, file)}`);
  if (id && !(dir ? fs.readFileSync(file, "utf8") : lp).includes(`id="${id}"`)) throw new Error(`${where}: ${href} — no element with id="${id}"`);
}

const posts = data.posts
  .filter((p) => {
    if (!["published", "review"].includes(p.status)) throw new Error(`instagram ${p.id}: status must be published or review`);
    return p.status === "published";
  })
  .sort((a, b) => a.order - b.order);

const ids = new Set();
for (const p of posts) {
  const where = `instagram ${p.id}`;
  if (ids.has(p.id)) throw new Error(`${where}: duplicate id`);
  ids.add(p.id);
  if (!p.target) throw new Error(`${where}: published posts need a target (use status "review" until one is confirmed)`);
  checkHref(where, p.target.href);
  if (p.related) checkHref(`${where} related`, p.related.href);
  if (p.image && !fs.existsSync(path.join(ROOT, "assets", "instagram", p.image))) throw new Error(`${where}: assets/instagram/${p.image} not found`);
  if (p.image && !p.alt) throw new Error(`${where}: an image needs "alt" text`);
  if (p.image && !(p.width > 0 && p.height > 0)) throw new Error(`${where}: an image needs its pixel "width" and "height"`);
  if (p.instagramUrl && !/^https:\/\/www\.instagram\.com\/(p|reel)\/[\w-]+\/$/.test(p.instagramUrl)) throw new Error(`${where}: instagramUrl must be https://www.instagram.com/p/…/`);
}

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10" /></svg>';

function tile(p, i) {
  const no = `IG ${pad(i + 1)}`;
  const plate = p.image
    ? `<img src="/assets/instagram/${esc(p.image)}" alt="${esc(p.alt)}" width="${p.width}" height="${p.height}" loading="${i < 6 ? "eager" : "lazy"}" decoding="async" />`
    : `<span class="ig-pending" aria-hidden="true"><span class="ig-pending-title">${esc(p.title)}</span><span class="ig-pending-mark mono">IMAGE PENDING</span></span>`;
  const extra = [
    p.related ? `<a class="ig-sub" href="${esc(p.related.href)}">${esc(p.related.label)}</a>` : "",
    p.instagramUrl ? `<a class="ig-sub ig-sub--out" href="${esc(p.instagramUrl)}" target="_blank" rel="noopener noreferrer">VIEW ON INSTAGRAM ↗</a>` : "",
  ].filter(Boolean);
  return `      <li class="ig-item" id="ig-${esc(p.id)}">
        <a class="ig-link" href="${esc(p.target.href)}" aria-label="${esc(`${no}: ${p.title} — open ${p.target.section}: ${p.target.label}`)}">
          <span class="ig-plate${p.image ? " ig-plate--img" : ""}">${plate}</span>
          <span class="ig-meta mono"><span class="ig-no">${no}</span><span class="ig-to">→ ${esc(p.target.section)}</span></span>
          <span class="ig-target">${esc(p.target.label)}</span>
        </a>${extra.length ? `\n        <span class="ig-extra">${extra.join("")}</span>` : ""}
      </li>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FIELD RECORDS — Instagram — TIME WILL TELL.</title>
  <meta name="description" content="Images and fragments from the field, on Instagram. Each post opens its place in TIME WILL TELL." />
  <meta name="theme-color" content="#f1eee6" />
  <meta property="og:title" content="FIELD RECORDS — TIME WILL TELL." />
  <meta property="og:description" content="Images and fragments from the field, on Instagram. Each post opens its place in TIME WILL TELL." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}/instagram/" />
  <link rel="canonical" href="${SITE}/instagram/" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="apple-mobile-web-app-title" content="UTAKI" />
  <meta name="application-name" content="UTAKI" />
  ${TAG}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="preload" href="/assets/fonts/archivo-latin-var.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/instagram/instagram.css" />
</head>
<body>
  <!-- Generated by npm run build:instagram from content/instagram/posts.json — do not edit by hand. -->
  <div class="paper" aria-hidden="true"></div>

  <header class="bar">
    <a href="/" class="bar-mark">TWT</a>
    <span class="bar-mid mono">JAPAN / OKINAWA / MIYAKOJIMA</span>
    <a href="${esc(data.profile)}" class="bar-link mono" target="_blank" rel="noopener noreferrer">@twt_project ↗</a>
  </header>

  <main class="ig">
    <header class="ig-head">
      <p class="ig-kicker mono"><span>B — FIELD RECORDS</span><span>@twt_project</span></p>
      <h1 class="ig-title">FIELD RECORDS</h1>
      <div class="pair ig-lead">
        <p>Images and fragments from the field, on Instagram.</p>
        <p class="ja">現地からの写真と記録の断片を、Instagramで。</p>
      </div>
      <p class="ig-how mono">SELECT A POST TO OPEN ITS PLACE IN THE RECORD <span lang="ja">投稿を選ぶと、該当する箇所へ移動します</span></p>
    </header>

    <ol class="ig-grid" aria-label="Instagram posts">
${posts.map(tile).join("\n")}
    </ol>

    <footer class="ig-foot">
      <a class="ig-button ig-out" href="${esc(data.profile)}" target="_blank" rel="noopener noreferrer">
        <span class="pair"><span class="follow-en">FOLLOW ON INSTAGRAM</span><span class="ja">@twt_project — Instagram でフォロー</span></span>
        ${ARROW}
      </a>
      <a class="ig-back mono" href="/">TIME WILL TELL. — utaki.me</a>
    </footer>
  </main>
</body>
</html>
`;

const stale = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== html;
if (CHECK) {
  if (stale) { console.error("stale: instagram/index.html\nRun: npm run build:instagram"); process.exit(1); }
  console.log("instagram page is up to date");
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  posts.forEach((p, i) => console.log(`IG ${pad(i + 1)} ${p.title} → ${p.target.href}${p.image ? "" : "  (image pending)"}`));
}

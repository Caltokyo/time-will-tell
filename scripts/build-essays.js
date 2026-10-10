#!/usr/bin/env node
// Generates essays/01/index.html … essays/06/index.html from content/essays/NN.md.
// Manuscripts are reproduced verbatim: only paragraphs, line breaks, "## " headings and
// "> " quotes are interpreted. A missing manuscript yields a "manuscript pending" page.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "content", "essays");
const OUT = path.join(ROOT, "essays");
const essays = JSON.parse(fs.readFileSync(path.join(SRC, "essays.json"), "utf8"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render(md) {
  const blocks = md.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
  return blocks.map((b) => {
    if (/^## /.test(b)) return `<h2>${esc(b.replace(/^## /, ""))}</h2>`;
    if (b.split("\n").every((l) => /^> ?/.test(l))) {
      return `<blockquote>${b.split("\n").map((l) => esc(l.replace(/^> ?/, ""))).join("<br />")}</blockquote>`;
    }
    return `<p>${b.split("\n").map(esc).join("<br />")}</p>`;
  }).join("\n        ");
}

function page(e, i, body) {
  const prev = essays[i - 1];
  const next = essays[i + 1];
  const pending = body === null;
  const titleLang = e.lang === "ja" ? ' lang="ja"' : "";
  const navItem = (x, dir) => x
    ? `<a class="essay-nav-item ${dir}" href="/essays/${x.no}/"><span class="mono">${dir === "prev" ? `← PREVIOUS — ${x.no}` : `NEXT — ${x.no} →`}</span><span class="essay-nav-title"${x.lang === "ja" ? ' lang="ja"' : ""}>${esc(x.title)}</span></a>`
    : `<span class="essay-nav-item ${dir} is-empty"></span>`;

  return `<!doctype html>
<html lang="${e.lang === "ja" ? "ja" : "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ESSAY ${e.no} — ${esc(e.title)} | TIME WILL TELL</title>
  <meta name="description" content="TIME WILL TELL — ESSAY ${e.no}. ${esc(e.title)}" />
  ${pending ? '<meta name="robots" content="noindex" />' : ""}
  <meta name="theme-color" content="#f1eee6" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="preload" href="/assets/fonts/archivo-latin-var.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/essays/essay.css" />
</head>
<body class="essay-page">
  <div class="paper" aria-hidden="true"></div>

  <header class="bar">
    <a href="/" class="bar-mark">TWT</a>
    <span class="bar-mid mono">ESSAY ${e.no} / 06</span>
    <a href="/#${e.anchor}" class="bar-link mono">← TIME WILL TELL</a>
  </header>

  <main class="essay">
    <header class="essay-head">
      <p class="essay-kicker mono"><span>ESSAY ${e.no}</span><span>${e.from.map(esc).join(" · ")}</span></p>
      <h1 class="essay-title"${titleLang}>${esc(e.title)}</h1>
      <p class="essay-en-note mono">ENGLISH TRANSLATION — PENDING EDITORIAL REVIEW</p>
      <div class="essay-rule" aria-hidden="true"><span></span></div>
    </header>

    <article class="essay-body"${e.lang === "ja" ? ' lang="ja"' : ""}>
      ${pending
        ? `<div class="essay-pending">
        <p class="mono">MANUSCRIPT PENDING</p>
        <p lang="ja">原稿未配置</p>
      </div>`
        : `<div class="essay-text">
        ${body}
      </div>`}
    </article>

    <nav class="essay-nav" aria-label="Essays">
      ${navItem(prev, "prev")}
      ${navItem(next, "next")}
    </nav>

    <a class="essay-back" href="/#${e.anchor}">
      <span class="pair">
        <span class="follow-en">BACK TO TIME WILL TELL</span>
        <span class="ja">LPに戻る</span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5 5 19M15 19H5V9" /></svg>
    </a>
  </main>

  <footer class="foot mono">
    <span>© 2026 TIME WILL TELL</span>
    <span>JAPAN / OKINAWA / MIYAKOJIMA</span>
    <span>001 / 100</span>
  </footer>
</body>
</html>
`;
}

const report = [];
essays.forEach((e, i) => {
  const file = path.join(SRC, `${e.no}.md`);
  let body = null;
  if (fs.existsSync(file)) {
    const md = fs.readFileSync(file, "utf8");
    if (e.mustEndWith && md.trim().split("\n").pop().trim() !== e.mustEndWith) {
      console.error(`ESSAY ${e.no}: manuscript must end with "${e.mustEndWith}"`);
      process.exit(1);
    }
    body = render(md);
  }
  fs.mkdirSync(path.join(OUT, e.no), { recursive: true });
  fs.writeFileSync(path.join(OUT, e.no, "index.html"), page(e, i, body));
  report.push(`ESSAY ${e.no}: ${body === null ? "MANUSCRIPT PENDING" : "ok"}`);
});
console.log(report.join("\n"));

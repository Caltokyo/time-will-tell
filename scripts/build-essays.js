#!/usr/bin/env node
// Generates the essay layer:
//   essays/index.html          — THE SIX ESSAYS (ordered reading index)
//   essays/01/index.html … 06  — one page per essay, from content/essays/NN.md
// Manuscripts are reproduced verbatim: only paragraphs, line breaks, "## " headings and
// "> " quotes are interpreted. A missing manuscript yields a "manuscript pending" page.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "content", "essays");
const OUT = path.join(ROOT, "essays");
const LP_ANCHOR = "/#the-six-essays";
const essays = JSON.parse(fs.readFileSync(path.join(SRC, "essays.json"), "utf8"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const langAttr = (x) => (x.lang === "ja" ? ' lang="ja"' : "");
const labelHtml = (x, cls) => (x.label ? `<span class="${cls}">${esc(x.label)}</span>` : "");

function blocksOf(md) {
  return md.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
}

function render(blocks, coda) {
  return blocks.map((b, i) => {
    if (coda && i === blocks.length - 1 && b.trim() === coda) return `<p class="essay-coda" lang="en">${esc(b)}</p>`;
    if (/^## /.test(b)) return `<h2>${esc(b.replace(/^## /, ""))}</h2>`;
    if (b.split("\n").every((l) => /^> ?/.test(l))) {
      return `<blockquote>${b.split("\n").map((l) => esc(l.replace(/^> ?/, ""))).join("<br />")}</blockquote>`;
    }
    return `<p>${b.split("\n").map(esc).join("<br />")}</p>`;
  }).join("\n        ");
}

function shell({ lang, title, description, noindex, barMid, body }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ""}
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
    <span class="bar-mid mono">${barMid}</span>
    <a href="${LP_ANCHOR}" class="bar-link mono">← TIME WILL TELL</a>
  </header>

${body}

  <footer class="foot mono">
    <span>© 2026 TIME WILL TELL</span>
    <span>JAPAN / OKINAWA / MIYAKOJIMA</span>
    <span>001 / 100</span>
  </footer>
</body>
</html>
`;
}

const backToLp = `    <a class="essay-back" href="${LP_ANCHOR}">
      <span class="pair">
        <span class="follow-en">BACK TO TIME WILL TELL</span>
        <span class="ja">LPに戻る</span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5 5 19M15 19H5V9" /></svg>
    </a>`;

function essayPage(e, i, body) {
  const prev = essays[i - 1];
  const next = essays[i + 1];
  const pending = body === null;
  const navItem = (x, dir) => x
    ? `<a class="essay-nav-item ${dir}" href="/essays/${x.no}/"><span class="mono">${dir === "prev" ? `← PREVIOUS — ${x.no}` : `NEXT — ${x.no} →`}</span><span class="essay-nav-title"${langAttr(x)}>${labelHtml(x, "nav-label")}${esc(x.title)}</span></a>`
    : `<a class="essay-nav-item ${dir} is-index" href="/essays/"><span class="mono">${dir === "prev" ? "← THE SIX ESSAYS" : "THE SIX ESSAYS →"}</span><span class="essay-nav-title" lang="ja">六つのエッセイ</span></a>`;

  return shell({
    lang: e.lang === "ja" ? "ja" : "en",
    title: `ESSAY ${e.no} — ${esc(e.title)} | TIME WILL TELL`,
    description: `TIME WILL TELL — ESSAY ${e.no}. ${esc(e.title)}`,
    noindex: pending,
    barMid: `<a href="/essays/">THE SIX ESSAYS</a> — ${e.no} / 06`,
    body: `  <main class="essay">
    <header class="essay-head">
      <p class="essay-kicker mono"><span>ESSAY ${e.no}</span><a href="/essays/">THE SIX ESSAYS — ${e.no} / 06</a></p>
      ${e.label ? `<p class="essay-label">${esc(e.label)}</p>` : ""}
      <h1 class="essay-title"${langAttr(e)}>${esc(e.title)}</h1>
      <p class="essay-en-note mono">ENGLISH TRANSLATION — PENDING EDITORIAL REVIEW</p>
      <div class="essay-rule" aria-hidden="true"><span></span></div>
    </header>

    <article class="essay-body"${langAttr(e)}>
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

    <a class="essay-toc-link" href="/essays/">
      <span class="mono">ALL ESSAYS</span>
      <span class="ja">目次</span>
      <span class="mono" aria-hidden="true">01 — 06</span>
    </a>

${backToLp}
  </main>`,
  });
}

function indexPage(status) {
  const allPending = status.every((s) => s === null);
  const rows = essays.map((e, i) => `        <li>
          <a class="toc-row" href="/essays/${e.no}/">
            <span class="toc-no mono">${e.no}</span>
            <span class="toc-title"${langAttr(e)}>${labelHtml(e, "toc-label")}${esc(e.title)}</span>
            <span class="toc-state mono">${status[i] === null ? "MANUSCRIPT PENDING" : "READ →"}</span>
          </a>
        </li>`).join("\n");

  return shell({
    lang: "en",
    title: "THE SIX ESSAYS | TIME WILL TELL",
    description: "TIME WILL TELL — six essays, to be read in order.",
    noindex: allPending,
    barMid: "THE SIX ESSAYS",
    body: `  <main class="essay essay-index">
    <header class="essay-head">
      <p class="essay-kicker mono"><span>TIME WILL TELL</span><span>01 → 06</span></p>
      <h1 class="essay-title">THE SIX<br />ESSAYS</h1>
      <div class="pair index-lead">
        <p>To be read in order.</p>
        <p class="ja">六つのエッセイ。01から06へ、順に。</p>
      </div>
      <p class="essay-en-note mono">${allPending ? "JAPANESE MANUSCRIPTS PENDING" : "JAPANESE TEXT"} · ENGLISH TRANSLATION PENDING EDITORIAL REVIEW</p>
      <div class="essay-rule" aria-hidden="true"><span></span></div>
    </header>

    <nav aria-label="The six essays">
      <ol class="toc">
${rows}
      </ol>
    </nav>

    <a class="essay-begin" href="/essays/01/">
      <span class="pair">
        <span class="follow-en">BEGIN WITH ESSAY 01</span>
        <span class="ja">01から読む</span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10" /></svg>
    </a>

${backToLp}
  </main>`,
  });
}

function lpBlock() {
  const rows = essays.map((e) => `          <li>
            <a class="essay-row reveal" href="/essays/${e.no}/">
              <span class="essay-row-meta mono"><span class="essay-row-no">${e.no}</span><span class="essay-row-cat"${/[^\x00-\x7F]/.test(e.category || "") ? ' lang="ja"' : ""}>${esc(e.category || "")}</span></span>
              <span class="essay-row-title"${langAttr(e)}>${esc(e.title)}</span>
              <svg class="essay-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10" /></svg>
            </a>
          </li>`).join("\n");
  return `    <!-- ESSAYS — interlude between PART I and the FIELD LOG (generated by npm run build:essays) -->
    <section id="the-six-essays" class="sec sec-dark essays-entry" aria-labelledby="s-essays">
      <div class="sec-label sec-label--plain mono essays-label">
        <span id="s-essays">ESSAYS</span>
        <span class="essays-label-ja" lang="ja">思考の記録</span>
      </div>
      <div class="sec-body">
        <ol class="essay-list">
${rows}
        </ol>
        <a class="essays-all mono reveal" href="/essays/">ALL ESSAYS <span lang="ja">目次</span> →</a>
      </div>
    </section>`;
}

// Noto Serif JP subset containing only the glyphs of the six LP titles (Google Fonts `text=`),
// so the titles render in one face immediately instead of loading many CJK subsets.
function titleFontLink() {
  const chars = [...new Set(essays.map((e) => e.title).join(""))].sort().join("");
  const href = `https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@600&display=swap&text=${encodeURIComponent(chars)}`;
  return `<link id="essay-title-font" rel="stylesheet" href="${href.replace(/&/g, "&amp;")}" />`;
}

function writeLpBlock() {
  const file = path.join(ROOT, "index.html");
  let page = fs.readFileSync(file, "utf8");
  page = page.replace(/  <!-- ESSAY-TITLE-FONT -->[\s\S]*?(?=  <link rel="stylesheet" href="styles.css" \/>)/, `  <!-- ESSAY-TITLE-FONT -->\n  ${titleFontLink()}\n`);
  const START = "<!-- ESSAYS:START -->";
  const END = "<!-- ESSAYS:END -->";
  const a = page.indexOf(START);
  const b = page.indexOf(END);
  if (a < 0 || b < a) throw new Error("index.html: ESSAYS markers not found");
  fs.writeFileSync(file, page.slice(0, a + START.length) + "\n" + lpBlock() + "\n    " + page.slice(b));
}

const report = [];
const status = essays.map((e, i) => {
  const file = path.join(SRC, `${e.no}.md`);
  let body = null;
  if (fs.existsSync(file)) {
    const md = fs.readFileSync(file, "utf8");
    if (e.mustEndWith && md.trim().split("\n").pop().trim() !== e.mustEndWith) {
      console.error(`ESSAY ${e.no}: manuscript must end with "${e.mustEndWith}"`);
      process.exit(1);
    }
    const [headline, ...rest] = blocksOf(md);
    if (headline.trim() !== e.title) {
      console.error(`ESSAY ${e.no}: first line of the manuscript ("${headline}") must match the title in essays.json`);
      process.exit(1);
    }
    body = render(rest, e.mustEndWith);
  }
  fs.mkdirSync(path.join(OUT, e.no), { recursive: true });
  fs.writeFileSync(path.join(OUT, e.no, "index.html"), essayPage(e, i, body));
  report.push(`ESSAY ${e.no}: ${body === null ? "MANUSCRIPT PENDING" : "ok"}`);
  return body;
});
fs.writeFileSync(path.join(OUT, "index.html"), indexPage(status));
report.push("INDEX: ok");
writeLpBlock();
report.push("LP ESSAYS: ok");
console.log(report.join("\n"));

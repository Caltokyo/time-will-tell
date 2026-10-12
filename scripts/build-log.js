#!/usr/bin/env node
// Assembles part two of the LP — the FIELD LOG — from content/log/.
//
//   content/log/log.json              categories (numbered in this order) and their articles
//   content/log/<category>/<slug>.html one file per article: only that article's inner markup
//   content/log/_intro-transition.html the "So we decided to build one." block above the intro
//   content/log/end.html              LOG END (TIME WILL TELL.) — fixed, never swipeable
//   content/log/_test/test.json       test-only articles (see below)
//
// Outputs
//   index.html                 the block between <!-- LOG:START --> and <!-- LOG:END -->
//   log/<category>/<slug>/     one page per published article: the LP with that article
//                              selected, its own <title>, canonical and OG tags
//   log/_test/…                the same, with the test articles mixed in (noindex, and
//                              redirected to / on utaki.me). Delete content/log/_test to drop it.
//
// Adding an article: write content/log/<category>/<slug>.html, add an entry to that category's
// "articles" in log.json, run `npm run build:log`. Only status "published" reaches the LP;
// "draft" never renders. Articles are ordered by "order". "published"/"updated" (YYYY-MM-DD)
// print only when set — use real dates.
//
// `node scripts/build-log.js --check` writes nothing and fails if any output is stale.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "content", "log");
const INDEX = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "log");
const TEST_JSON = path.join(DIR, "_test", "test.json");
const CHECK = process.argv.includes("--check");

const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "log.json"), "utf8"));
const SITE = cfg.site.replace(/\/$/, "");
const STATUSES = ["published", "draft", "test"];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const indent = (html, n) => html.trimEnd().split("\n").map((l) => (l ? " ".repeat(n) + l : l)).join("\n");
const read = (file) => fs.readFileSync(path.join(DIR, file), "utf8");

function dateOf(where, v) {
  if (v == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${where}: dates must be YYYY-MM-DD`);
  return { iso: v, text: v.replace(/-/g, ".") };
}

// ---------- data ----------

function validate(cat, a) {
  const where = `log ${cat.key}/${a.slug}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug || "")) throw new Error(`${where}: slug must be lowercase-kebab`);
  if (!STATUSES.includes(a.status)) throw new Error(`${where}: status must be one of ${STATUSES.join(", ")}`);
  if (!Number.isFinite(a.order)) throw new Error(`${where}: "order" must be a number`);
  if (!a.title) throw new Error(`${where}: "title" is required`);
  dateOf(where, a.published);
  dateOf(where, a.updated);
  if (a.status !== "draft" && !read(a.file).includes(`id="${a.heading}"`)) throw new Error(`${where}: heading id "${a.heading}" not found in ${a.file}`);
}

function categories(includeTest) {
  const extra = includeTest && fs.existsSync(TEST_JSON) ? JSON.parse(fs.readFileSync(TEST_JSON, "utf8")).articles : [];
  return cfg.categories.map((c) => {
    const list = [...c.articles, ...extra.filter((a) => a.category === c.key)];
    list.forEach((a) => validate(c, a));
    const show = list
      .filter((a) => a.status === "published" || (includeTest && a.status === "test"))
      .sort((x, y) => x.order - y.order);
    const slugs = new Set();
    for (const a of show) {
      if (slugs.has(a.slug)) throw new Error(`log ${c.key}: duplicate slug "${a.slug}"`);
      slugs.add(a.slug);
    }
    if (!show.length) throw new Error(`log ${c.key}: no published article`);
    return { ...c, articles: show };
  });
}

// ---------- markup ----------

function dates(a, active) {
  const p = dateOf(a.slug, a.published);
  const u = dateOf(a.slug, a.updated);
  const span = (label, d) => `<span class="log-updated" data-log-for="${a.slug}"${active ? "" : " hidden"}><span>${label}</span><time datetime="${d.iso}">${d.text}</time></span>`;
  return [p && span("PUBLISHED", p), u && span("UPDATED", u)].filter(Boolean);
}

function category(c, no, active, base) {
  const ai = Math.max(0, c.articles.findIndex((a) => a.slug === active));
  const cur = c.articles[ai];
  const multi = c.articles.length > 1;
  const classes = ["log", "sec", ...(c.classes || [])].join(" ");
  const meta = c.articles.flatMap((a, i) => dates(a, i === ai)).map((s) => `        ${s}`);
  const articles = c.articles.map((a, i) => {
    const attrs = [
      `class="sec-body log-article${i === ai ? " is-active" : ""}"`,
      `id="${c.id}--${a.slug}"`,
      `data-slug="${a.slug}"`,
      `data-url="${base}${c.key}/${a.slug}/"`,
      `data-title="${esc(a.title)}"`,
      `data-heading="${a.heading}"`,
    ];
    if (multi) attrs.push(`aria-roledescription="entry"`, `aria-label="${pad(i + 1)} / ${pad(c.articles.length)}"`);
    return `      <!-- ${esc(a.title)} — edit content/log/${a.file} -->
      <div ${attrs.join(" ")}>
${indent(read(a.file), 8)}
      </div>`;
  });
  return `    <!-- LOG ${no} / ${c.title} — articles listed in content/log/log.json -->
    <section id="${c.id}" class="${classes}" aria-labelledby="${cur.heading}" data-log="${no}" data-log-cat="${c.key}"${multi ? ` data-log-count="${c.articles.length}"` : ""}>
      <header class="log-margin mono">
        <span class="log-tag">LOG</span>
        <span class="log-no">${no}</span>
        <span class="log-name">${esc(c.title)}</span>
${meta.join("\n")}
      </header>
${articles.join("\n\n")}
    </section>`;
}

function end(no) {
  const e = cfg.end;
  const u = dateOf("log end", e.updated);
  return `    <!-- LOG ${no} / ${e.title} — edit content/log/${e.file} (not swipeable) -->
    <section id="${e.id}" class="log end log-end" aria-labelledby="${e.heading}" data-log="${no}">
      <header class="log-margin mono">
        <span class="log-tag">LOG</span>
        <span class="log-no">${no}</span>
        <span class="log-name">${esc(e.title)}</span>
        ${u ? `<span class="log-updated"><span>UPDATED</span><time datetime="${u.iso}">${u.text}</time></span>` : ""}
      </header>
${indent(read(e.file), 6)}
    </section>`;
}

function intro(cats) {
  const rows = [...cats, cfg.end].map((c, i) => `          <li><a href="#${c.id}"><span>${pad(i + 1)}</span>${esc(c.title)}</a></li>`).join("\n");
  return `    <noscript><style>.log-article { display: flex !important; } .log-article + .log-article { margin-top: clamp(64px, 8vw, 120px); }</style></noscript>
    <section class="log-intro" aria-label="Field log">
${indent(read(cfg.intro.transition), 6)}
      <div class="log-intro-head">
        <p class="log-intro-part mono">PART II</p>
        <p class="log-intro-title mono">FIELD LOG</p>
        <p class="log-intro-ja" lang="ja">${esc(cfg.intro.ja)}</p>
      </div>
      <nav class="log-intro-index mono" aria-label="Field log entries">
        <ol>
${rows}
        </ol>
      </nav>
      <p class="log-intro-meta mono">JAPAN / OKINAWA / MIYAKOJIMA<br />001 / 100</p>
    </section>`;
}

function block(cats, active, base) {
  return [
    intro(cats),
    ...cats.map((c, i) => category(c, pad(i + 1), active[c.key], base)),
    end(pad(cats.length + 1)),
    `    <script src="field-log.js" defer></script>`,
  ].join("\n\n");
}

// ---------- pages ----------

const START = "<!-- LOG:START -->";
const END = "<!-- LOG:END -->";
function splice(page, html) {
  const a = page.indexOf(START);
  const b = page.indexOf(END);
  if (a < 0 || b < a) throw new Error("index.html: LOG markers not found");
  return page.slice(0, a + START.length) + "\n" + html + "\n    " + page.slice(b);
}

// Pages under /log/… are copies of the LP: make relative asset URLs root-absolute.
const absolutize = (html) => html.replace(/\b(src|href|poster)="(?![/#]|[a-z][a-z0-9+.-]*:)([^"]*)"/gi, '$1="/$2"');

function setMeta(page, { title, description, url, image, focus, test }) {
  const head = [
    `<link rel="canonical" href="${SITE}${url}" />`,
    `<meta property="og:url" content="${SITE}${url}" />`,
    ...(image ? [`<meta property="og:image" content="${SITE}/${String(image).replace(/^\//, "")}" />`] : []),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    ...(test ? [`<meta name="robots" content="noindex, nofollow" />`, `<script>if (/(^|\\.)utaki\\.me$/.test(location.hostname)) location.replace("/");</script>`] : []),
  ].map((l) => `  ${l}`).join("\n");
  const rep = (re, s) => {
    if (!re.test(page)) throw new Error(`index.html: ${re} not found`);
    page = page.replace(re, s);
  };
  rep(/<html lang="en">/, `<html lang="en" data-log-focus="${focus}">`);
  rep(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  rep(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  rep(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  rep(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  rep(/(<meta property="og:type" content=")[^"]*(")/, `$1article$2`);
  return page.replace(/(<meta property="og:type"[^>]*>\n)/, `$1${head}\n`);
}

function build() {
  const out = new Map();
  const lp = fs.readFileSync(INDEX, "utf8");
  const published = categories(false);
  const first = (cats) => Object.fromEntries(cats.map((c) => [c.key, c.articles[0].slug]));

  const index = splice(lp, block(published, first(published), "/log/"));
  out.set(INDEX, index);

  const pages = (cats, base, test) => {
    if (test) {
      const root = setMeta(splice(lp, block(cats, first(cats), base)), {
        title: "FIELD LOG — TEST", description: "Test build of the field log. Not for publication.", url: base, focus: cats[0].key, test,
      });
      out.set(path.join(ROOT, base, "index.html"), absolutize(root));
    }
    for (const c of cats) {
      c.articles.forEach((a, i) => {
        const url = `${base}${c.key}/${a.slug}/`;
        const page = setMeta(splice(lp, block(cats, { ...first(cats), [c.key]: a.slug }, base)), {
          title: `${a.title} — FIELD LOG / ${c.title} — TIME WILL TELL.`,
          description: a.description || `FIELD LOG / ${c.title} ${pad(i + 1)}. TIME WILL TELL. Japan / Okinawa / Miyakojima.`,
          url, image: a.image, focus: c.key, test,
        });
        out.set(path.join(ROOT, url, "index.html"), absolutize(page));
      });
    }
  };
  pages(published, "/log/", false);
  if (fs.existsSync(TEST_JSON)) pages(categories(true), "/log/_test/", true);
  return { out, published };
}

const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile()) : []);

const { out, published } = build();
const stale = [...out].filter(([f, s]) => !fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s).map(([f]) => f);
const extra = listFiles(OUT).filter((f) => !out.has(f));

if (CHECK) {
  if (stale.length || extra.length) {
    console.error([...stale.map((f) => `stale: ${path.relative(ROOT, f)}`), ...extra.map((f) => `extra: ${path.relative(ROOT, f)}`)].join("\n"));
    console.error("Run: npm run build:log");
    process.exit(1);
  }
  console.log("field log is up to date");
} else {
  extra.forEach((f) => fs.rmSync(f));
  for (const [f, s] of out) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s);
  }
  published.forEach((c, i) => console.log(`LOG ${pad(i + 1)} ${c.title}: ${c.articles.map((a) => a.slug).join(", ")}`));
  console.log(`LOG ${pad(published.length + 1)} ${cfg.end.title}`);
  console.log(`${out.size - 1} article pages written under log/`);
}

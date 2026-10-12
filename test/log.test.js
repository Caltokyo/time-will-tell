// FIELD LOG build: generated pages are in sync with content/log and index.html,
// and test-only entries never reach the published LP or published entry pages.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

test("generated field log is up to date (npm run build:log)", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-log.js"), "--check"], { stdio: "pipe" });
});

test("test entries stay out of published pages", () => {
  const files = [path.join(ROOT, "index.html")];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "_test") walk(p);
    else if (e.isFile()) files.push(p);
  });
  walk(path.join(ROOT, "log"));
  const test = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "log", "_test", "test.json"), "utf8")).articles;
  for (const f of files) {
    const html = fs.readFileSync(f, "utf8");
    for (const a of test) assert.ok(!html.includes(`id="${a.heading}"`), `${path.relative(ROOT, f)} contains test entry ${a.heading}`);
    assert.ok(!html.includes('name="robots"'), `${path.relative(ROOT, f)} is marked noindex`);
  }
});

test("every published entry has its own page with matching canonical and og:url", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "log", "log.json"), "utf8"));
  for (const c of cfg.categories) {
    for (const a of c.articles.filter((x) => x.status === "published")) {
      const url = `/log/${c.key}/${a.slug}/`;
      const html = fs.readFileSync(path.join(ROOT, url, "index.html"), "utf8");
      assert.ok(html.includes(`<link rel="canonical" href="${cfg.site}${url}" />`), url);
      assert.ok(html.includes(`<meta property="og:url" content="${cfg.site}${url}" />`), url);
      assert.ok(html.includes(`data-log-focus="${c.key}"`), url);
    }
  }
});

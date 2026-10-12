// /instagram/: generated page is in sync, every tile links to an existing place on the site,
// external links open safely, and no image is referenced that is not in the repository.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

test("instagram page is up to date and its targets exist (npm run build:instagram)", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-instagram.js"), "--check"], { stdio: "pipe" });
});

test("instagram page: no link to the bare LP top, external links are safe", () => {
  const html = fs.readFileSync(path.join(ROOT, "instagram", "index.html"), "utf8");
  for (const [, href] of html.matchAll(/class="ig-link" href="([^"]+)"/g)) assert.notEqual(href, "/", "a post links to the LP top");
  for (const [tag] of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(tag, /rel="noopener noreferrer"/);
  for (const [, src] of html.matchAll(/src="\/(assets\/instagram\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(ROOT, src)), src);
});

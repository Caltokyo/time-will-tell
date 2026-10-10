#!/usr/bin/env node
// Assembles part two of the LP — the FIELD LOG — from content/log/.
//
//   content/log/log.json   ordered list of entries (numbering follows this order)
//   content/log/NN-*.html  one file per entry: only that entry's inner markup
//
// Output is written between <!-- LOG:START --> and <!-- LOG:END --> in index.html.
// Entries can be edited, added, removed or reordered independently; numbers 01…NN and
// the field-log index are regenerated every time. `updated` (YYYY-MM-DD) is printed only
// when it is set — use the real date the entry's content changed.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "content", "log");
const INDEX = path.join(ROOT, "index.html");
const entries = JSON.parse(fs.readFileSync(path.join(DIR, "log.json"), "utf8"));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const indent = (html, n) => html.trimEnd().split("\n").map((l) => (l ? " ".repeat(n) + l : l)).join("\n");

function updatedOf(e) {
  if (!e.updated) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.updated)) throw new Error(`log ${e.key}: "updated" must be YYYY-MM-DD`);
  return e.updated.replace(/-/g, ".");
}

function margin(e, no) {
  const updated = updatedOf(e);
  return `      <header class="log-margin mono">
        <span class="log-tag">LOG</span>
        <span class="log-no">${no}</span>
        <span class="log-name">${esc(e.title)}</span>
        ${updated ? `<span class="log-updated"><span>UPDATED</span><time datetime="${e.updated}">${updated}</time></span>` : ""}
      </header>`;
}

function section(e, i) {
  const no = pad(i + 1);
  const src = fs.readFileSync(path.join(DIR, e.file), "utf8");
  const id = e.id || `log-${e.key}`;
  const classes = ["log", ...(e.layout === "end" ? ["end", "log-end"] : ["sec"]), ...(e.classes || [])].join(" ");
  const body = e.layout === "end"
    ? indent(src, 6)
    : `      <div class="sec-body">\n${indent(src, 8)}\n      </div>`;
  return `    <!-- LOG ${no} / ${e.title} — edit content/log/${e.file} -->
    <section id="${id}" class="${classes}" aria-labelledby="${e.labelledby}" data-log="${no}">
${margin(e, no)}
${body}
    </section>`;
}

function intro() {
  const items = entries.map((e, i) => `          <li><a href="#${e.id || `log-${e.key}`}"><span>${pad(i + 1)}</span>${esc(e.title)}</a></li>`).join("\n");
  return `    <section class="log-intro" aria-label="Field log">
      <div class="log-intro-head">
        <p class="log-intro-part mono">PART II</p>
        <p class="log-intro-title mono">FIELD LOG</p>
        <p class="log-intro-ja" lang="ja">観察記録</p>
      </div>
      <nav class="log-intro-index mono" aria-label="Field log entries">
        <ol>
${items}
        </ol>
      </nav>
      <p class="log-intro-meta mono">JAPAN / OKINAWA / MIYAKOJIMA<br />001 / 100</p>
    </section>`;
}

const html = [intro(), ...entries.map(section)].join("\n\n");
const page = fs.readFileSync(INDEX, "utf8");
const START = "<!-- LOG:START -->";
const END = "<!-- LOG:END -->";
const a = page.indexOf(START);
const b = page.indexOf(END);
if (a < 0 || b < a) throw new Error("index.html: LOG markers not found");
const out = page.slice(0, a + START.length) + "\n" + html + "\n    " + page.slice(b);
fs.writeFileSync(INDEX, out);
console.log(entries.map((e, i) => `LOG ${pad(i + 1)} ${e.title}${e.updated ? ` (updated ${e.updated})` : ""}`).join("\n"));

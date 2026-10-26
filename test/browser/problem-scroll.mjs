import { webkit, chromium, devices } from "playwright";
const base = process.env.BASE || "http://localhost:8137/"; let fail = 0;
for (const [eng, bt] of [["webkit", webkit], ["chromium", chromium]]) {
  const b = await bt.launch();
  for (const [name, opts] of [["pc", { viewport: { width: 1440, height: 900 } }], ["iphone", { ...devices["iPhone 13"] }]]) {
    if (eng === "chromium" && name === "iphone") continue;
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => { if (!/\bL\b/.test(e.message)) errs.push(e.message); });
    await p.goto(base, { waitUntil: "load" }); if (!(await p.evaluate(() => fetch("/main.js", { cache: "no-store" }).then((r) => r.text()).then((t) => t.includes("questions follow the scroll position"))))) { errs.push("production main.js is not the new version"); } await p.waitForTimeout(800);
    const st = () => p.evaluate(() => { const l = document.querySelector(".feed-interactive"); const it = [...l.querySelectorAll(".feed-detail")];
      return { a: it.findIndex((d) => d.classList.contains("is-active")), h: Math.round(l.getBoundingClientRect().height), sec: Math.round(l.closest("section").getBoundingClientRect().height) }; });
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const l = document.querySelector(".feed-interactive"); scrollTo(0, l.getBoundingClientRect().top + scrollY - innerHeight * 0.95); });
    await p.waitForTimeout(400); const s0 = await st(); const down = [s0.a], up = [], hs = new Set([s0.h + "/" + s0.sec]);
    const step = async (dy) => { if (name === "pc") await p.mouse.wheel(0, dy); else await p.evaluate((dy) => scrollBy(0, dy), dy); await p.waitForTimeout(300); const s = await st(); hs.add(s.h + "/" + s.sec); return s.a; };
    if (name === "pc") await p.mouse.move(400, 450);
    for (let i = 0; i < 14; i++) down.push(await step(100));
    for (let i = 0; i < 14; i++) up.push(await step(-100));
    const mono = (a, d) => a.every((v, i) => !i || (d > 0 ? v >= a[i - 1] : v <= a[i - 1]));
    const ok = down[0] === 0 && mono(down, 1) && mono(up, -1) && new Set(down).size === 4 && up.at(-1) === 0 && hs.size === 1 && !errs.length;
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"} ${eng} ${name}: down ${down.join("")} up ${up.join("")} height ${[...hs].join(",")} errors ${errs.length}`);
    await ctx.close();
  }
  await b.close();
}
process.exit(fail ? 1 : 0);

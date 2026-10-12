// FIELD LOG — entries within a category, one at a time.
// Vertical scrolling moves between categories; horizontal movement swaps the whole entry:
// swipe (touch), the ← → buttons in the log margin, or the arrow keys while focus is inside
// the category. Every entry has its own URL (/log/<category>/<slug>/), kept in history.
(() => {
  const sections = [...document.querySelectorAll("section[data-log-cat]")];
  if (!sections.length) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const pad = (n) => String(n).padStart(2, "0");
  const cats = new Map();

  sections.forEach((sec) => {
    const arts = [...sec.querySelectorAll(":scope > .log-article")];
    const i = Math.max(0, arts.findIndex((a) => a.classList.contains("is-active")));
    const c = { key: sec.dataset.logCat, sec, arts, i, name: sec.querySelector(".log-name").textContent.trim() };
    cats.set(c.key, c);
    if (arts.length < 2) return;

    c.pager = sec.querySelector("[data-log-pager]");
    c.live = document.createElement("span");
    c.live.className = "log-live";
    c.live.setAttribute("aria-live", "polite");
    sec.appendChild(c.live);

    c.pager.addEventListener("click", (e) => {
      const b = e.target.closest("[data-log-step]");
      if (b) step(c, Number(b.dataset.logStep));
    });

    sec.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (step(c, e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
    });

    swipe(c);
  });

  const titleOf = (c, a) => `${a.dataset.title} — FIELD LOG / ${c.name} — TIME WILL TELL.`;
  const snapshot = () => Object.fromEntries([...cats.values()].map((c) => [c.key, c.arts[c.i].dataset.slug]));

  function show(c, j, { dir = 0, push = false } = {}) {
    if (j < 0 || j >= c.arts.length || j === c.i) return false;
    const prev = c.arts[c.i];
    const next = c.arts[j];
    prev.classList.remove("is-active", "is-enter-next", "is-enter-prev");
    next.classList.remove("is-enter-next", "is-enter-prev");
    next.classList.add("is-active");
    if (dir && !reduce.matches) {
      void next.offsetWidth;
      next.classList.add(dir > 0 ? "is-enter-next" : "is-enter-prev");
    }
    c.i = j;
    c.sec.setAttribute("aria-labelledby", next.dataset.heading);
    c.sec.querySelectorAll("[data-log-for]").forEach((s) => (s.hidden = s.dataset.logFor !== next.dataset.slug));
    // The entry itself animates in; its contents should not fade in a second time.
    next.querySelectorAll(".reveal").forEach((r) => r.classList.add("is-in"));

    const n = c.arts.length;
    c.pager.querySelector("[data-log-current]").textContent = pad(j + 1);
    const [back, fwd] = c.pager.querySelectorAll("[data-log-step]");
    const focused = document.activeElement;
    back.disabled = j === 0;
    fwd.disabled = j === n - 1;
    if (focused && focused.disabled) (focused === back ? fwd : back).focus();
    c.live.textContent = `${pad(j + 1)} / ${pad(n)} — ${next.dataset.title}`;

    if (push) {
      // Entries differ in height: if the reader is mid-entry, show the new one from its top.
      const top = c.sec.getBoundingClientRect().top;
      if (top < 0) scrollTo({ top: scrollY + top, behavior: reduce.matches ? "instant" : "smooth" });
      const title = titleOf(c, next);
      document.title = title;
      history.pushState({ ...history.state, twtLog: snapshot(), title }, "", next.dataset.url);
    }
    return true;
  }

  const step = (c, d) => show(c, c.i + d, { dir: d, push: true });

  // Horizontal swipe. The entry keeps native vertical panning (touch-action: pan-y), so a
  // vertical scroll is never blocked; a gesture only counts once it is clearly horizontal.
  function swipe(c) {
    let g = null;
    const art = () => c.arts[c.i];
    const release = () => {
      const a = art();
      a.classList.remove("is-dragging");
      a.style.transform = "";
    };
    c.sec.addEventListener("touchstart", (e) => {
      g = null;
      if (e.touches.length !== 1 || e.target.closest("[data-log-pager], a, button, input, iframe")) return;
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, t: performance.now(), axis: null, dx: 0 };
    }, { passive: true });
    c.sec.addEventListener("touchmove", (e) => {
      if (!g || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.axis) {
        if (Math.hypot(dx, dy) < 10) return;
        g.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      }
      if (g.axis !== "x") return;
      g.dx = dx;
      if (reduce.matches) return;
      const edge = (dx > 0 && c.i === 0) || (dx < 0 && c.i === c.arts.length - 1);
      art().classList.add("is-dragging");
      art().style.transform = `translateX(${(dx * (edge ? 0.12 : 0.3)).toFixed(1)}px)`;
    }, { passive: true });
    c.sec.addEventListener("touchend", () => {
      if (!g || g.axis !== "x") { g = null; return; }
      const dx = g.dx;
      const v = Math.abs(dx) / Math.max(1, performance.now() - g.t);
      g = null;
      release();
      if (Math.abs(dx) > Math.min(80, innerWidth * 0.2) || (Math.abs(dx) > 30 && v > 0.5)) step(c, dx < 0 ? 1 : -1);
    }, { passive: true });
    c.sec.addEventListener("touchcancel", () => { g = null; release(); }, { passive: true });
  }

  // History: Back / Forward restore every category's entry as it was.
  history.replaceState({ ...history.state, twtLog: snapshot(), title: document.title }, "");
  addEventListener("popstate", (e) => {
    const s = e.state && e.state.twtLog;
    if (!s) return;
    for (const c of cats.values()) {
      const j = c.arts.findIndex((a) => a.dataset.slug === s[c.key]);
      if (j >= 0 && j !== c.i) show(c, j);
    }
    if (e.state.title) document.title = e.state.title;
  });

  // An entry's own page (/log/<category>/<slug>/) opens at that category.
  const focus = cats.get(document.documentElement.dataset.logFocus);
  if (focus && !location.hash && scrollY < 10) {
    const go = () => focus.sec.scrollIntoView({ block: "start", behavior: "instant" });
    go();
    let moved = false;
    addEventListener("wheel", () => (moved = true), { once: true, passive: true });
    addEventListener("touchstart", () => (moved = true), { once: true, passive: true });
    addEventListener("keydown", () => (moved = true), { once: true });
    addEventListener("load", () => { if (!moved) go(); }, { once: true });
  }
})();

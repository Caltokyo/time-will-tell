// FIELD LOG — stories within a category, one at a time.
// Vertical scrolling moves between categories; horizontal movement swaps the whole story:
// swipe (touch), the ← → controls, or the arrow keys while focus is inside the category.
// Every story has its own URL (/log/<category>/<slug>/), kept in history.
// A category with one story shows its count (01 / 01), a full step bar and a quiet note that the
// record continues; arrows, page edges, swipe and keys switch on once it holds two or more.
(() => {
  const sections = [...document.querySelectorAll("section[data-log-cat]")];
  if (!sections.length) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const touch = matchMedia("(hover: none) and (pointer: coarse)");
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>';
  const R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>';
  const frag = (html) => document.createRange().createContextualFragment(html);
  const cats = new Map();

  sections.forEach((sec) => {
    const arts = [...sec.querySelectorAll(":scope > .log-article")];
    const i = Math.max(0, arts.findIndex((a) => a.classList.contains("is-active")));
    const c = { key: sec.dataset.logCat, sec, arts, i, name: sec.querySelector(".log-name").textContent.trim() };
    cats.set(c.key, c);
    if (arts.length < 2) { single(c); return; }
    build(c);
    render(c);

    sec.addEventListener("click", (e) => {
      const b = e.target.closest("[data-log-step]");
      if (b && sec.contains(b)) step(c, Number(b.dataset.logStep));
    });
    sec.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (step(c, e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
    });
    // Desktop: pointing at "next" lets the current story lean towards it.
    sec.addEventListener("mouseover", (e) => sec.classList.toggle("is-peek", !!e.target.closest('[data-log-step="1"]:not(:disabled)')));
    sec.addEventListener("mouseleave", () => sec.classList.remove("is-peek"));
    swipe(c);
  });

  // ---------- controls ----------

  // One story: count and bar only — nothing to step to, so no buttons and no swipe.
  function single(c) {
    c.sec.querySelector(".log-margin").appendChild(frag(`
      <div class="log-nav log-nav--single" role="group" aria-label="${esc(c.name)} — stories">
        <div class="log-pager"><span class="log-pager-count"><span data-log-current>01</span> / 01</span></div>
        <span class="log-steps" aria-hidden="true"><i class="is-on"></i></span>
        <p class="log-continues">THE RECORD CONTINUES <span lang="ja">— 記録は続く。</span></p>
      </div>`));
  }

  function build(c) {
    const n = c.arts.length;
    const label = esc(c.name);
    // 1. Log margin: ← 01 / 03 →, a step bar and a short hint.
    c.sec.querySelector(".log-margin").appendChild(frag(`
      <div class="log-nav" role="group" aria-label="${label} — stories">
        <div class="log-pager">
          <button type="button" class="log-pager-btn" data-log-step="-1" aria-label="Previous story">${L}</button>
          <span class="log-pager-count"><span data-log-current></span> / ${pad(n)}</span>
          <button type="button" class="log-pager-btn" data-log-step="1" aria-label="Next story">${R}</button>
        </div>
        <span class="log-steps" aria-hidden="true">${"<i></i>".repeat(n)}</span>
        <button type="button" class="log-hint" tabindex="-1" aria-hidden="true"></button>
      </div>`));
    // 2. Page edges: the stories still to come stack up at the right edge, read ones at the left.
    c.sec.appendChild(frag(`
      <div class="log-edge log-edge--prev" aria-hidden="true"><span class="log-edge-pages"></span><button type="button" class="log-edge-tab" tabindex="-1" data-log-step="-1"><span>PREV STORY</span><b></b>${L}</button></div>
      <div class="log-edge log-edge--next" aria-hidden="true"><span class="log-edge-pages"></span><button type="button" class="log-edge-tab" tabindex="-1" data-log-step="1"><span>NEXT STORY</span><b></b>${R}</button></div>`));
    // 3. After the story: where to go next.
    c.sec.appendChild(frag(`
      <nav class="log-foot" aria-label="${label} — more stories">
        <button type="button" class="log-foot-item prev" data-log-step="-1"><span class="log-foot-meta mono"><span>← PREV STORY</span><b></b></span><span class="log-foot-title"></span></button>
        <button type="button" class="log-foot-item next" data-log-step="1"><span class="log-foot-meta mono"><span>NEXT STORY →</span><b></b></span><span class="log-foot-title"></span></button>
      </nav>`));
    c.live = document.createElement("span");
    c.live.className = "log-live";
    c.live.setAttribute("aria-live", "polite");
    c.sec.appendChild(c.live);
  }

  function render(c) {
    const n = c.arts.length;
    const j = c.i;
    const s = c.sec;
    const has = { "-1": j > 0, "1": j < n - 1 };
    const no = (k) => `${pad(k + 1)} / ${pad(n)}`;
    const focused = document.activeElement;

    s.querySelector("[data-log-current]").textContent = pad(j + 1);
    s.querySelectorAll(".log-steps i").forEach((d, k) => d.classList.toggle("is-on", k === j));
    s.querySelectorAll(".log-pager-btn").forEach((b) => (b.disabled = !has[b.dataset.logStep]));

    const hint = s.querySelector(".log-hint");
    const dir = has[1] ? 1 : -1;
    hint.dataset.logStep = dir;
    hint.textContent = dir > 0
      ? (touch.matches ? "SWIPE / NEXT STORY →" : "NEXT STORY →")
      : (touch.matches ? "← SWIPE / PREV STORY" : "← PREV STORY");

    s.style.setProperty("--log-done", j);
    s.style.setProperty("--log-rest", n - 1 - j);
    s.querySelectorAll(".log-edge").forEach((e) => {
      const d = e.classList.contains("log-edge--next") ? 1 : -1;
      e.hidden = !has[d];
      e.querySelector("b").textContent = has[d] ? no(j + d) : "";
    });

    s.querySelectorAll(".log-foot-item").forEach((b) => {
      const d = Number(b.dataset.logStep);
      b.hidden = !has[d];
      if (!has[d]) return;
      b.querySelector("b").textContent = no(j + d);
      b.querySelector(".log-foot-title").textContent = c.arts[j + d].dataset.title;
    });

    if (focused && focused.closest && s.contains(focused) && (focused.disabled || focused.closest("[hidden]"))) {
      (s.querySelector(".log-pager-btn:not(:disabled)") || s).focus();
    }
  }

  const titleOf = (c, a) => `${a.dataset.title} — FIELD LOG / ${c.name} — TIME WILL TELL.`;
  const snapshot = () => Object.fromEntries([...cats.values()].map((c) => [c.key, c.arts[c.i].dataset.slug]));

  function show(c, j, { dir = 0, push = false } = {}) {
    if (j < 0 || j >= c.arts.length || j === c.i) return false;
    const prev = c.arts[c.i];
    const next = c.arts[j];
    prev.classList.remove("is-active", "is-enter-next", "is-enter-prev", "is-nudge");
    next.classList.remove("is-enter-next", "is-enter-prev");
    next.classList.add("is-active");
    if (dir && !reduce.matches) {
      void next.offsetWidth;
      next.classList.add(dir > 0 ? "is-enter-next" : "is-enter-prev");
    }
    c.i = j;
    c.sec.setAttribute("aria-labelledby", next.dataset.heading);
    c.sec.querySelectorAll("[data-log-for]").forEach((s) => (s.hidden = s.dataset.logFor !== next.dataset.slug));
    // The story itself animates in; its contents should not fade in a second time.
    next.querySelectorAll(".reveal").forEach((r) => r.classList.add("is-in"));
    render(c);
    c.live.textContent = `${pad(j + 1)} / ${pad(c.arts.length)} — ${next.dataset.title}`;

    if (push) {
      // Stories differ in height: if the reader is mid-story, show the new one from its top.
      const top = c.sec.getBoundingClientRect().top;
      if (top < 0) scrollTo({ top: scrollY + top, behavior: reduce.matches ? "instant" : "smooth" });
      const title = titleOf(c, next);
      document.title = title;
      history.pushState({ ...history.state, twtLog: snapshot(), title }, "", next.dataset.url);
    }
    return true;
  }

  const step = (c, d) => show(c, c.i + d, { dir: d, push: true });

  // Horizontal swipe. The story keeps native vertical panning (touch-action: pan-y), so a
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
      if (e.touches.length !== 1 || e.target.closest("a, button, input, iframe")) return;
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
      art().classList.remove("is-nudge");
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

  // The first time a category with more stories comes into view, the story leans
  // briefly towards the next one — once per page, never with reduced motion.
  if (!reduce.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const c = cats.get(e.target.dataset.logCat);
      if (c.i >= c.arts.length - 1) return;
      const a = c.arts[c.i];
      setTimeout(() => {
        if (!a.classList.contains("is-active") || a.classList.contains("is-dragging")) return;
        a.classList.add("is-nudge");
        c.sec.classList.add("is-nudge");
        a.addEventListener("animationend", () => { a.classList.remove("is-nudge"); c.sec.classList.remove("is-nudge"); }, { once: true });
      }, 500);
    }), { threshold: 0.35 });
    for (const c of cats.values()) if (c.arts.length > 1) io.observe(c.sec);
  }

  // History: Back / Forward restore every category's story as it was.
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

  // A story's own page (/log/<category>/<slug>/) opens at that category.
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

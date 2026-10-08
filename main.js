(() => {
  document.documentElement.classList.add("js");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

  // Deterministic PRNG so drawings are identical on every load
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // Closed wobbly ring as a smooth path
  function ring(cx, cy, r, wobble, phase, steps = 72) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const k = 1
        + wobble[0] * Math.sin(2 * a + phase[0])
        + wobble[1] * Math.sin(3 * a + phase[1])
        + wobble[2] * Math.sin(5 * a + phase[2]);
      pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.78]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < steps; i++) {
      const p0 = pts[(i - 1 + steps) % steps], p1 = pts[i], p2 = pts[(i + 1) % steps], p3 = pts[(i + 2) % steps];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + "Z";
  }

  // FIG. 001 — survey map
  const map = document.getElementById("survey-map");
  if (map) {
    const r = rng(1959);
    for (let x = 0; x <= 1000; x += 100) el("line", { x1: x, y1: 0, x2: x, y2: 760, class: "grid-line" }, map);
    for (let y = 0; y <= 760; y += 100) el("line", { x1: 0, y1: y, x2: 1000, y2: y, class: "grid-line" }, map);

    const hills = [[380, 400, 15, 32], [760, 240, 9, 30], [820, 620, 6, 26]];
    hills.forEach(([cx, cy, n, step]) => {
      const w = [r() * 0.12, r() * 0.08, r() * 0.04];
      for (let i = n; i >= 1; i--) {
        const ph = [r() * 0.5 + i * 0.07, r() * 0.5 + i * 0.11, r() * 6];
        el("path", { d: ring(cx + i * 2.5, cy - i * 1.5, i * step, w, ph), class: i % 5 === 0 ? "contour index-line" : "contour" }, map);
      }
    });

    // Road (dashed) and coastline-ish edge
    el("path", { d: "M-10 690 C 180 640, 260 560, 520 590 S 900 520, 1010 470", class: "ink thin dash" }, map);

    // Plotted points
    const pts = [[352, 386], [412, 430], [300, 452], [640, 560], [742, 236], [212, 210], [560, 300]];
    pts.forEach(([x, y], i) => {
      el("circle", { cx: x, cy: y, r: i === 0 ? 7 : 4, class: "dot" }, map);
      const t = el("text", { x: x + 10, y: y - 8 }, map);
      t.textContent = i === 0 ? "P-001" : `P-0${String(i + 1).padStart(2, "0")}`;
    });

    // Crosshair on P-001
    el("path", { d: "M352 330V362M352 410V442M296 386H328M376 386H408", class: "ink" }, map);
    el("circle", { cx: 352, cy: 386, r: 30, class: "ink thin" }, map);

    // North arrow + scale bar
    el("path", { d: "M940 120 L952 80 L964 120 L952 110 Z", class: "ink" }, map);
    const n = el("text", { x: 946, y: 70 }, map); n.textContent = "N";
    el("path", { d: "M40 720H240M40 712v16M140 716v8M240 712v16", class: "ink" }, map);
    const s = el("text", { x: 40, y: 704 }, map); s.textContent = "0          ███ m";
  }

  // FIG. 006 — field sketch: vegetation stipple, an empty clearing, a path in
  const sketch = document.getElementById("field-sketch");
  if (sketch) {
    const r = rng(6);
    const inClearing = (x, y) => ((x - 420) / 170) ** 2 + ((y - 470) / 150) ** 2 < 1;
    const onPath = (x, y) => Math.abs(x - (120 + (y - 900) * -0.55 + Math.sin(y / 90) * 30)) < 26 && y > 560;
    for (let i = 0; i < 1500; i++) {
      const x = r() * 800, y = r() * 900;
      if (inClearing(x, y) || onPath(x, y)) continue;
      const k = r();
      if (k > 0.55) {
        // grass / shrub tick
        const s = 3 + r() * 4;
        el("path", { d: `M${(x - s).toFixed(1)} ${y.toFixed(1)}l${s.toFixed(1)} ${(-s * 1.4).toFixed(1)}l${s.toFixed(1)} ${(s * 1.4).toFixed(1)}`, class: "ink thin", opacity: 0.6 }, sketch);
      } else {
        el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: k > 0.5 ? 2.6 : 1.1, fill: "#111110", opacity: 0.6 }, sketch);
      }
    }
    el("path", { d: ring(420, 470, 175, [0.05, 0.04, 0.02], [0.4, 1.2, 2]), class: "ink thin dash" }, sketch);
    el("path", { d: "M-20 900 C 80 800, 130 700, 280 590", class: "ink thin dash" }, sketch);
    el("circle", { cx: 420, cy: 470, r: 5, class: "dot" }, sketch);
    [["A", 110, 120], ["B", 650, 160], ["C", 690, 760]].forEach(([l, x, y]) => {
      const t = el("text", { x, y }, sketch); t.textContent = l;
    });
    const c = el("text", { x: 434, y: 466 }, sketch); c.textContent = "?";
  }

  // FIG. 09.7 — survey points
  const sp = document.getElementById("site-points");
  if (sp) {
    const r = rng(97);
    for (let x = 0; x <= 800; x += 50) el("line", { x1: x, y1: 0, x2: x, y2: 300, class: "grid-line" }, sp);
    for (let y = 0; y <= 300; y += 50) el("line", { x1: 0, y1: y, x2: 800, y2: y, class: "grid-line" }, sp);
    const pts = [];
    for (let i = 0; i < 26; i++) pts.push([40 + r() * 720, 30 + r() * 240]);
    pts.sort((a, b) => a[0] - b[0]);
    el("path", { d: "M" + pts.filter((_, i) => i % 3 === 0).map((p) => p.map((v) => v.toFixed(0)).join(" ")).join("L"), class: "ink thin dash" }, sp);
    pts.forEach(([x, y], i) => {
      el("path", { d: `M${x - 5} ${y}h10M${x} ${y - 5}v10`, class: "ink thin" }, sp);
      if (i % 4 === 0) {
        const t = el("text", { x: x + 8, y: y - 6 }, sp);
        t.textContent = `+${(r() * 30 + 4).toFixed(2)}`;
      }
    });
    el("rect", { x: 560, y: 90, width: 170, height: 120, class: "redact-box" }, sp);
  }

  // Reveal on view (quiet)
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
  document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

  // 05 — "Remove them one by one."
  const strike = document.querySelector("[data-strike]");
  if (strike) {
    const items = [...strike.children];
    const so = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      items.forEach((li, i) => setTimeout(() => li.classList.add("gone"), reduceMotion ? 0 : 500 + i * 650));
      so.disconnect();
    }, { threshold: 0.6 });
    so.observe(strike);
  }

  // Top bar inverts over dark sections
  const bar = document.querySelector(".bar");
  const darks = [...document.querySelectorAll(".sec-dark")];
  const onScroll = () => {
    const y = bar.offsetHeight / 2;
    bar.classList.toggle("on-dark", darks.some((d) => {
      const b = d.getBoundingClientRect();
      return b.top <= y && b.bottom >= y;
    }));
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.getElementById("year").textContent = new Date().getFullYear();

  // FOLLOW THE PROJECT — Field Notes form + Instagram link
  const form = document.getElementById("notes-form");
  const statusEl = document.getElementById("notes-status");
  const MESSAGES = {
    subscribed: ["ok", "RECORDED. You will receive the next Field Notes.", "登録しました。次のField Notesをお送りします。"],
    duplicate: ["warn", "ALREADY RECORDED. This address is already on the list.", "このメールアドレスは登録済みです。"],
    invalid_email: ["error", "Please enter a valid email address.", "正しいメールアドレスを入力してください。"],
    rate_limited: ["error", "Too many attempts. Please try again later.", "試行回数が多すぎます。時間をおいて再度お試しください。"],
    not_configured: ["warn", "Registration is not open yet.", "現在、登録は受け付けていません。"],
    error: ["error", "Something went wrong. Please try again later.", "エラーが発生しました。時間をおいて再度お試しください。"],
  };
  const showStatus = (key) => {
    const [tone, en, ja] = MESSAGES[key] || MESSAGES.error;
    statusEl.dataset.tone = tone;
    statusEl.textContent = en;
    const j = document.createElement("span");
    j.className = "ja";
    j.lang = "ja";
    j.textContent = ja;
    statusEl.appendChild(j);
  };
  const closeForm = () => {
    form.dataset.state = "closed";
    form.querySelectorAll("input, button").forEach((n) => (n.disabled = true));
    showStatus("not_configured");
  };

  const ig = document.getElementById("ig-button");
  fetch("/api/config", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((cfg) => {
      if (cfg.subscribeEnabled === false) closeForm();
      if (typeof cfg.instagramUrl === "string" && /^https:\/\/(www\.)?instagram\.com\/./.test(cfg.instagramUrl)) {
        ig.href = cfg.instagramUrl;
        ig.classList.remove("is-disabled");
        ig.removeAttribute("aria-disabled");
        ig.removeAttribute("role");
        document.getElementById("ig-sub").textContent = "Instagram でフォロー";
      }
    })
    .catch(() => { /* config unavailable: keep Instagram disabled; the form reports errors on submit */ });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.state === "sending" || form.dataset.state === "closed") return;
    const email = form.email.value.trim();
    if (!email || !form.email.checkValidity()) { showStatus("invalid_email"); form.email.focus(); return; }
    form.dataset.state = "sending";
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, website: form.website.value }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.status === "subscribed" || data.status === "duplicate") {
        showStatus(data.status);
        if (data.status === "subscribed") form.email.value = "";
      } else if (data.code === "not_configured") {
        closeForm();
        return;
      } else {
        showStatus(MESSAGES[data.code] ? data.code : "error");
      }
    } catch {
      showStatus("error");
    }
    form.dataset.state = "";
  });
})();

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  // Dial ticks
  const ticks = document.getElementById("dial-ticks");
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "200");
    line.setAttribute("x2", "200");
    line.setAttribute("y1", "6");
    line.setAttribute("y2", major ? "28" : "16");
    line.setAttribute("class", major ? "tick major" : "tick");
    line.setAttribute("transform", `rotate(${i * 6} 200 200)`);
    ticks.appendChild(line);
  }

  // Live Tokyo clock + dial hands
  const clock = document.getElementById("clock");
  const date = document.getElementById("date");
  const hands = {
    h: document.getElementById("hand-h"),
    m: document.getElementById("hand-m"),
    s: document.getElementById("hand-s"),
  };
  const tokyoParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

  function tick() {
    const now = new Date();
    const p = Object.fromEntries(tokyoParts.formatToParts(now).map((x) => [x.type, x.value]));
    const h = Number(p.hour) % 24, m = Number(p.minute), s = Number(p.second);
    const ms = reduceMotion ? 0 : now.getMilliseconds();
    clock.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    date.textContent = `${p.year}.${p.month}.${p.day}`;
    const sec = s + ms / 1000;
    hands.s.setAttribute("transform", `rotate(${sec * 6} 200 200)`);
    hands.m.setAttribute("transform", `rotate(${(m + sec / 60) * 6} 200 200)`);
    hands.h.setAttribute("transform", `rotate(${((h % 12) + m / 60) * 30} 200 200)`);
  }
  tick();
  if (reduceMotion) setInterval(tick, 1000);
  else (function loop() { tick(); requestAnimationFrame(loop); })();

  // Split statement into characters for scroll-lit reading effect
  const statement = document.querySelector("[data-words]");
  const chars = [];
  if (statement) {
    const text = statement.textContent.trim();
    statement.textContent = "";
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = ch;
      statement.appendChild(span);
      chars.push(span);
    }
  }

  // Scroll-driven: progress bar, statement lighting
  const bar = document.getElementById("progress-bar");
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

    if (statement) {
      const r = statement.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const lit = Math.round(t * chars.length);
      chars.forEach((c, i) => c.classList.toggle("lit", i < lit));
    }
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // Reveal on view + count-up numbers
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target.toLocaleString("en-US"); return; }
    const start = performance.now(), dur = 1800;
    (function step(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4))).toLocaleString("en-US");
      if (t < 1) requestAnimationFrame(step);
    })(start);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Magnetic button
  if (!reduceMotion && matchMedia("(hover: hover)").matches) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  // Footer
  document.getElementById("year").textContent = new Date().getFullYear();
  const elapsed = document.getElementById("footer-elapsed");
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    elapsed.textContent = `You’ve been here ${s >= 60 ? `${Math.floor(s / 60)}m ` : ""}${s % 60}s.`;
  }, 1000);
})();

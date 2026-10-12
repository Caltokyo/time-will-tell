// FOLLOW THE PROJECT — a quiet invitation to FIELD NOTES (email).
// Not a modal: a small card that appears once the reader has reached PART II (the field log),
// never over the FOLLOW THE PROJECT section itself, and not again for 30 days once closed.
// It posts to the same /api/subscribe as the form on the page and only reports what the
// server answers — never a success it did not receive.
(() => {
  const KEY = "twt-follow-popup";
  const SNOOZE_DAYS = 30;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const follow = document.getElementById("follow-the-project");
  if (!("IntersectionObserver" in window)) return;

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify({ ...store.get(), ...v })); } catch { /* storage unavailable */ } },
  };
  const saved = store.get();
  if (saved.subscribed) return;
  if (saved.closedAt && Date.now() - saved.closedAt < SNOOZE_DAYS * 864e5) return;

  const MESSAGES = {
    subscribed: ["ok", "RECORDED. A confirmation email is on its way.", "登録しました。確認メールをお送りしました。"],
    duplicate: ["warn", "ALREADY RECORDED. This address is already on the list.", "このメールアドレスは登録済みです。"],
    invalid_email: ["error", "Please enter a valid email address.", "正しいメールアドレスを入力してください。"],
    rate_limited: ["error", "Too many attempts. Please try again later.", "試行回数が多すぎます。時間をおいて再度お試しください。"],
    not_configured: ["warn", "Registration is not open yet.", "現在、登録は受け付けていません。"],
    send_failed: ["error", "The confirmation email could not be sent. Please try again later.", "確認メールを送信できませんでした。時間をおいて再度お試しください。"],
    error: ["error", "Something went wrong. Please try again later.", "エラーが発生しました。時間をおいて再度お試しください。"],
  };

  let open = false;
  let followInView = false;
  let el;

  function build() {
    el = document.createElement("aside");
    el.className = "fp";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.setAttribute("aria-labelledby", "fp-title");
    el.hidden = true;
    el.innerHTML = `
      <button type="button" class="fp-close" aria-label="Close">×</button>
      <p id="fp-title" class="fp-title">FOLLOW THE PROJECT.</p>
      <div class="pair fp-lead">
        <p>Some things will not appear on this website.</p>
        <p class="ja" lang="ja">このサイトでは公開しない記録も、メールでお届けします。</p>
      </div>
      <form class="fp-form" novalidate>
        <label class="field-label mono" for="fp-email">EMAIL <span class="ja-inline">メールアドレス</span></label>
        <div class="field-row">
          <input id="fp-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="you@example.com" />
          <button type="submit" class="notes-submit fp-submit">SUBSCRIBE →</button>
        </div>
        <div class="hp" aria-hidden="true"><label for="fp-website">Website</label><input id="fp-website" name="website" type="text" tabindex="-1" autocomplete="off" /></div>
        <p class="notes-status fp-status" role="status" aria-live="polite"></p>
      </form>
      <p class="fp-note mono">IRREGULAR. ONLY WHEN THERE IS SOMETHING TO RECORD.</p>`;
    document.body.appendChild(el);

    const form = el.querySelector("form");
    const status = el.querySelector(".fp-status");
    const show = (key) => {
      const [tone, en, ja] = MESSAGES[key] || MESSAGES.error;
      status.dataset.tone = tone;
      status.textContent = en;
      const j = document.createElement("span");
      j.className = "ja";
      j.lang = "ja";
      j.textContent = ja;
      status.appendChild(j);
    };

    el.querySelector(".fp-close").addEventListener("click", () => close(true));
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(true); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.dataset.state === "sending") return;
      const email = form.email.value.trim();
      if (!email || !form.email.checkValidity()) { show("invalid_email"); form.email.focus(); return; }
      form.dataset.state = "sending";
      try {
        const r = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, website: form.website.value }),
        });
        const data = await r.json().catch(() => ({}));
        if (data.status === "subscribed" || data.status === "duplicate") {
          show(data.status);
          store.set({ subscribed: true });
          if (data.status === "subscribed") form.email.value = "";
        } else {
          show(MESSAGES[data.code] ? data.code : "error");
        }
      } catch {
        show("error");
      }
      form.dataset.state = "";
    });
  }

  function openPopup() {
    if (open || followInView) return;
    if (!el) build();
    open = true;
    el.hidden = false;
    if (!reduce.matches) {
      void el.offsetWidth;
      el.classList.add("is-in");
    } else {
      el.classList.add("is-in", "no-motion");
    }
  }

  function close(byReader) {
    if (!open) return;
    open = false;
    el.classList.remove("is-in");
    const done = () => { el.hidden = true; };
    if (reduce.matches) done(); else setTimeout(done, 400);
    if (byReader) {
      store.set({ closedAt: Date.now() });
      stopTriggers();
    }
  }

  // Registration closed on the server: never invite.
  let allowed = true;
  fetch("/api/config", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => { if (cfg && cfg.subscribeEnabled === false) { allowed = false; close(false); stopTriggers(); } })
    .catch(() => {});

  // First eligible trigger: 45 seconds on page OR 70% reading progress.
  // Suppress while the inline signup is visible, and never reopen after dismissal.
  let eligible = false;
  let timer;
  function stopTriggers() {
    clearTimeout(timer);
    window.removeEventListener("scroll", checkProgress);
    window.removeEventListener("resize", checkProgress);
    observer.disconnect();
  }
  function requestPopup() {
    if (!allowed || store.get().subscribed) return;
    const closedAt = store.get().closedAt;
    if (closedAt && Date.now() - closedAt < SNOOZE_DAYS * 864e5) return;
    eligible = true;
    if (!followInView) openPopup();
  }
  function checkProgress() {
    const doc = document.documentElement;
    const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
    if (maxScroll > 0 && window.scrollY / maxScroll >= 0.7) requestPopup();
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      followInView = entry.isIntersecting;
      if (followInView) close(false);
      else if (eligible) requestPopup();
    }
  });
  if (follow) observer.observe(follow);
  timer = setTimeout(requestPopup, 45000);
  window.addEventListener("scroll", checkProgress, { passive: true });
  window.addEventListener("resize", checkProgress);
  checkProgress();
})();

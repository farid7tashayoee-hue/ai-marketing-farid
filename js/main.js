/* ============================================================
   main.js — interactions, i18n switching, animations
   ============================================================ */

(function () {
  "use strict";

  let currentLang = "en";
  let typeTimer = null;

  /* ---------- Language ---------- */
  function applyLang(lang) {
    const dict = I18N[lang];
    if (!dict) return;
    currentLang = lang;

    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;
    document.body.classList.toggle("lang-fa", lang === "fa");

    // text nodes
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });
    // placeholders
    document.querySelectorAll("[data-ph]").forEach((el) => {
      const key = el.getAttribute("data-ph");
      if (dict[key] != null) el.placeholder = dict[key];
    });

    // active button
    document.querySelectorAll(".lang-btn").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.lang === lang)
    );

    try { localStorage.setItem("ft_lang", lang); } catch (e) {}

    startTypewriter(dict.roles);
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });

  /* ---------- Typewriter ---------- */
  function startTypewriter(words) {
    const el = document.getElementById("typewriter");
    if (!el || !words || !words.length) return;
    clearTimeout(typeTimer);

    let w = 0, c = 0, deleting = false;
    function tick() {
      const word = words[w % words.length];
      el.textContent = word.slice(0, c);
      if (!deleting) {
        if (c < word.length) { c++; typeTimer = setTimeout(tick, 75); }
        else { deleting = true; typeTimer = setTimeout(tick, 1600); }
      } else {
        if (c > 0) { c--; typeTimer = setTimeout(tick, 35); }
        else { deleting = false; w++; typeTimer = setTimeout(tick, 250); }
      }
    }
    tick();
  }

  /* ---------- Navbar scroll state ---------- */
  const nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById("burger");
  const links = document.querySelector(".nav__links");
  burger.addEventListener("click", () => links.classList.toggle("open"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("open"))
  );

  /* ---------- Hero reveal on load ---------- */
  window.addEventListener("load", () => {
    document.querySelectorAll(".hero .reveal").forEach((el) => el.classList.add("in"));
  });

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal-up").forEach((el) => io.observe(el));

  /* ---------- Counter animation ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.count;
      const prefix = el.dataset.prefix || "";
      const dur = 1400;
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.floor(eased * target).toLocaleString(currentLang === "fa" ? "fa-IR" : "en-US");
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = prefix + target.toLocaleString(currentLang === "fa" ? "fa-IR" : "en-US");
      }
      requestAnimationFrame(step);
      cio.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach((el) => cio.observe(el));

  /* ---------- Contact form ---------- */
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector("button[type=submit]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = data.get("name") || "";
    const email = data.get("email") || "";
    const message = data.get("message") || "";

    submitBtn.disabled = true;
    status.className = "contact__status";
    status.textContent = I18N[currentLang].form_sending || "Sending...";

    const error = await saveContact(name, email, message);
    await saveLead(email);

    submitBtn.disabled = false;
    if (error) {
      status.textContent = I18N[currentLang].form_error || "Something went wrong. Please try again.";
      status.className = "contact__status error";
    } else {
      status.textContent = I18N[currentLang].form_ok;
      status.className = "contact__status success";
      form.reset();
    }
  });

  /* ---------- Init ---------- */
  let saved = "en";
  try { saved = localStorage.getItem("ft_lang") || "en"; } catch (e) {}
  applyLang(saved);
})();

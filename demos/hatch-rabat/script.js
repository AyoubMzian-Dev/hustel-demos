/* ==========================================================================
   F&B landing template — vanilla JS.
   Everything is data-driven:
     - config.json      → business data + theme (colors, fonts, radius)
     - locales/<l>.json → all copy per language
   Languages: Arabic → French → English (priority configurable in LANGS).
   The visitor's device language is auto-detected; manual choice persists.
   ========================================================================== */

const LANGS = ["ar", "fr", "en"]; // priority order: Arabic → French → English

let CONFIG = {
  business_name: "Café Kora",
  primary_action: "visit", // "visit" | "order" | "reserve"
  address_query: "Café Kora, Boulevard d’Anfa, Casablanca",
  whatsapp: "2250700000000",
  delivery_link: "", // e.g. Glovo/Jumia URL — empty hides the delivery line
  hours: {
    // 0 = Sunday … 6 = Saturday; times in 24h local
    0: [["08:00", "20:00"]],
    1: [["07:30", "22:00"]],
    2: [["07:30", "22:00"]],
    3: [["07:30", "22:00"]],
    4: [["07:30", "22:00"]],
    5: [["07:30", "23:00"]],
    6: [["08:00", "23:00"]],
  },
};

let LOCALE = { ar: {}, fr: {}, en: {} };

/* ---------- storage probe (must precede detectLang) ---------- */
function storageAvailable() {
  try {
    localStorage.setItem("__t", "1");
    localStorage.removeItem("__t");
    return true;
  } catch { return false; }
}
const HAS_STORAGE = storageAvailable();

let LANG = detectLang();

function t(key) {
  return LOCALE[LANG][key] ?? LOCALE.fr[key] ?? LOCALE.en[key] ?? key;
}

/* ---------- data loading ----------
   Prefers window globals injected by config.js / locales/*.js (works from
   file://, where fetch of local JSON is blocked); falls back to fetch for
   setups that serve the JSON directly. */
async function loadConfig() {
  try {
    if (window.__HUSTEL_CONFIG__) {
      Object.assign(CONFIG, window.__HUSTEL_CONFIG__);
    } else {
      const r = await fetch("config.json");
      if (r.ok) {
        const data = await r.json();
        Object.assign(CONFIG, data);
      }
    }
  } catch { /* offline — fall back to inline defaults */ }
  // Build a maps query from structured fields if not provided explicitly
  if (!CONFIG.address_query && CONFIG.address) {
    CONFIG.address_query = `${CONFIG.business_name}, ${CONFIG.address}, ${CONFIG.city || ""}`;
  }
}

async function loadLocales() {
  const globals = window.__HUSTEL_LOCALES__ || {};
  await Promise.all(LANGS.map(async (lang) => {
    if (globals[lang] && Object.keys(globals[lang]).length) {
      LOCALE[lang] = globals[lang];
      return;
    }
    try {
      const r = await fetch(`locales/${lang}.json`);
      if (r.ok) LOCALE[lang] = await r.json();
    } catch { /* keep empty dict for this language */ }
  }));
}

/* ---------- theme from config.json ---------- */
const THEME_VAR_MAP = {
  primary: "--color-primary",
  primary_dark: "--color-primary-dark",
  accent: "--color-accent",
  accent_soft: "--color-accent-soft",
  bg: "--color-bg",
  surface: "--color-surface",
  text: "--color-text",
  text_muted: "--color-text-muted",
  border: "--color-border",
  open: "--color-open",
  closed: "--color-closed",
  dark_section: "--color-dark-section",
};

function applyTheme(theme) {
  if (!theme) return;
  const rules = [];
  for (const [key, cssVar] of Object.entries(THEME_VAR_MAP)) {
    if (theme.colors?.[key]) rules.push(`${cssVar}: ${theme.colors[key]};`);
  }
  if (theme.radius) rules.push(`--radius: ${theme.radius};`);
  if (!rules.length) return;
  // Injected as a stylesheet (not inline styles) so html[lang="ar"] font
  // overrides in style.css still win where they need to.
  const style = document.createElement("style");
  style.id = "theme-overrides";
  style.textContent = `:root { ${rules.join(" ")} }`;
  document.head.appendChild(style);
}

/* ---------- i18n ---------- */

/* Detect language: saved choice first, then device languages scanned in
   priority order (ar → fr → en); default to first LANGS entry otherwise. */
function detectLang() {
  let saved = null;
  if (HAS_STORAGE) { try { saved = localStorage.getItem("preferred_lang"); } catch {} }
  if (saved && LANGS.includes(saved)) return saved;
  const prefs = navigator.languages || [navigator.language || ""];
  for (const target of LANGS) {
    if (Array.from(prefs).some((l) => String(l).toLowerCase().startsWith(target))) return target;
  }
  return LANGS[0];
}

function applyI18n() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr";
  document.title = t("meta_title");
  const n = CONFIG.review_count || "";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n).replaceAll("{n}", n); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml).replaceAll("{n}", n); });
  document.querySelectorAll(".js-lang").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === LANG));
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  LANG = lang;
  if (HAS_STORAGE) { try { localStorage.setItem("preferred_lang", lang); } catch {} }
  applyI18n();
  updateOpenStatus();
}

function initLangSwitcher() {
  document.querySelectorAll(".js-lang").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
}

/* ---------- CTA wording + smart maps link ---------- */

/* Native-feeling maps link: Apple Maps on Apple devices, Google Maps elsewhere */
function mapsHref() {
  const q = encodeURIComponent(CONFIG.address_query);
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  return isApple
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/* CTA label + href per primary action — wording stays identical everywhere */
function ctaFor(action) {
  switch (action) {
    case "visit":
    default:        return { label: t("cta_visit"), href: mapsHref() };
    case "reserve": return { label: t("cta_reserve"), href: `https://wa.me/${CONFIG.whatsapp}` };
    case "order":   return { label: t("cta_order"), href: `https://wa.me/${CONFIG.whatsapp}` };
  }
}

/* ---------- render business data from config into the page ----------
   The static markup is a no-JS fallback; when config provides data we
   rebuild these blocks so client swaps never require touching HTML. */
const CAT_KEY = {
  "boissons": "cat_drinks",
  "plats": "cat_dishes",
  "desserts": "cat_desserts",
  "pâtisseries": "cat_desserts",
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function starIcons(rating) {
  let out = "";
  for (let i = 1; i <= 5; i++) out += `<svg class="icon${i <= rating ? "" : " is-muted"}"><use href="#i-star"/></svg>`;
  return out;
}

function renderBusinessData() {
  // Business name everywhere it appears
  if (CONFIG.business_name) {
    document.querySelectorAll(".js-business-name").forEach((el) => { el.textContent = CONFIG.business_name; });
  }

  // Contact details
  const tel = String(CONFIG.phone || "").replace(/[^\d+]/g, "");
  document.querySelectorAll(".js-phone").forEach((a) => { if (tel) a.href = "tel:" + tel; });
  const phoneLabel = document.querySelector(".js-phone-label");
  if (phoneLabel && CONFIG.phone) phoneLabel.textContent = CONFIG.phone;
  document.querySelectorAll(".js-wa-link").forEach((a) => { if (CONFIG.whatsapp) a.href = `https://wa.me/${CONFIG.whatsapp}`; });
  const addr = [CONFIG.address, CONFIG.city].filter(Boolean).join(", ");
  if (addr) document.querySelectorAll(".js-address").forEach((el) => { el.textContent = addr; });

  // Ratings
  const avg = CONFIG.rating_average ? String(CONFIG.rating_average).replace(".", ",") : null;
  if (avg) {
    const rt = document.querySelector(".js-rating-text");
    if (rt) rt.textContent = `${avg}/5 · ${t("reviews_of_count").replaceAll("{n}", CONFIG.review_count || "")}`;
    const ra = document.querySelector(".js-rating-avg");
    if (ra) ra.textContent = `${avg}/5`;
  }
}

function renderMenuGroups(container, headingTag, headingClass) {
  if (!container || !Array.isArray(CONFIG.menu_items) || !CONFIG.menu_items.length) return;
  const cats = [];
  const byCat = {};
  for (const it of CONFIG.menu_items) {
    const cat = it.category || "Autres";
    if (!byCat[cat]) { byCat[cat] = []; cats.push(cat); }
    byCat[cat].push(it);
  }
  container.innerHTML = cats.map((cat) => {
    const key = CAT_KEY[String(cat).toLowerCase()];
    const headAttr = key ? ` data-i18n="${key}"` : "";
    const rows = byCat[cat].map((it, i) => `
        <li class="menu-row${i >= 2 ? " is-extra" : ""}">
          <div class="menu-row-text">
            <h4>${esc(it.name)}</h4>
            ${it.description ? `<p>${esc(it.description)}</p>` : ""}
          </div>
          <span class="price">${esc(it.price)}</span>
        </li>`).join("");
    return `
      <div class="menu-category">
        <${headingTag} class="${headingClass}"${headAttr}>${esc(cat)}</${headingTag}>
        <ul class="menu-list">${rows}
        </ul>
      </div>`;
  }).join("\n");
}

function renderFeatures() {
  const grid = document.getElementById("features-grid");
  if (!grid || !Array.isArray(CONFIG.features) || !CONFIG.features.length) return;
  grid.innerHTML = CONFIG.features.map((f) => `
      <article class="feature-card">
        <svg class="icon" aria-hidden="true"><use href="#i-${esc(f.icon)}"/></svg>
        ${f.stat ? `<p class="feature-stat">${esc(f.stat)}</p>` : ""}
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.description || "")}</p>
      </article>`).join("\n");
}

function renderTestimonials() {
  const grid = document.getElementById("reviews-grid");
  if (!grid || !Array.isArray(CONFIG.testimonials) || !CONFIG.testimonials.length) return;
  grid.innerHTML = CONFIG.testimonials.map((rv) => `
      <blockquote class="review-card">
        <p class="stars" aria-label="${rv.rating} étoiles">${starIcons(rv.rating)}</p>
        <p>« ${esc(rv.text)} »</p>
        <footer>— ${esc(rv.author)}, ${esc(rv.source)}</footer>
      </blockquote>`).join("\n");
}

/* ---------- Open / closed status from hours ---------- */
function updateOpenStatus() {
  const el = document.getElementById("open-status");
  if (!el) return;
  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (tm) => { const [h, m] = tm.split(":").map(Number); return h * 60 + m; };

  let open = false;
  for (const [start, end] of CONFIG.hours[String(day)] || []) {
    if (minutes >= toMin(start) && minutes < toMin(end)) { open = true; break; }
  }

  el.classList.toggle("is-open", open);
  el.classList.toggle("is-closed", !open);
  el.textContent = open ? t("status_open") : t("status_closed");

  // Highlight today's row in the hours table
  const row = document.querySelector(`#hours-table tr[data-days="${day}"]`);
  if (row) row.classList.add("is-today");
}

/* ---------- Apply CTA wording to every .js-primary-cta ---------- */
function applyPrimaryCta() {
  const { label, href } = ctaFor(CONFIG.primary_action);
  document.querySelectorAll(".js-primary-cta").forEach((a) => {
    // Write into the label span so the icon is preserved
    const labelEl = a.querySelector(".js-label") || a;
    labelEl.textContent = label;
    a.href = href;
    if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
  });
}

/* ---------- Optional delivery link ---------- */
function applyDeliveryLink() {
  const line = document.querySelector(".js-delivery-line");
  if (!line) return;
  if (CONFIG.delivery_link) {
    line.querySelector(".js-delivery-link").href = CONFIG.delivery_link;
    line.classList.remove("hidden");
  }
}

/* ---------- Mobile nav toggle ---------- */
function initNavToggle() {
  const header = document.querySelector(".site-header");
  const btn = document.getElementById("nav-toggle");
  if (!header || !btn) return;
  btn.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    btn.setAttribute("aria-expanded", String(open));
  });
  header.querySelectorAll(".nav a").forEach((link) =>
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      btn.setAttribute("aria-expanded", "false");
    })
  );
}

/* ---------- Sticky CTA bar: only after hero, hidden near footer ---------- */
function initStickyCta() {
  const bar = document.getElementById("sticky-cta");
  const hero = document.querySelector(".hero");
  const footer = document.querySelector(".site-footer");
  if (!bar || !hero) return; // menu page has no sticky bar

  let ticking = false;
  const update = () => {
    ticking = false;
    const pastHero = window.scrollY > hero.offsetHeight * 0.6;
    const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
    const nearFooter = footerTop < window.innerHeight + 80;
    bar.classList.toggle("is-visible", pastHero && !nearFooter);
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/* ---------- Menu page: back-to-top visibility ---------- */
function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        btn.classList.toggle("is-visible", window.scrollY > 400);
        ticking = false;
      });
    }
  }, { passive: true });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadConfig(), loadLocales()]);
  applyTheme(CONFIG.theme);
  renderBusinessData();
  renderMenuGroups(document.getElementById("menu-groups"), "h3", "");
  renderFeatures();
  renderTestimonials();
  applyI18n();
  initLangSwitcher();
  applyPrimaryCta();
  updateOpenStatus();
  applyDeliveryLink();
  initNavToggle();
  initStickyCta();
  initBackToTop();
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});

const STORAGE_KEY = "site-lang";
const SUPPORTED = ["en", "ms"];
const cache = {};

function getLangPath() {
  // locales/ sits one level up from js/ at site root, same depth from any page
  return "locales";
}

async function loadLocale(lang) {
  if (cache[lang]) return cache[lang];
  const res = await fetch(`${getLangPath()}/${lang}.json`);
  const data = await res.json();
  cache[lang] = data;
  return data;
}

function applyStrings(strings) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (strings[key] !== undefined) {
      el.textContent = strings[key];
    }
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (strings[key] !== undefined) {
      el.innerHTML = strings[key];
    }
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    // format: data-i18n-attr="aria-label:header.themeToggle,title:header.themeToggle"
    const spec = el.getAttribute("data-i18n-attr");
    spec.split(",").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && strings[key] !== undefined) {
        el.setAttribute(attr, strings[key]);
      }
    });
  });
}

/** Drive Google Website Translator for dynamic (database-sourced) content.
    The script is only injected the first time it's actually needed — i.e.
    the first time the page needs a non-English state — so English-only
    visitors never pay the load cost of Google's translate script. */
let googleTranslateReady = null;

function loadGoogleTranslate() {
  if (googleTranslateReady) return googleTranslateReady;

  googleTranslateReady = new Promise((resolve) => {
    window.googleTranslateElementInit = () => {
      new google.translate.TranslateElement(
        { pageLanguage: "en", includedLanguages: "ms", autoDisplay: false },
        "google_translate_element"
      );
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(script);
  });

  return googleTranslateReady;
}

async function setGoogleTranslateLanguage(lang) {
  // Nothing loaded yet and we're headed to English (the page's natural
  // state) — no need to load Google's script at all.
  if (!googleTranslateReady && lang !== "ms") return;

  await loadGoogleTranslate();

  const tryApply = (attemptsLeft) => {
    const combo = document.querySelector(".goog-te-combo");
    if (combo) {
      combo.value = lang === "ms" ? "ms" : "en";
      combo.dispatchEvent(new Event("change"));
      return;
    }
    if (attemptsLeft > 0) {
      setTimeout(() => tryApply(attemptsLeft - 1), 300);
    }
  };
  tryApply(15);
}

function updateToggleUI(lang) {
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
  });
  document.documentElement.setAttribute("lang", lang === "ms" ? "ms" : "en");
}

export async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) lang = "en";
  localStorage.setItem(STORAGE_KEY, lang);
  const strings = await loadLocale(lang);
  applyStrings(strings);
  updateToggleUI(lang);
  await setGoogleTranslateLanguage(lang);
}

export function getCurrentLanguage() {
  return localStorage.getItem(STORAGE_KEY) || "en";
}

export function initLanguageToggle() {
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang-btn");
      setLanguage(lang);
    });
  });
}

export async function initI18n() {
  initLanguageToggle();
  await setLanguage(getCurrentLanguage());
}

initI18n();
// Google Website Translator — used only as a fallback for database-driven
// content (history articles, activities, news/updates) that can't be
// hand-translated ahead of time. Static site chrome is translated by
// js/i18n.js instead; elements covered by i18n carry class="notranslate"
// so Google doesn't double-translate them.
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    {
      pageLanguage: "en",
      includedLanguages: "ms",
      autoDisplay: false,
    },
    "google_translate_element"
  );
}
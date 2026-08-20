import { getCurrentLanguage } from "./i18n.js";

/**
 * Curated list of patience-themed verses shown at random while a page's
 * real content loads. Content is a paraphrased summary of each verse
 * (not a literal quotation of any specific Bible translation).
 */
const VERSES = [
  {
    reference: { en: "Galatians 5:22-23", ms: "Galatia 5:22-23" },
    text: {
      en: "Patience is listed as a fruit of the Holy Spirit, reflecting God's nature working within believers.",
      ms: "Kesabaran adalah sebahagian daripada buah Roh Kudus yang dihasilkan dalam hidup orang beriman.",
    },
  },
  {
    reference: { en: "James 5:7-8", ms: "Yakobus 5:7-8" },
    text: {
      en: "Encourages believers to be patient until the Lord's coming, like a farmer waiting patiently for valuable crops.",
      ms: "Menggesa orang beriman bersabar menantikan kedatangan Tuhan, seperti petani yang sabar menanti hasil tuaian.",
    },
  },
  {
    reference: { en: "Romans 12:12", ms: "Roma 12:12" },
    text: {
      en: "Calls for rejoicing in hope, patience in affliction/tribulation, and faithfulness in prayer.",
      ms: "Mengajar untuk bersukacita dalam pengharapan, bersabar dalam kesusahan, dan tekun berdoa.",
    },
  },
  {
    reference: { en: "Proverbs 15:18", ms: "Amsal 15:18" },
    text: {
      en: "Contrasts a hot-tempered person who stirs up conflict with a patient person who calms a quarrel.",
      ms: "Membezakan orang yang cepat marah yang mencetuskan pertengkaran dengan orang yang sabar yang meredakan perselisihan.",
    },
  },
  {
    reference: { en: "Colossians 3:12-13", ms: "Kolose 3:12-13" },
    text: {
      en: "Urges believers to clothe themselves with compassion, kindness, humility, gentleness, and patience, bearing with one another.",
      ms: "Menggesa umat Tuhan mengenakan belas kasihan, kebaikan, kerendahan hati, kelemahlembutan, dan kesabaran sesama sendiri.",
    },
  },
  {
    reference: { en: "1 Corinthians 13:4", ms: "1 Korintus 13:4" },
    text: {
      en: "States the foundational quality of love: love is patient and kind.",
      ms: "Menegaskan sifat asas kasih: kasih itu sabar dan murah hati.",
    },
  },
  {
    reference: { en: "Ecclesiastes 7:8", ms: "Pengkhotbah 7:8" },
    text: {
      en: "Emphasizes that the end of a matter is better than its beginning, and patience of spirit is better than pride.",
      ms: "Menyatakan bahawa kesudahan sesuatu perkara lebih baik daripada permulaannya, dan orang yang sabar lebih baik daripada orang yang sombong.",
    },
  },
  {
    reference: { en: "Psalm 37:7", ms: "Mazmur 37:7" },
    text: {
      en: "Advises resting in the Lord and waiting patiently for Him rather than fretting over the success of the wicked.",
      ms: "Mengajar untuk berdiam diri di hadapan Tuhan dan menantikan-Nya dengan sabar, tanpa iri hati kepada orang fasik.",
    },
  },
];

const SLOW_THRESHOLD_MS = 7000;
const SLOW_MESSAGE = {
  en: "Page is taking longer than usual…",
  ms: "Laman ini mengambil masa lebih lama daripada biasa…",
};

let overlayEl = null;
let verseEl = null;
let referenceEl = null;
let slowMessageEl = null;
let slowTimer = null;
let chosenVerse = null;
let hidden = false;

function pickVerse() {
  return VERSES[Math.floor(Math.random() * VERSES.length)];
}

function renderVerse(lang) {
  if (!chosenVerse || !verseEl || !referenceEl) return;
  const safeLang = lang === "ms" ? "ms" : "en";
  verseEl.textContent = chosenVerse.text[safeLang];
  referenceEl.textContent = chosenVerse.reference[safeLang];
  if (slowMessageEl) slowMessageEl.textContent = SLOW_MESSAGE[safeLang];
}

function init() {
  overlayEl = document.getElementById("page-loading-overlay");
  if (!overlayEl) return;

  verseEl = overlayEl.querySelector(".page-loading-verse");
  referenceEl = overlayEl.querySelector(".page-loading-reference");
  slowMessageEl = overlayEl.querySelector(".page-loading-slow-message");

  chosenVerse = pickVerse();
  renderVerse(getCurrentLanguage());

  window.addEventListener("site-lang-change", (e) => {
    renderVerse(e.detail?.lang);
  });

  slowTimer = setTimeout(() => {
    slowMessageEl?.classList.add("is-visible");
  }, SLOW_THRESHOLD_MS);
}

/** Call once the page's real content has finished loading (success or
 *  failure — visitors shouldn't be stuck behind the overlay forever just
 *  because Firestore returned an error). Safe to call multiple times. */
export function hideLoadingOverlay() {
  if (hidden) return;
  hidden = true;
  clearTimeout(slowTimer);
  if (!overlayEl) return;
  overlayEl.classList.add("is-hidden");
  overlayEl.addEventListener(
    "transitionend",
    () => overlayEl?.remove(),
    { once: true }
  );
}

init();
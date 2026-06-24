import "./common.js";
import {
  getSiteSettings,
  getAboutContent,
} from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

const SECTIONS = [
  { key: "mission", title: "Our Mission", imageKey: "missionImageId" },
  { key: "vision", title: "Our Vision", imageKey: "visionImageId" },
  { key: "values", title: "Core Values", imageKey: "valuesImageId" },
];

async function renderAbout(about) {
  const container = document.getElementById("about-content");
  if (!container) return;

  const sections = await Promise.all(
    SECTIONS.map(async (s) => ({
      ...s,
      imageUrl: about[s.imageKey] ? await getImageUrl(about[s.imageKey]) : null,
    }))
  );

  container.innerHTML = `
    <div class="about-grid">
      ${sections
        .map(
          (s) => `
        <div class="about-block">
          ${
            s.imageUrl
              ? `<div class="about-block-image"><img src="${s.imageUrl}" alt="${s.title}" loading="lazy" /></div>`
              : ""
          }
          <h2>${s.title}</h2>
          <p>${escapeHtml(about[s.key] || "")}</p>
        </div>`
        )
        .join("")}
    </div>`;

  const note = document.getElementById("contact-note");
  if (note) note.textContent = about.contactNote || "";

  const hero = document.getElementById("about-hero");
  if (hero && about.heroImageId) {
    const url = await getImageUrl(about.heroImageId);
    if (url) {
      hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.45)), url("${url}")`;
      hero.classList.add("page-hero--has-bg");
    }
  }
}

function renderContact(settings) {
  const set = (id, prefix, value) => {
    const el = document.getElementById(id);
    if (el && value) el.textContent = `${prefix}${value}`;
  };

  set("contact-address", "📍 ", settings.address);
  set("contact-phone", "📞 ", settings.phone);
  set("contact-email", "✉ ", settings.email);
  set("contact-service", "🕐 ", settings.serviceTimes);
}

async function loadPage() {
  try {
    const [about, settings] = await Promise.all([
      getAboutContent(),
      getSiteSettings(),
    ]);
    await renderAbout(about);
    renderContact(settings);
  } catch (err) {
    console.error("Failed to load about page:", err);
    const container = document.getElementById("about-content");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Unable to load church information. Please check your Firebase configuration.</p>
        </div>`;
    }
  }
}

loadPage();

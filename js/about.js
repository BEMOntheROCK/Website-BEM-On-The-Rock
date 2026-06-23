import "./common.js";
import {
  getSiteSettings,
  getAboutContent,
} from "./firebase-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

const SECTIONS = [
  { key: "history", title: "Our History" },
  { key: "mission", title: "Our Mission" },
  { key: "vision", title: "Our Vision" },
  { key: "values", title: "Core Values" },
];

function renderAbout(about) {
  const container = document.getElementById("about-content");
  if (!container) return;

  container.innerHTML = `
    <div class="about-grid">
      ${SECTIONS.map(
        (s) => `
        <div class="about-block">
          <h2>${s.title}</h2>
          <p>${escapeHtml(about[s.key] || "")}</p>
        </div>`
      ).join("")}
    </div>`;

  const note = document.getElementById("contact-note");
  if (note) note.textContent = about.contactNote || "";
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
    renderAbout(about);
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

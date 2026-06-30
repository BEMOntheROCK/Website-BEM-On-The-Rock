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

// type: "copy"  -> click copies the displayed value to clipboard (no navigation)
// type: "link"  -> click opens the href in a new tab (existing behaviour)
const SOCIALS = [
  { key: "whatsapp", icon: "fa-brands fa-whatsapp", label: "WhatsApp", type: "copy" },
  { key: "officePhone", icon: "fa-solid fa-phone", label: "Office", type: "copy" },
  { key: "instagram", icon: "fa-brands fa-instagram", label: "Instagram", type: "link" },
  { key: "facebook", icon: "fa-brands fa-facebook", label: "Facebook", type: "link" },
  { key: "emailAdmin", icon: "fa-solid fa-envelope", label: "Admin Email", type: "copy" },
  { key: "emailAccount", icon: "fa-solid fa-envelope", label: "Accounts Email", type: "copy" },
  { key: "youtubeSocial", icon: "fa-brands fa-youtube", label: "YouTube", type: "link" },
];

function renderGeneralInfo(about) {
  const container = document.getElementById("general-info");
  if (!container) return;

  const details = [
    { label: "Full Name", value: about.fullName },
    { label: "Denomination", value: about.denomination },
    { label: "Registration No.", value: about.registrationNumber },
  ].filter((d) => d.value);

  const socialItems = SOCIALS.map((s) => {
    const value = about[s.key];
    if (!value) return null;
    return { ...s, value };
  }).filter(Boolean);

  container.innerHTML = `
    <div class="info-section">
      <h2 class="section-title">General Information</h2>
      ${
        details.length
          ? `<dl class="info-list">
        ${details
          .map(
            (d) => `
          <div class="info-row">
            <dt>${escapeHtml(d.label)}</dt>
            <dd>${escapeHtml(d.value)}</dd>
          </div>`
          )
          .join("")}
      </dl>`
          : `<p class="empty-note">General information will be added soon.</p>`
      }
      ${
        about.officeHours
          ? `<div class="office-hours-block">
        <h3>Office Hours</h3>
        <p class="office-hours-text">${escapeHtml(about.officeHours)}</p>
      </div>`
          : ""
      }
      ${
        socialItems.length
          ? `<div class="social-links">
        <h3>Connect With Us</h3>
        <div class="social-links-grid">
          ${socialItems
            .map((s) => {
              if (s.type === "copy") {
                return `
            <button type="button" class="social-link social-link--copy" data-copy-value="${escapeHtml(s.value)}" title="${escapeHtml(s.label)}">
              <span class="social-link-icon"><i class="${s.icon}"></i></span>
              <span class="social-link-label">${escapeHtml(s.value)}</span>
              <span class="copied-tooltip">Copied!</span>
            </button>`;
              }
              return `
            <a href="${escapeHtml(s.value)}" class="social-link" target="_blank" rel="noopener noreferrer" title="${escapeHtml(s.label)}">
              <span class="social-link-icon"><i class="${s.icon}"></i></span>
              <span class="social-link-label">${escapeHtml(s.label)}</span>
            </a>`;
            })
            .join("")}
        </div>
      </div>`
          : ""
      }
    </div>`;

  // Wire up copy-to-clipboard buttons
  container.querySelectorAll("[data-copy-value]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy-value");
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Fallback for browsers without Clipboard API access
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1500);
    });
  });
}

async function renderFounder(about) {
  const container = document.getElementById("founder-section");
  if (!container) return;

  if (!about.founderName && !about.founderBio && !about.founderImageId) {
    container.innerHTML = "";
    return;
  }

  const imageUrl = about.founderImageId
    ? await getImageUrl(about.founderImageId)
    : null;

  container.innerHTML = `
    <div class="founder-section">
      <h2 class="section-title">Our Founder</h2>
      <div class="founder-card">
        ${
          imageUrl
            ? `<div class="founder-image"><img src="${imageUrl}" alt="${escapeHtml(about.founderName || "Founder")}" loading="lazy" /></div>`
            : ""
        }
        <div class="founder-body">
          ${about.founderName ? `<h3>${escapeHtml(about.founderName)}</h3>` : ""}
          ${about.founderBio ? `<p>${escapeHtml(about.founderBio)}</p>` : ""}
        </div>
      </div>
    </div>`;
}

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
    renderGeneralInfo(about);
    await renderFounder(about);
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
import "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";
import { getActivities } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

const SECTIONS = [
  { key: "ministries", label: "Ministries" },
  { key: "activities", label: "Activities" },
];

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function loadPage() {
  const container = document.getElementById("activities-content");
  try {
    const activities = await getActivities();

    if (!activities.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🙏</div>
          <p>Activities and ministries will be published here soon.</p>
        </div>`;
      return;
    }

    // Pre-fetch all activity images in parallel
    const withImages = await Promise.all(
      activities.map(async (item) => ({
        ...item,
        imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
      }))
    );

    // Group by fixed section
    const bySection = {};
    withImages.forEach((item) => {
      const key = item.section;
      if (!key) return;
      if (!bySection[key]) bySection[key] = [];
      bySection[key].push(item);
    });

    // Sort items within each section by order field
    Object.values(bySection).forEach((group) =>
      group.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );

    let html = "";

    // Ministries & Activities, in fixed order
    SECTIONS.forEach((section) => {
      const group = bySection[section.key];
      if (!group || !group.length) return;
      html += `
        <div class="activities-category">
          <h2 class="activities-category-title">${escapeHtml(section.label)}</h2>
          <div class="activities-grid">
            ${group.map((item) => activityCardHtml(item)).join("")}
          </div>
        </div>`;
    });

    container.innerHTML = html || `
      <div class="empty-state">
        <p>Activities and ministries will be published here soon.</p>
      </div>`;

  } catch (err) {
    console.error("Failed to load activities:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p>Unable to load activities. Please check your Firebase configuration.</p>
      </div>`;
  } finally {
    hideLoadingOverlay();
  }
}

function activityCardHtml(item) {
  return `
    <article class="activity-card${item.imageUrl ? "" : " activity-card--no-image"}">
      ${item.imageUrl
        ? `<div class="activity-card-image">
            <img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <div class="activity-card-overlay">
              <h3 class="activity-card-title">${escapeHtml(item.title)}</h3>
              ${item.subtitle ? `<p class="activity-card-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
            </div>
          </div>`
        : `<div class="activity-card-no-img">
            <h3 class="activity-card-title">${escapeHtml(item.title)}</h3>
            ${item.subtitle ? `<p class="activity-card-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
          </div>`
      }
      ${item.description
        ? `<div class="activity-card-body">
            <p>${escapeHtml(item.description)}</p>
          </div>`
        : ""}
    </article>`;
}

loadPage();
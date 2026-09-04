import "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";
import { getActivities, getCommunityContent, getCommunityPhotos } from "./firebase-service.js";
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
    const [activities, communityContent, communityPhotos] = await Promise.all([
      getActivities(),
      getCommunityContent(),
      getCommunityPhotos(),
    ]);

    const hasCommunityContent =
      (communityContent.introText && communityContent.introText.trim()) ||
      communityPhotos.length;

    if (!activities.length && !hasCommunityContent) {
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

    // Community Contributions, always last
    if (hasCommunityContent) {
      html += await communityContributionsHtml(communityContent, communityPhotos);
    }

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

async function communityContributionsHtml(communityContent, photos) {
  const sortedPhotos = [...photos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const withImages = await Promise.all(
    sortedPhotos.map(async (photo) => ({
      ...photo,
      imageUrl: photo.imageId ? await getImageUrl(photo.imageId) : null,
    }))
  );

  return `
    <div class="activities-category">
      <h2 class="activities-category-title">Community Contributions</h2>
      ${communityContent.introText
        ? `<p class="community-intro">${escapeHtml(communityContent.introText)}</p>`
        : ""}
      ${withImages.length
        ? `<div class="community-collage">
            ${withImages.map((photo) => collageItemHtml(photo)).join("")}
          </div>`
        : ""}
    </div>`;
}

function formatCollageDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function collageItemHtml(photo) {
  const size = ["small", "medium", "large"].includes(photo.size) ? photo.size : "small";
  const sizeClass = size === "medium" && photo.orientation === "tall"
    ? "collage-item--medium-tall"
    : size === "medium"
      ? "collage-item--medium-wide"
      : `collage-item--${size}`;
  const formattedDate = formatCollageDate(photo.date);
  return `
    <figure class="collage-item ${sizeClass}" tabindex="0" data-collage-item>
      ${photo.imageUrl
        ? `<img src="${photo.imageUrl}" alt="${escapeHtml(photo.title)}" loading="lazy" />`
        : `<div class="collage-item-placeholder"></div>`}
      <figcaption class="collage-item-caption">
        <span class="collage-item-title">${escapeHtml(photo.title)}</span>
        ${formattedDate ? `<span class="collage-item-date">${escapeHtml(formattedDate)}</span>` : ""}
      </figcaption>
    </figure>`;
}

// Hover reveals the caption on devices with a mouse; on touch devices there's
// no hover, so tapping an item toggles the caption instead (tapping elsewhere
// closes it).
document.addEventListener("click", (e) => {
  const item = e.target.closest("[data-collage-item]");
  document.querySelectorAll(".collage-item.is-active").forEach((el) => {
    if (el !== item) el.classList.remove("is-active");
  });
  if (item) item.classList.toggle("is-active");
});

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
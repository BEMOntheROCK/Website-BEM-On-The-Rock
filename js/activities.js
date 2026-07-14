import "./common.js";
import { getActivitiesCategories, getActivities } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function loadPage() {
  const container = document.getElementById("activities-content");
  try {
    const [categories, activities] = await Promise.all([
      getActivitiesCategories(),
      getActivities(),
    ]);

    if (!activities.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🙏</div>
          <p>Activities and ministries will be published here soon.</p>
        </div>`;
      return;
    }

    // Pre-fetch all images in parallel
    const withImages = await Promise.all(
      activities.map(async (item) => ({
        ...item,
        imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
      }))
    );

    // Group by category
    const byCategory = {};
    withImages.forEach((item) => {
      const key = item.categoryId || "__uncategorised__";
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(item);
    });

    // Sort items within each category by order field
    Object.values(byCategory).forEach((group) =>
      group.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );

    let html = "";

    // Render in category order
    categories.forEach((cat) => {
      const group = byCategory[cat.id];
      if (!group || !group.length) return;
      html += `
        <div class="activities-category">
          <h2 class="activities-category-title">${escapeHtml(cat.name)}</h2>
          <div class="activities-grid">
            ${group.map((item) => activityCardHtml(item)).join("")}
          </div>
        </div>`;
    });

    // Uncategorised fallback
    const uncategorised = byCategory["__uncategorised__"];
    if (uncategorised && uncategorised.length) {
      html += `
        <div class="activities-category">
          <h2 class="activities-category-title">Other</h2>
          <div class="activities-grid">
            ${uncategorised.map((item) => activityCardHtml(item)).join("")}
          </div>
        </div>`;
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
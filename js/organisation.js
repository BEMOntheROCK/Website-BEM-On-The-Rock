import "./common.js";
import { getOrgStructure, getLeaders, getCategories } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function renderChart(org) {
  const container = document.getElementById("org-chart");
  if (!container) return;

  if (!org.chartImageId) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Organisation chart will be published here soon.</p>
      </div>`;
    return;
  }

  const url = await getImageUrl(org.chartImageId);
  if (url) {
    container.innerHTML = `
      <div class="org-chart-image">
        <img src="${url}" alt="Organisation chart" loading="lazy" />
      </div>`;
  }
}

async function renderLeaders(leaders, categories) {
  const container = document.getElementById("leaders-list");
  if (!container) return;

  if (!leaders.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Leadership information will be added soon.</p>
      </div>`;
    return;
  }

  const withImages = await Promise.all(
    leaders.map(async (leader) => ({
      ...leader,
      imageUrl: leader.imageId ? await getImageUrl(leader.imageId) : null,
    }))
  );

  // If no categories, render flat grid
  if (!categories || !categories.length) {
    container.innerHTML = `
      <div class="leaders-grid">
        ${withImages.map((leader) => leaderCardHtml(leader)).join("")}
      </div>`;
    return;
  }

  // Group leaders by category, preserving category order
  const leadersByCategory = {};
  withImages.forEach((leader) => {
    const cat = leader.categoryId || "__uncategorised__";
    if (!leadersByCategory[cat]) leadersByCategory[cat] = [];
    leadersByCategory[cat].push(leader);
  });

  Object.values(leadersByCategory).forEach((group) =>
    group.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  let html = "";

  categories.forEach((cat) => {
    const group = leadersByCategory[cat.id];
    if (!group || !group.length) return;
    html += `
      <div class="leaders-category">
        <h3 class="leaders-category-title">${escapeHtml(cat.name)}</h3>
        <div class="leaders-grid">
          ${group.map((leader) => leaderCardHtml(leader)).join("")}
        </div>
      </div>`;
  });

  const uncategorised = leadersByCategory["__uncategorised__"];
  if (uncategorised && uncategorised.length) {
    html += `
      <div class="leaders-category">
        <h3 class="leaders-category-title">Other</h3>
        <div class="leaders-grid">
          ${uncategorised.map((leader) => leaderCardHtml(leader)).join("")}
        </div>
      </div>`;
  }

  container.innerHTML = html || `<div class="empty-state"><p>Leadership information will be added soon.</p></div>`;
}

function leaderCardHtml(leader) {
  return `
    <article class="leader-card">
      <div class="leader-photo">
        ${
          leader.imageUrl
            ? `<img src="${leader.imageUrl}" alt="${escapeHtml(leader.name)}" loading="lazy" />`
            : `<span class="leader-photo-placeholder">${escapeHtml((leader.name || "?")[0])}</span>`
        }
      </div>
      <div class="leader-info">
        <h3>${escapeHtml(leader.name)}</h3>
        <p>${escapeHtml(leader.title)}</p>
      </div>
    </article>`;
}

async function loadPage() {
  try {
    const [org, leaders, categories] = await Promise.all([
      getOrgStructure(),
      getLeaders(),
      getCategories(),
    ]);
    await renderChart(org);
    await renderLeaders(leaders, categories);
  } catch (err) {
    console.error("Failed to load organisation page:", err);
  }
}

loadPage();
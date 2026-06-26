import "./common.js";
import { getOrgStructure, getLeaders } from "./firebase-service.js";
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

async function renderLeaders(leaders) {
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

  container.innerHTML = `
    <div class="leaders-grid">
      ${withImages
        .map(
          (leader) => `
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
        </article>`
        )
        .join("")}
    </div>`;
}

async function loadPage() {
  try {
    const [org, leaders] = await Promise.all([
      getOrgStructure(),
      getLeaders(),
    ]);
    await renderChart(org);
    await renderLeaders(leaders);
  } catch (err) {
    console.error("Failed to load organisation page:", err);
  }
}

loadPage();

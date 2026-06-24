import "./common.js";
import { getHistory, formatDate } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function renderHistory(articles) {
  const container = document.getElementById("history-list");
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📜</div>
        <p>History articles will appear here once added by church staff.</p>
      </div>`;
    return;
  }

  const withImages = await Promise.all(
    articles.map(async (item) => ({
      ...item,
      imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
    }))
  );

  container.innerHTML = withImages
    .map(
      (item) => `
    <article class="history-card${item.imageUrl ? "" : " history-card--no-image"}">
      ${
        item.imageUrl
          ? `<div class="history-card-image"><img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" /></div>`
          : ""
      }
      <div class="history-card-body">
        <time class="card-date">${escapeHtml(formatDate(item.date))}</time>
        <h2 class="card-title">${escapeHtml(item.title)}</h2>
        <p class="card-body">${escapeHtml(item.content)}</p>
      </div>
    </article>`
    )
    .join("");
}

async function loadPage() {
  try {
    const articles = await getHistory();
    await renderHistory(articles);
  } catch (err) {
    console.error("Failed to load history:", err);
    const container = document.getElementById("history-list");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Unable to load history. Please check your Firebase configuration.</p>
        </div>`;
    }
  }
}

loadPage();

import "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";
import { getServices } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function serviceCardHtml(service) {
  const title = service.title || "";
  const description = service.description || "";
  return `
    <article class="service-card" data-title="${escapeAttr(title.toLowerCase())}" data-description="${escapeAttr(description.toLowerCase())}">
      <div class="service-card-image">
        ${
          service.imageUrl
            ? `<img src="${escapeAttr(service.imageUrl)}" alt="${escapeAttr(service.title)}" loading="lazy" />`
            : `<span class="service-card-image-placeholder"><i class="fa-solid fa-link"></i></span>`
        }
      </div>
      <div class="service-card-body">
        <h3 class="service-card-title">${escapeHtml(service.title)}</h3>
        ${service.description ? `<p class="service-card-description">${escapeHtml(service.description)}</p>` : ""}
      </div>
      <a
        href="${escapeAttr(service.link)}"
        class="service-card-arrow"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="${escapeAttr(`Open ${service.title}`)}"
      >
        <i class="fa-solid fa-arrow-right"></i>
      </a>
    </article>`;
}

function bindServiceSearch() {
  const input = document.getElementById("service-search");
  const grid = document.querySelector(".services-grid");
  const noResults = document.getElementById("services-no-results");
  if (!input || !grid) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const cards = grid.querySelectorAll(".service-card");
    let anyVisible = false;

    cards.forEach((card) => {
      const matches =
        !query ||
        card.dataset.title.includes(query) ||
        card.dataset.description.includes(query);
      card.hidden = !matches;
      if (matches) anyVisible = true;
    });

    if (noResults) noResults.hidden = !(cards.length && !anyVisible);
  });
}

async function loadPage() {
  const container = document.getElementById("services-content");
  const searchWrap = document.getElementById("service-search")?.closest(".search-wrap");
  try {
    const services = await getServices();

    if (!services.length) {
      if (searchWrap) searchWrap.hidden = true;
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔗</div>
          <p>Services will be published here soon.</p>
        </div>`;
      return;
    }

    const sorted = [...services].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const withImages = await Promise.all(
      sorted.map(async (item) => ({
        ...item,
        imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
      }))
    );

    container.innerHTML = `
      <div class="services-grid">
        ${withImages.map(serviceCardHtml).join("")}
      </div>`;
    bindServiceSearch();
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="empty-state">
        <p>Couldn't load services right now. Please try again later.</p>
      </div>`;
  } finally {
    hideLoadingOverlay();
  }
}

loadPage();
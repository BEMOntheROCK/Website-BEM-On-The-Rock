import { initHeroBanner } from "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";
import { getCommunityContent, getCommunityPhotos } from "./firebase-service.js";
import { getImageUrl } from "./image-service.js";
import { mountCroppedImage, DEFAULT_CROP } from "./image-crop.js";

document.getElementById("year").textContent = new Date().getFullYear();
initHeroBanner("community", "community-hero");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function loadPage() {
  const container = document.getElementById("community-content");
  try {
    const [communityContent, communityPhotos] = await Promise.all([
      getCommunityContent(),
      getCommunityPhotos(),
    ]);

    const hasCommunityContent =
      (communityContent.introText && communityContent.introText.trim()) ||
      communityPhotos.length;

    if (!hasCommunityContent) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🙏</div>
          <p>Community contributions will be published here soon.</p>
        </div>`;
      return;
    }

    container.innerHTML = await communityContributionsHtml(communityContent, communityPhotos);
    mountCommunityPhotoCrops();
  } catch (err) {
    console.error("Failed to load community contributions:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p>Unable to load community contributions. Please check your Firebase configuration.</p>
      </div>`;
  } finally {
    hideLoadingOverlay();
  }
}

// id -> crop, populated when the community collage is built so the crop can
// be applied to each <img> after it's actually in the DOM (mountCroppedImage
// needs a real, laid-out container to measure).
const communityPhotoCropMap = new Map();

function mountCommunityPhotoCrops() {
  document.querySelectorAll(".collage-item[data-photo-id]").forEach((figure) => {
    const img = figure.querySelector("img");
    if (!img) return;
    const crop = communityPhotoCropMap.get(figure.dataset.photoId) || DEFAULT_CROP;
    mountCroppedImage(figure, img, crop);
  });
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

const COMMUNITY_SIZES = ["1x1", "1x2", "2x1", "2x2", "3x1", "3x2", "3x3", "3x4", "4x3"];

function collageItemHtml(photo) {
  const sizeClass = `collage-item--${COMMUNITY_SIZES.includes(photo.size) ? photo.size : "1x1"}`;
  const formattedDate = formatCollageDate(photo.date);
  if (photo.imageUrl) communityPhotoCropMap.set(photo.id, photo.crop || DEFAULT_CROP);
  return `
    <figure class="collage-item ${sizeClass}" tabindex="0" data-collage-item data-photo-id="${photo.id}">
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
// closes it). Tapping the photo itself, rather than the caption area, opens
// a fullscreen lightbox instead of toggling the caption.
document.addEventListener("click", (e) => {
  const item = e.target.closest("[data-collage-item]");

  if (item && e.target.tagName === "IMG") {
    openLightbox(e.target.src, e.target.alt);
    return;
  }

  document.querySelectorAll(".collage-item.is-active").forEach((el) => {
    if (el !== item) el.classList.remove("is-active");
  });
  if (item) item.classList.toggle("is-active");
});

function openLightbox(src, alt) {
  const overlay = document.querySelector("[data-lightbox-overlay]");
  const img = overlay?.querySelector("[data-lightbox-image]");
  if (!overlay || !img) return;
  img.src = src;
  img.alt = alt || "";
  overlay.classList.add("open");
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  const overlay = document.querySelector("[data-lightbox-overlay]");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.classList.remove("lightbox-open");
  const img = overlay.querySelector("[data-lightbox-image]");
  if (img) img.src = "";
}

(function initLightbox() {
  const overlay = document.querySelector("[data-lightbox-overlay]");
  if (!overlay) return;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });

  const closeBtn = overlay.querySelector("[data-lightbox-close]");
  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeLightbox();
  });
})();

loadPage();
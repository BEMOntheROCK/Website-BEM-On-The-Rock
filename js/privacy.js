import "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";
import { getPrivacyContent, formatDate } from "./firebase-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function renderPrivacyPolicy() {
  const container = document.getElementById("privacy-content");
  const lastUpdatedEl = document.getElementById("privacy-last-updated");

  try {
    const privacy = await getPrivacyContent();

    if (privacy.content && privacy.content.trim()) {
      container.innerHTML = `<p class="privacy-text">${escapeHtml(privacy.content)}</p>`;
    } else {
      container.innerHTML = `<p class="empty-note">Our privacy policy will be posted here soon.</p>`;
    }

    lastUpdatedEl.textContent = privacy.updatedAt
      ? `Last updated: ${formatDate(privacy.updatedAt)}`
      : "";
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="empty-note">Unable to load the privacy policy right now. Please try again later.</p>`;
  } finally {
    hideLoadingOverlay();
  }
}

renderPrivacyPolicy();
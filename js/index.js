import "./common.js";
import {
  getSiteSettings,
  getNews,
  getUpdates,
  formatDate,
} from "./firebase-service.js";
import { defaultYouTube } from "./firebase-config.js";
import { getImageUrl } from "./image-service.js";

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function setLink(id, url) {
  const el = document.getElementById(id);
  if (el && url) el.href = url;
}

async function renderHero(settings) {
  const title = document.getElementById("hero-title");
  const tagline = document.getElementById("hero-tagline");
  const footerTagline = document.getElementById("footer-tagline");

  if (title && settings.churchName) {
    const parts = settings.churchName.split(" ");
    const last = parts.pop();
    title.innerHTML = `<span class="church-title-bem">BEM</span> <span class="church-title-ontherock">On The <em>Rock</em></span>`;
  }

  if (tagline && settings.tagline) tagline.textContent = settings.tagline;
  if (footerTagline && settings.tagline) footerTagline.textContent = settings.tagline;
}

function renderLivestream(settings) {
  const liveUrl = settings.youtubeLiveUrl || defaultYouTube.liveUrl;
  const channelUrl = settings.youtubeChannelUrl || defaultYouTube.channelUrl;
  const videoId = settings.youtubeVideoId;

  setLink("livestream-link", liveUrl);
  setLink("channel-link", channelUrl);
  setLink("hero-youtube-btn", liveUrl);
  setLink("footer-youtube", channelUrl);

  const serviceTimes = document.getElementById("service-times");
  if (serviceTimes && settings.serviceTimes) {
    serviceTimes.textContent = settings.serviceTimes;
  }

  const embed = document.getElementById("livestream-embed");
  if (!embed) return;

  if (videoId) {
    embed.innerHTML = `<iframe
      src="https://www.youtube.com/embed/${escapeHtml(videoId)}"
      title="BEM On The Rock Sunday Service"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>`;
  }
}

async function renderUpdates(updates) {
  const container = document.getElementById("updates-list");
  if (!container) return;

  if (!updates.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📢</div>
        <p>No updates at the moment. Check back soon!</p>
      </div>`;
    return;
  }

  const items = await Promise.all(
    updates.map(async (item) => ({
      ...item,
      imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
    }))
  );

  container.innerHTML = items
    .map(
      (item) => `
    <article class="update-item ${item.priority === "high" ? "high" : ""}">
      ${
        item.imageUrl
          ? `<div class="update-thumb"><img src="${item.imageUrl}" alt="" loading="lazy" /></div>`
          : ""
      }
      <time class="update-date">${escapeHtml(formatDate(item.date))}</time>
      <div class="update-content">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.content)}</p>
      </div>
    </article>`
    )
    .join("");
}

async function renderNews(news) {
  const container = document.getElementById("news-grid");
  if (!container) return;

  if (!news.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📰</div>
        <p>No news articles yet.</p>
      </div>`;
    return;
  }

  const items = await Promise.all(
    news.map(async (item) => ({
      ...item,
      imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
    }))
  );

  container.innerHTML = items
    .map(
      (item) => `
    <article class="card card--with-image">
      ${
        item.imageUrl
          ? `<div class="card-image"><img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" /></div>`
          : ""
      }
      <div class="card-content">
        <time class="card-date">${escapeHtml(formatDate(item.date))}</time>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-body">${escapeHtml(item.content)}</p>
      </div>
    </article>`
    )
    .join("");
}

async function loadPage() {
  try {
    const [settings, news, updates] = await Promise.all([
      getSiteSettings(),
      getNews(),
      getUpdates(),
    ]);

    await renderHero(settings);
    renderLivestream(settings);
    await renderUpdates(updates);
    await renderNews(news);
  } catch (err) {
    console.error("Failed to load page content:", err);
    document.querySelectorAll(".loading").forEach((el) => {
      el.textContent =
        "Unable to load content. Please check your Firebase configuration.";
    });
  }
}

loadPage();
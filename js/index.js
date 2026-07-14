import "./common.js";
import {
  getSiteSettings,
  getNews,
  getUpdates,
  getCarouselVideos,
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

  const taglineWrap = document.getElementById("tagline-wrap");
  if (taglineWrap) taglineWrap.classList.add("tagline-ready");
}

let fallbackVideoId = null;

function embedVideo(videoId, title = "BEM On The Rock Sunday Service") {
  const embed = document.getElementById("livestream-embed");
  if (!embed || !videoId) return;
  embed.innerHTML = `<iframe
    src="https://www.youtube.com/embed/${escapeHtml(videoId)}"
    title="${escapeHtml(title)}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>`;
}

function embedAutoLive(channelId) {
  const embed = document.getElementById("livestream-embed");
  if (!embed || !channelId) return;
  embed.innerHTML = `<iframe
    src="https://www.youtube.com/embed/live_stream?channel=${escapeHtml(channelId)}"
    title="BEM On The Rock Live"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>`;
}

function renderLivestream(settings) {
  const liveUrl = settings.youtubeLiveUrl || defaultYouTube.liveUrl;
  const channelUrl = settings.youtubeChannelUrl || defaultYouTube.channelUrl;
  const channelId = settings.youtubeChannelId || defaultYouTube.channelId;
  fallbackVideoId = settings.youtubeFallbackVideoId;

  setLink("livestream-link", liveUrl);
  setLink("channel-link", channelUrl);
  setLink("hero-youtube-btn", liveUrl);
  setLink("footer-youtube", channelUrl);

  const serviceTimes = document.getElementById("service-times");
  if (serviceTimes && settings.serviceTimes) {
    serviceTimes.textContent = settings.serviceTimes;
  }

  // Admin controls this with a simple toggle in the dashboard:
  // - "We are live right now" ON  → embed the auto-live channel feed
  // - toggle OFF                  → embed the fallback video (last service's recording)
  if (settings.isLive && channelId) {
    embedAutoLive(channelId);
  } else if (fallbackVideoId) {
    embedVideo(fallbackVideoId, "BEM On The Rock — Recent Service");
  } else if (channelId) {
    // No fallback configured yet — still try the auto-live embed as a reasonable default
    embedAutoLive(channelId);
  }
}

async function renderCarousel(videos, channelId, isLive) {
  const container = document.getElementById("video-carousel");
  if (!container) return;

  const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const liveCardHtml = `
    <button type="button" class="carousel-card carousel-card--live active" data-live="true" data-title="Live Now">
      <div class="carousel-card-thumb carousel-card-thumb--live">
        <span class="live-badge carousel-live-badge">${isLive ? "● Live" : "▶ Latest"}</span>
      </div>
      <div class="carousel-card-body">
        <h4>${isLive ? "Live Now" : "Watch Latest Service"}</h4>
      </div>
    </button>`;

  const pastCardsHtml = sorted
    .map(
      (v) => `
    <button type="button" class="carousel-card" data-video-id="${escapeHtml(v.videoId)}" data-title="${escapeHtml(v.title)}">
      <div class="carousel-card-thumb">
        <img src="https://img.youtube.com/vi/${escapeHtml(v.videoId)}/hqdefault.jpg" alt="${escapeHtml(v.title)}" loading="lazy" />
        <span class="carousel-play-icon">▶</span>
      </div>
      <div class="carousel-card-body">
        <h4>${escapeHtml(v.title)}</h4>
        ${v.date ? `<time>${escapeHtml(formatDate(v.date))}</time>` : ""}
      </div>
    </button>`
    )
    .join("");

  container.innerHTML = liveCardHtml + pastCardsHtml;

  container.querySelectorAll(".carousel-card").forEach((card) => {
    card.addEventListener("click", () => {
      const isLiveCard = card.getAttribute("data-live") === "true";

      if (isLiveCard) {
        if (isLive && channelId) {
          embedAutoLive(channelId);
        } else if (fallbackVideoId) {
          embedVideo(fallbackVideoId, "BEM On The Rock — Recent Service");
        } else if (channelId) {
          embedAutoLive(channelId);
        }
      } else {
        const videoId = card.getAttribute("data-video-id");
        const title = card.getAttribute("data-title");
        if (!videoId) return;
        embedVideo(videoId, title);
      }

      container.querySelectorAll(".carousel-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
    });
  });
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
    const [settings, news, updates, carouselVideos] = await Promise.all([
      getSiteSettings(),
      getNews(),
      getUpdates(),
      getCarouselVideos(),
    ]);

    await renderHero(settings);
    renderLivestream(settings);
    const channelId = settings.youtubeChannelId || defaultYouTube.channelId;
    await renderCarousel(carouselVideos, channelId, settings.isLive);
    await renderUpdates(updates);
    await renderNews(news);
  } catch (err) {
    console.error("Failed to load page content:", err);
    document.querySelectorAll(".loading").forEach((el) => {
      el.textContent =
        "Unable to load content. Please check your Firebase configuration.";
    });
    document.getElementById("tagline-wrap")?.classList.add("tagline-ready");
  }
}

loadPage();
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
import { mountCroppedImage, DEFAULT_CROP } from "./image-crop.js";

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

function embedNextServicePlaceholder(serviceTimesText, liveUrl) {
  const embed = document.getElementById("livestream-embed");
  if (!embed) return;
  embed.innerHTML = `
    <div class="livestream-placeholder livestream-placeholder--next">
      <span class="icon">▶</span>
      <p class="livestream-placeholder-title">We're not currently live, check out the videos below or watch more on BEM On The ROCK YouTube Channel</p>
      ${
        serviceTimesText
          ? `<p class="livestream-placeholder-schedule">We will be live again ${escapeHtml(serviceTimesText)}</p>`
          : ""
      }
      <a href="${escapeHtml(liveUrl)}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
        Visit Our YouTube Channel
      </a>
    </div>`;
}

// No API key required: YouTube's oEmbed endpoint only resolves successfully
// for a URL that currently points at a playable video. When a channel's
// "/live" URL isn't actively broadcasting, the oEmbed request fails —
// which is what we use as our live/offline signal.
async function checkYoutubeLive(liveUrl) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(liveUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return { live: false, videoId: null };

    const data = await res.json();
    const match = data.html && data.html.match(/embed\/([a-zA-Z0-9_-]+)/);
    const videoId = match ? match[1] : null;

    return { live: !!videoId, videoId };
  } catch (err) {
    console.error("Live check failed:", err);
    return { live: false, videoId: null };
  }
}

async function renderLivestream(settings) {
  const liveUrl = settings.youtubeLiveUrl || defaultYouTube.liveUrl;
  const channelUrl = settings.youtubeChannelUrl || defaultYouTube.channelUrl;

  setLink("livestream-link", liveUrl);
  setLink("channel-link", channelUrl);
  setLink("hero-youtube-btn", liveUrl);
  setLink("footer-youtube", channelUrl);

  const serviceTimes = document.getElementById("service-times");
  if (serviceTimes && settings.serviceTimes) {
    serviceTimes.textContent = settings.serviceTimes;
  }

  const { live, videoId } = await checkYoutubeLive(liveUrl);

  const statusBadge = document.getElementById("livestream-status-badge");
  if (statusBadge) {
    statusBadge.textContent = live ? "Live Stream" : "Offline";
    statusBadge.classList.toggle("live-badge--offline", !live);
  }

  if (live && videoId) {
    embedVideo(videoId, "BEM On The Rock — Live Now");
  } else {
    embedNextServicePlaceholder(settings.serviceTimes, liveUrl);
  }

  return { live, videoId };
}

async function renderCarousel(videos, isLive, liveVideoId, serviceTimesText, liveUrl) {
  const container = document.getElementById("video-carousel");
  if (!container) return;

  const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const liveCardHtml = `
    <button type="button" class="carousel-card carousel-card--live active" data-live="true" data-title="Live Now">
      <div class="carousel-card-thumb carousel-card-thumb--live">
        <span class="live-badge carousel-live-badge">${isLive ? "● Live" : "Offline"}</span>
      </div>
      <div class="carousel-card-body">
        <h4>${isLive ? "Live Now" : "Currently Offline"}</h4>
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
        if (isLive && liveVideoId) {
          embedVideo(liveVideoId, "BEM On The Rock — Live Now");
        } else {
          embedNextServicePlaceholder(serviceTimesText, liveUrl);
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

let newsCarouselTimer = null;
let newsCarouselIndex = 0;
let newsCarouselItems = [];

function openNewsModal(item) {
  const wrap = document.getElementById("news-modal-image").parentElement;
  const imgEl = document.getElementById("news-modal-image");
  imgEl.removeAttribute("style");
  imgEl.alt = item.title;
  if (item.imageUrl) {
    imgEl.src = item.imageUrl;
    mountCroppedImage(wrap, imgEl, item.crop || DEFAULT_CROP);
  } else {
    imgEl.src = "";
  }
  document.getElementById("news-modal-title").textContent = item.title;
  document.getElementById("news-modal-desc").textContent = item.content;
  document.getElementById("news-modal-date").textContent = formatDate(item.date);
  document.getElementById("news-modal").classList.add("open");
}

function closeNewsModal() {
  document.getElementById("news-modal").classList.remove("open");
}

/** How many cards are visible at once, matching the CSS breakpoints. */
function getNewsVisibleCount() {
  return window.innerWidth < 640 ? 1 : 2;
}

function goToNewsSlide(index) {
  const track = document.getElementById("news-carousel-track");
  if (!track || !newsCarouselItems.length) return;
  newsCarouselIndex = (index + newsCarouselItems.length) % newsCarouselItems.length;
  const slideWidthPct = 100 / getNewsVisibleCount();
  track.style.transform = `translateX(-${newsCarouselIndex * slideWidthPct}%)`;
  document.querySelectorAll(".news-carousel-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === newsCarouselIndex);
  });
}

function startNewsAutoAdvance() {
  stopNewsAutoAdvance();
  newsCarouselTimer = setInterval(() => {
    goToNewsSlide(newsCarouselIndex + 1);
  }, 5000);
}

function stopNewsAutoAdvance() {
  if (newsCarouselTimer) clearInterval(newsCarouselTimer);
  newsCarouselTimer = null;
}

async function renderNews(news) {
  const container = document.getElementById("news-carousel");
  if (!container) return;

  if (!news.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📰</div>
        <p>No news articles yet.</p>
      </div>`;
    return;
  }

  const capped = news.slice(0, 9);
  const items = await Promise.all(
    capped.map(async (item) => ({
      ...item,
      imageUrl: item.imageId ? await getImageUrl(item.imageId) : null,
    }))
  );
  newsCarouselItems = items;
  newsCarouselIndex = 0;

  container.innerHTML = `
    <div class="news-carousel-viewport">
      <div class="news-carousel-track" id="news-carousel-track">
        ${items
          .map(
            (item, i) => `
          <div class="news-carousel-slide" data-index="${i}">
            <button type="button" class="news-card" data-index="${i}" aria-label="View news: ${escapeHtml(item.title)}">
              <div class="news-card-media" data-crop-container>
                ${
                  item.imageUrl
                    ? `<img class="news-card-img" data-crop-img alt="${escapeHtml(item.title)}" loading="lazy" />`
                    : `<div class="news-carousel-noimg">${escapeHtml(item.title)}</div>`
                }
              </div>
            </button>
          </div>`
          )
          .join("")}
      </div>
      <button type="button" class="news-carousel-arrow news-carousel-arrow--prev" aria-label="Previous news">‹</button>
      <button type="button" class="news-carousel-arrow news-carousel-arrow--next" aria-label="Next news">›</button>
    </div>
    <div class="news-carousel-dots">
      ${items.map((_, i) => `<span class="news-carousel-dot" data-index="${i}"></span>`).join("")}
    </div>
  `;

  container.querySelectorAll(".news-carousel-slide").forEach((slide, i) => {
    const item = items[i];
    if (item.imageUrl) {
      const mediaEl = slide.querySelector("[data-crop-container]");
      const imgEl = slide.querySelector("[data-crop-img]");
      imgEl.src = item.imageUrl;
      mountCroppedImage(mediaEl, imgEl, item.crop || DEFAULT_CROP);
    }
  });

  container.querySelectorAll(".news-card").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.dataset.index, 10);
      openNewsModal(newsCarouselItems[idx]);
    });
  });

  container.querySelector(".news-carousel-arrow--prev").addEventListener("click", () => {
    goToNewsSlide(newsCarouselIndex - 1);
    startNewsAutoAdvance();
  });
  container.querySelector(".news-carousel-arrow--next").addEventListener("click", () => {
    goToNewsSlide(newsCarouselIndex + 1);
    startNewsAutoAdvance();
  });
  container.querySelectorAll(".news-carousel-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      goToNewsSlide(parseInt(dot.dataset.index, 10));
      startNewsAutoAdvance();
    });
  });

  container.addEventListener("mouseenter", stopNewsAutoAdvance);
  container.addEventListener("mouseleave", startNewsAutoAdvance);
  container.addEventListener("touchstart", stopNewsAutoAdvance, { passive: true });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goToNewsSlide(newsCarouselIndex), 150);
  });

  goToNewsSlide(0);
  startNewsAutoAdvance();
}

document.getElementById("news-modal-close")?.addEventListener("click", closeNewsModal);
document.getElementById("news-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "news-modal") closeNewsModal();
});

async function loadPage() {
  try {
    const [settings, news, updates, carouselVideos] = await Promise.all([
      getSiteSettings(),
      getNews(),
      getUpdates(),
      getCarouselVideos(),
    ]);

    await renderHero(settings);
    const { live, videoId } = await renderLivestream(settings);
    const liveUrl = settings.youtubeLiveUrl || defaultYouTube.liveUrl;
    await renderCarousel(carouselVideos, live, videoId, settings.serviceTimes, liveUrl);
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
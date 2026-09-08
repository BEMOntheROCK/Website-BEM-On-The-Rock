// Handle background push in this same worker (scope "/") so getToken() can
// reuse the already-registered worker instead of installing a second one
// at firebase-messaging-sw.js — that swap was slow and fought this file.
importScripts("/firebase-messaging-sw.js");

/**
 * Service worker for BEM On The ROCK.
 *
 * Scope: the whole site (this file must stay at the repo root to control
 * every page). CACHE_VERSION below is auto-filled with the deploy commit
 * SHA by .github/workflows/deploy.yml on every publish — so every deploy
 * always counts as a real update, with nothing to remember to bump by
 * hand. When editing this file locally, __BUILD_ID__ is a harmless
 * placeholder; it only becomes a real value during the GitHub Actions
 * deploy step.
 *
 * Deliberately excluded from any caching:
 *   - admin.html and anything under /js/admin*.js — the admin panel should
 *     always hit the network fresh, never show a stale/offline version.
 *   - Any cross-origin request (Firebase, Google Fonts, Font Awesome CDN,
 *     Google Translate, YouTube, etc.) — these are left completely alone
 *     and go straight to the network, untouched by this service worker.
 */

const CACHE_VERSION = "bem-cache-__BUILD_ID__";

// Precached on install: the public page shells + the assets nearly every
// page needs, so there's something to fall back to offline immediately.
// Everything else (per-page JS, images) is picked up and cached lazily via
// the runtime network-first handler below, so this list doesn't need to be
// kept in lockstep with every file the site adds over time.
const PRECACHE_URLS = [
  "index.html",
  "about.html",
  "activities.html",
  "history.html",
  "organisation-structure.html",
  "services.html",
  "privacy.html",
  "css/styles.css",
  "manifest.json",
  "assets/favicon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

const EXCLUDED_PATH_PATTERNS = [/\/admin\.html$/, /\/js\/admin.*\.js$/];

function isExcludedPath(pathname) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Leave every cross-origin request (Firebase, CDNs, YouTube, Google
  // Translate, fonts, etc.) completely untouched — no caching, no fallback.
  if (url.origin !== self.location.origin) return;

  // Never intercept the admin panel or its JS — always fetch fresh.
  if (isExcludedPath(url.pathname)) return;

  // Only handle safe, cacheable GET requests.
  if (request.method !== "GET") return;

  // HTML page navigations: network-first, falling back to the cached copy
  // when offline, so content updates show immediately when online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("index.html")))
    );
    return;
  }

  // Same-origin static assets (css, js, images, fonts): network-first,
  // same as page navigations above — every load gets the true latest
  // file when online, falling back to the cached copy only when offline
  // or the network request fails. (Previously this used stale-while-
  // revalidate, which always served the *previous* cached copy instantly
  // and only refreshed it in the background for the *next* load — meaning
  // visitors were permanently one deploy behind until a second reload.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
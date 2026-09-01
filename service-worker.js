/**
 * Service worker for BEM On The ROCK.
 *
 * Scope: the whole site (this file must stay at the repo root to control
 * every page). Bump CACHE_VERSION whenever you want visitors' caches to
 * refresh after a deploy.
 *
 * Deliberately excluded from any caching:
 *   - admin.html and anything under /js/admin*.js — the admin panel should
 *     always hit the network fresh, never show a stale/offline version.
 *   - Any cross-origin request (Firebase, Google Fonts, Font Awesome CDN,
 *     Google Translate, YouTube, etc.) — these are left completely alone
 *     and go straight to the network, untouched by this service worker.
 */

const CACHE_VERSION = "bem-cache-v1";

// Precached on install: the public page shells + the assets nearly every
// page needs. Everything else (per-page JS, images) is picked up lazily via
// the runtime stale-while-revalidate handler below, so this list doesn't
// need to be kept in lockstep with every file the site adds over time.
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

  // Same-origin static assets (css, js, images, fonts): stale-while-revalidate
  // — serve the cached copy instantly if we have one, and refresh it in the
  // background, so new files are picked up automatically without needing to
  // be listed in PRECACHE_URLS above.
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
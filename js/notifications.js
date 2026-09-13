import { getToken, deleteToken } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";
import { messaging, messagingReady } from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";
import { saveNotificationToken, deleteNotificationToken, getNotificationLog } from "./firebase-service.js";

const STORAGE_KEY = "bem-notifications-enabled";
const TOKEN_KEY = "bem-notification-token";
// When the bell dropdown was last opened, so a newer notification in the
// log can be detected as "unread" for this device. Deliberately
// localStorage (not sessionStorage) — there's no account system, so this
// per-device history is the only kind of "read" state that's possible
// here, and it should persist across visits, not just the current tab.
const LAST_VIEWED_KEY = "bem-notifications-last-viewed";
// Session-scoped (not localStorage): dismissing the banner should only
// silence it for the rest of the current app session. Once the app is
// closed and reopened, sessionStorage is cleared automatically and the
// banner is free to reappear if notifications are still effectively off.
const DISMISSED_THIS_SESSION_KEY = "bem-notifications-dismissed-session";

let operationId = 0;

function isRunningAsInstalledApp() {
  // Standalone display mode covers Chrome/Edge/Android after "Install" or
  // "Add to Home Screen". navigator.standalone is Safari's older iOS-only
  // equivalent, which doesn't support the display-mode media query.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function getToggleGroups() {
  return Array.from(document.querySelectorAll("[data-notif-toggle-group]"));
}

function setToggleState(state) {
  // state: "off" | "on" | "unsupported" | "denied"
  getToggleGroups().forEach((group) => {
    const offBtn = group.querySelector('[data-notif-btn="off"]');
    const onBtn = group.querySelector('[data-notif-btn="on"]');
    if (!offBtn || !onBtn) return;

    offBtn.classList.toggle("active", state === "off" || state === "denied" || state === "unsupported");
    onBtn.classList.toggle("active", state === "on");

    if (state === "unsupported") {
      offBtn.disabled = true;
      onBtn.disabled = true;
      group.title = "Push notifications aren't supported in this browser. On iPhone, add this site to your Home Screen first.";
    } else if (state === "denied") {
      offBtn.disabled = true;
      onBtn.disabled = true;
      group.title = "Notifications are blocked in your browser settings for this site.";
    } else {
      offBtn.disabled = false;
      onBtn.disabled = false;
      group.title = "";
    }
  });
}

function markDismissedThisSession() {
  sessionStorage.setItem(DISMISSED_THIS_SESSION_KEY, "true");
}

/**
 * Before caching and push were consolidated into one service worker (see
 * the comments atop service-worker.js and firebase-messaging-sw.js),
 * firebase-messaging-sw.js could end up registered on its own as a second,
 * independent service worker. If that old registration is still sitting on
 * a device, it keeps its own push subscription and its own stored FCM
 * token — so every notification arrives twice, once per worker.
 *
 * This removes any registration that isn't the one we're actually using,
 * so existing devices self-heal the next time they set up notifications,
 * with nothing manual required. Each stale registration's push
 * subscription is explicitly unsubscribed *before* unregistering the
 * worker — unregistering alone leaves the subscription itself active, so
 * the push service keeps delivering to it. With no worker left to handle
 * it, the browser falls back to showing its own generic notification for
 * that delivery (Chrome's documented behavior for exactly this case)
 * instead of the duplicate simply disappearing. Explicitly unsubscribing
 * tells the push service to stop delivering to that endpoint entirely.
 * The matching stale token then gets pruned server-side the next time a
 * notification is sent (see sendToAllSubscribers in functions/index.js),
 * same as any other token that goes stale.
 */
export async function cleanupStaleServiceWorkers(keepRegistration) {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((reg) => reg !== keepRegistration)
        .map(async (reg) => {
          try {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
          } catch {
            // Fall through to unregister regardless — worst case the
            // subscription outlives the worker, same as before this fix.
          }
          await reg.unregister().catch(() => {});
        })
    );
  } catch {
    // Best-effort cleanup only — never let this block notification setup.
  }
}

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;

  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register("/service-worker.js");
    } catch {
      return undefined;
    }
  }

  cleanupStaleServiceWorkers(registration);

  return registration;
}

async function subscribePush(op) {
  const ready = await messagingReady;
  if (op !== operationId) return;
  if (!ready) {
    // Permission may already be granted — keep the toggle on and retry
    // token registration later rather than snapping the switch back off.
    return;
  }

  const registration = await getPushRegistration();
  if (op !== operationId) return;

  const token = await getToken(messaging, {
    vapidKey,
    ...(registration ? { serviceWorkerRegistration: registration } : {}),
  });
  if (op !== operationId) return;

  if (!token) {
    return;
  }

  await saveNotificationToken(token);
  if (op !== operationId) {
    await deleteNotificationToken(token).catch(() => {});
    return;
  }

  // getToken() can return a *different* token than last time whenever the
  // underlying push subscription gets regenerated (a browser update, the
  // stale-service-worker cleanup above forcing a fresh subscribe, clearing
  // site data, etc.) — this has been happening on essentially every recent
  // deploy. Without this, the old token has nothing to still be running to
  // notice it's stale (it was never disabled, just silently replaced), so
  // it sits in Firestore forever, and the same device ends up receiving
  // its own notification twice: once via the current token, once via the
  // orphaned old one. If we still have a different previous token on
  // record for this device, remove it now.
  const previousToken = localStorage.getItem(TOKEN_KEY);
  if (previousToken && previousToken !== token) {
    await deleteNotificationToken(previousToken).catch(() => {});
  }
  localStorage.setItem(TOKEN_KEY, token);
  setToggleState("on");
}

async function enableNotifications() {
  const op = ++operationId;
  try {
    if (!("Notification" in window)) {
      setToggleState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setToggleState("denied");
      return;
    }

    // Flip the in-app toggle immediately (banner Enable and the bell
    // control should stay in sync). Revert only if the OS dialog is denied.
    setToggleState("on");
    localStorage.setItem(STORAGE_KEY, "true");
    hidePermissionPrompt();

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (op !== operationId) return;
      if (permission !== "granted") {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setToggleState(permission === "denied" ? "denied" : "off");
        return;
      }
    }

    await subscribePush(op);
  } catch (err) {
    console.error("Notification subscription failed:", err);
  }
}

async function disableNotifications() {
  const op = ++operationId;
  const storedToken = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  setToggleState("off");

  try {
    await messagingReady;
    if (op !== operationId) return;
    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }
    if (storedToken) {
      await deleteNotificationToken(storedToken).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to fully disable notifications:", err);
  }
}

export function initNotificationToggle() {
  const groups = getToggleGroups();
  if (groups.length === 0) return;

  if (!("Notification" in window)) {
    setToggleState("unsupported");
    return;
  }

  if (Notification.permission === "denied") {
    setToggleState("denied");
    return;
  }

  if (Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true") {
    setToggleState("on");
  } else {
    setToggleState("off");
  }

  groups.forEach((group) => {
    const offBtn = group.querySelector('[data-notif-btn="off"]');
    const onBtn = group.querySelector('[data-notif-btn="on"]');
    if (offBtn) offBtn.addEventListener("click", () => disableNotifications());
    if (onBtn) onBtn.addEventListener("click", () => enableNotifications());
  });
}

function promptCopy() {
  const ms = localStorage.getItem("site-lang") === "ms";
  return {
    body: ms
      ? "Hidupkan pemberitahuan untuk berita dan siaran langsung."
      : "Turn on notifications for news and live stream alerts.",
    enable: ms ? "Aktifkan" : "Enable",
    dismiss: ms ? "Bukan sekarang" : "Not now",
  };
}

function hidePermissionPrompt() {
  document.querySelector("[data-notif-prompt]")?.remove();
}

function showPermissionPrompt() {
  if (document.querySelector("[data-notif-prompt]")) return;

  const copy = promptCopy();
  const banner = document.createElement("div");
  banner.className = "notif-permission-banner";
  banner.setAttribute("data-notif-prompt", "");
  banner.innerHTML = `
    <p class="notif-permission-banner-text">${copy.body}</p>
    <button type="button" class="notif-permission-banner-enable" data-notif-prompt-enable>
      ${copy.enable}
    </button>
    <button type="button" class="notif-permission-banner-dismiss" data-notif-prompt-dismiss aria-label="${copy.dismiss}">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
  `;

  banner.querySelector("[data-notif-prompt-enable]").addEventListener("click", () => {
    setToggleState("on");
    localStorage.setItem(STORAGE_KEY, "true");
    hidePermissionPrompt();
    enableNotifications();
  });
  banner.querySelector("[data-notif-prompt-dismiss]").addEventListener("click", () => {
    markDismissedThisSession();
    hidePermissionPrompt();
  });

  document.body.appendChild(banner);
}

/**
 * Notifications count as "effectively off" (and so worth prompting about)
 * whenever permission hasn't been decided yet, or permission was granted
 * but the visitor's own in-app toggle is off (e.g. they flipped it off
 * later, or enabling silently failed previously). "denied" is excluded on
 * purpose: once the browser has blocked permission, no button in this
 * banner can change that — only the visitor's browser/site settings can —
 * so showing it would just be noise. setToggleState("denied") already
 * covers explaining that state via the in-page toggle instead.
 */
function notificationsEffectivelyOff() {
  if (Notification.permission === "default") return true;
  if (Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) !== "true") return true;
  return false;
}

function shouldShowNotificationBanner() {
  if (!("Notification" in window)) return false;
  if (sessionStorage.getItem(DISMISSED_THIS_SESSION_KEY) === "true") return false;
  if (!notificationsEffectivelyOff()) return false;
  return isRunningAsInstalledApp();
}

/**
 * Shows an in-app prompt whose Enable button is a real user gesture —
 * browsers will not show the OS permission dialog from a timer or from
 * page load alone. Checked every time the app is opened (not just the
 * very first time): if notifications are still effectively off, the
 * banner reappears, but dismissing it silences it for the rest of the
 * current session only (see DISMISSED_THIS_SESSION_KEY).
 */
export function initAutoNotificationPrompt() {
  if (!("Notification" in window)) return;

  const offer = () => {
    if (shouldShowNotificationBanner()) showPermissionPrompt();
  };

  offer();

  window.addEventListener("appinstalled", () => {
    // This event fires in whichever tab ran the install — often still the
    // regular browser tab, not the installed app itself. The banner should
    // only ever appear in the installed app, so route this through the
    // same offer()/isRunningAsInstalledApp() check as everything else
    // rather than showing it unconditionally here. In practice this means
    // the prompt won't appear until the visitor actually opens the app
    // from its icon (or, on browsers where the tab itself flips to
    // standalone post-install, the matchMedia listener below catches it).
    offer();
  });

  // iOS / some Android WebViews report standalone only after the first
  // paint, or after the display-mode media query starts matching.
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (event) => {
    if (event.matches) offer();
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

/**
 * Short, human "time ago" label (e.g. "5m ago", "3d ago") — good enough
 * for a notification list without pulling in a date-formatting library.
 * Falls back to a plain date once it's more than a week old.
 */
function timeAgo(isoString) {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

let cachedLog = null;

async function fetchNotificationLog() {
  if (cachedLog) return cachedLog;
  try {
    cachedLog = await getNotificationLog();
  } catch (err) {
    console.error("Failed to load notification log:", err);
    cachedLog = [];
  }
  return cachedLog;
}

function renderNotificationList(entries) {
  const list = document.querySelector("[data-notif-bell-list]");
  if (!list) return;

  if (!entries.length) {
    list.innerHTML = `<div class="notif-bell-empty">No notifications yet.</div>`;
    return;
  }

  // Livestream notifications always show first, regardless of how it
  // compares by date to everything else — there's normally at most one
  // active at a time anyway (it's removed once the stream ends), so this
  // just pins it above whatever else is in the list rather than changing
  // the relative order of anything else.
  const ordered = [...entries].sort(
    (a, b) => (b.source?.collection === "live" ? 1 : 0) - (a.source?.collection === "live" ? 1 : 0)
  );

  list.innerHTML = ordered
    .map(
      (entry) => `
      <a href="${escapeHtml(entry.url || "/index.html")}" class="notif-bell-item">
        <span class="notif-bell-item-title">${escapeHtml(entry.title)}</span>
        <span class="notif-bell-item-body">${escapeHtml(entry.body)}</span>
        <span class="notif-bell-item-time">${escapeHtml(timeAgo(entry.sentAt))}</span>
      </a>`
    )
    .join("");
}

function updateUnreadDot(entries) {
  const dot = document.querySelector("[data-notif-bell-dot]");
  if (!dot) return;
  const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
  const newest = entries[0]?.sentAt;
  const hasUnread = !!newest && (!lastViewed || new Date(newest) > new Date(lastViewed));
  dot.hidden = !hasUnread;
}

function markNotificationsViewed() {
  localStorage.setItem(LAST_VIEWED_KEY, new Date().toISOString());
  document.querySelectorAll("[data-notif-bell-dot]").forEach((dot) => {
    dot.hidden = true;
  });
}

/**
 * Wires up the bell icon in the header: click to open/close the dropdown,
 * load and render recent notifications into it (fetched once and reused
 * across every instance of the panel on the page), show a static unread
 * dot when there's something newer than this device last viewed, and
 * close on an outside click or Escape.
 */
export function initNotificationBell() {
  const bells = document.querySelectorAll("[data-notif-bell]");
  if (bells.length === 0) return;

  fetchNotificationLog().then((entries) => updateUnreadDot(entries));

  bells.forEach((bell) => {
    const trigger = bell.querySelector("[data-notif-bell-toggle]");
    const panel = bell.querySelector("[data-notif-bell-panel]");
    if (!trigger || !panel) return;

    const closePanel = () => {
      bell.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    };

    const openPanel = async () => {
      bell.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      const entries = await fetchNotificationLog();
      renderNotificationList(entries);
      markNotificationsViewed();
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (bell.classList.contains("open")) {
        closePanel();
      } else {
        openPanel();
      }
    });

    document.addEventListener("click", (e) => {
      if (bell.classList.contains("open") && !bell.contains(e.target)) closePanel();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && bell.classList.contains("open")) closePanel();
    });
  });
}
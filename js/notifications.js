import { getToken, deleteToken } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";
import { messaging, messagingReady } from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";
import { saveNotificationToken, deleteNotificationToken } from "./firebase-service.js";

const STORAGE_KEY = "bem-notifications-enabled";
const TOKEN_KEY = "bem-notification-token";
// v2: the previous flag was often set after a messaging timeout without
// ever showing a permission dialog, so first-install users never got asked.
const PROMPTED_KEY = "bem-notifications-prompted-v2";

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

function markPrompted() {
  localStorage.setItem(PROMPTED_KEY, "true");
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
      markPrompted();
      return;
    }

    // Flip the in-app toggle immediately (banner Enable and the bell
    // control should stay in sync). Revert only if the OS dialog is denied.
    setToggleState("on");
    localStorage.setItem(STORAGE_KEY, "true");
    hidePermissionPrompt();

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      markPrompted();
      if (op !== operationId) return;
      if (permission !== "granted") {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setToggleState(permission === "denied" ? "denied" : "off");
        return;
      }
    } else {
      markPrompted();
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
    markPrompted();
    hidePermissionPrompt();
  });

  document.body.appendChild(banner);
}

function shouldOfferFirstRunPrompt() {
  if (!("Notification" in window)) return false;
  if (localStorage.getItem(PROMPTED_KEY) === "true") return false;
  if (Notification.permission !== "default") return false;
  return isRunningAsInstalledApp();
}

/**
 * After the visitor installs the PWA, or the first time they open it from
 * the home screen, show an in-app prompt whose Enable button is a real
 * user gesture — browsers will not show the OS permission dialog from a
 * timer or from page load alone.
 */
export function initAutoNotificationPrompt() {
  if (!("Notification" in window)) return;

  if (Notification.permission !== "default") {
    markPrompted();
    return;
  }

  const offer = () => {
    if (shouldOfferFirstRunPrompt()) showPermissionPrompt();
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
import { getToken, deleteToken } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";
import { messaging } from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";
import { saveNotificationToken, deleteNotificationToken } from "./firebase-service.js";

const STORAGE_KEY = "bem-notifications-enabled";
const TOKEN_KEY = "bem-notification-token";
const PROMPTED_KEY = "bem-notifications-prompted";

function isRunningAsInstalledApp() {
  // Standalone display mode covers Chrome/Edge/Android after "Install" or
  // "Add to Home Screen". navigator.standalone is Safari's older iOS-only
  // equivalent, which doesn't support the display-mode media query.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
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

async function enableNotifications() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setToggleState(permission === "denied" ? "denied" : "off");
      return;
    }
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      setToggleState("off");
      return;
    }
    await saveNotificationToken(token);
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(TOKEN_KEY, token);
    setToggleState("on");
  } catch (err) {
    console.error("Notification subscription failed:", err);
    setToggleState("off");
  }
}

async function disableNotifications() {
  try {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (messaging) {
      await deleteToken(messaging).catch(() => {
        // Token may already be invalid/expired on the browser's side —
        // that's fine, we still want to clear our own records below.
      });
    }
    if (storedToken) {
      await deleteNotificationToken(storedToken).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to fully disable notifications:", err);
  } finally {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToggleState("off");
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

  // Wait for the async isSupported() check in firebase-init.js to resolve
  // before deciding the UI state — messaging may end up null either
  // because the browser genuinely doesn't support it, or simply because
  // the check hasn't finished yet. Retry a few times over a few seconds
  // before concluding it's truly unsupported.
  const finishInit = () => {
    if (Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true") {
      setToggleState("on");
    } else {
      setToggleState("off");
    }

    groups.forEach((group) => {
      const offBtn = group.querySelector('[data-notif-btn="off"]');
      const onBtn = group.querySelector('[data-notif-btn="on"]');
      if (offBtn) offBtn.addEventListener("click", disableNotifications);
      if (onBtn) onBtn.addEventListener("click", enableNotifications);
    });
  };

  let attempts = 0;
  const tryInit = () => {
    attempts += 1;
    if (messaging) {
      finishInit();
    } else if (attempts < 6) {
      setTimeout(tryInit, 500);
    } else {
      setToggleState("unsupported");
    }
  };
  tryInit();
}

/**
 * Prompts for notification permission automatically, but only once ever,
 * and only when the site is opened as the installed app (standalone mode)
 * rather than a regular browser tab — opening an installed app's icon is
 * itself a deliberate action, which keeps this from being the kind of
 * unprompted popup browsers tend to auto-block.
 *
 * After this first prompt (whether granted, denied, or dismissed), it
 * never asks again automatically — the visitor can still change their
 * mind later via the on/off toggle in the settings menu.
 */
export function initAutoNotificationPrompt() {
  if (!("Notification" in window)) return;
  if (!isRunningAsInstalledApp()) return;
  if (localStorage.getItem(PROMPTED_KEY) === "true") return;
  if (Notification.permission !== "default") {
    // Already answered (granted/denied) from a previous visit, possibly
    // before this flag existed — don't ask again, just remember that.
    localStorage.setItem(PROMPTED_KEY, "true");
    return;
  }

  // Give the app a moment to finish loading before interrupting with a
  // permission prompt, rather than asking the instant it opens. messaging's
  // own async isSupported() check may also still be pending, so retry a
  // few times before concluding it's genuinely unsupported.
  let attempts = 0;
  const tryPrompt = () => {
    attempts += 1;
    if (messaging) {
      localStorage.setItem(PROMPTED_KEY, "true");
      enableNotifications();
    } else if (attempts < 6) {
      setTimeout(tryPrompt, 500);
    } else {
      // Genuinely unsupported (or never resolved) — don't keep the
      // "not yet prompted" flag hanging around forever, or we'd retry
      // this same check on every single app launch.
      localStorage.setItem(PROMPTED_KEY, "true");
    }
  };
  setTimeout(tryPrompt, 1500);
}
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

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/service-worker.js");
  } catch {
    return undefined;
  }
}

async function subscribePush(op) {
  const ready = await messagingReady;
  if (op !== operationId) return;
  if (!ready) {
    setToggleState("unsupported");
    localStorage.removeItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToggleState("off");
    return;
  }

  await saveNotificationToken(token);
  if (op !== operationId) {
    await deleteNotificationToken(token).catch(() => {});
    return;
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

    // Permission already granted: flip the switch immediately so the toggle
    // doesn't wait on getToken / Firestore. First-time permission still
    // waits for the OS dialog before changing state.
    if (Notification.permission === "granted") {
      setToggleState("on");
      markPrompted();
    } else {
      const permission = await Notification.requestPermission();
      markPrompted();
      if (op !== operationId) return;
      if (permission !== "granted") {
        localStorage.removeItem(STORAGE_KEY);
        setToggleState(permission === "denied" ? "denied" : "off");
        return;
      }
      setToggleState("on");
    }

    localStorage.setItem(STORAGE_KEY, "true");
    hidePermissionPrompt();
    await subscribePush(op);
  } catch (err) {
    console.error("Notification subscription failed:", err);
    if (op !== operationId) return;
    localStorage.removeItem(STORAGE_KEY);
    setToggleState("off");
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
    // Still in the browser tab that ran the install. Show the prompt here
    // too — the next launch as a standalone app will also offer it if they
    // skip this one (until they enable or dismiss).
    if (Notification.permission === "default" && localStorage.getItem(PROMPTED_KEY) !== "true") {
      showPermissionPrompt();
    }
  });

  // iOS / some Android WebViews report standalone only after the first
  // paint, or after the display-mode media query starts matching.
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (event) => {
    if (event.matches) offer();
  });
}

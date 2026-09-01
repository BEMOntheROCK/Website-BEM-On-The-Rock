import { getToken } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";
import { messaging } from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";
import { saveNotificationToken } from "./firebase-service.js";

const STORAGE_KEY = "bem-notifications-enabled";
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

function setButtonState(button, state) {
  // state: "off" | "on" | "unsupported" | "denied"
  if (!button) return;
  const icon = button.querySelector("i");
  const label = button.querySelector("span");

  if (state === "on") {
    icon.className = "fa-solid fa-bell";
    label.textContent = "Notifications on";
    button.classList.add("is-active");
    button.disabled = false;
  } else if (state === "denied") {
    icon.className = "fa-solid fa-bell-slash";
    label.textContent = "Notifications blocked";
    button.classList.remove("is-active");
    button.disabled = true;
    button.title = "Notifications are blocked in your browser settings for this site.";
  } else if (state === "unsupported") {
    icon.className = "fa-solid fa-bell-slash";
    label.textContent = "Notifications unavailable";
    button.classList.remove("is-active");
    button.disabled = true;
    button.title = "Push notifications aren't supported in this browser. On iPhone, add this site to your Home Screen first.";
  } else {
    icon.className = "fa-regular fa-bell";
    label.textContent = "Enable notifications";
    button.classList.remove("is-active");
    button.disabled = false;
  }
}

function setAllButtonsState(buttons, state) {
  buttons.forEach((button) => setButtonState(button, state));
}

async function subscribe(buttons) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setAllButtonsState(buttons, permission === "denied" ? "denied" : "off");
      return;
    }
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      setAllButtonsState(buttons, "off");
      return;
    }
    await saveNotificationToken(token);
    localStorage.setItem(STORAGE_KEY, "true");
    setAllButtonsState(buttons, "on");
  } catch (err) {
    console.error("Notification subscription failed:", err);
    setAllButtonsState(buttons, "off");
  }
}

export function initNotificationToggle() {
  // There can be more than one toggle on the page at once — the desktop
  // settings dropdown's button and the mobile menu's button both use the
  // same [data-notif-toggle] marker, the same way the language toggle
  // already appears in more than one place.
  const buttons = Array.from(document.querySelectorAll("[data-notif-toggle]"));
  if (buttons.length === 0) return;

  if (!("Notification" in window)) {
    setAllButtonsState(buttons, "unsupported");
    return;
  }

  if (Notification.permission === "denied") {
    setAllButtonsState(buttons, "denied");
    return;
  }

  // Wait for the async isSupported() check in firebase-init.js to resolve
  // before deciding the UI state — messaging may end up null on browsers
  // that don't support it (e.g. Safari outside of a home-screen install).
  const checkSupport = () => {
    if (messaging === null && Notification.permission !== "granted") {
      // Still ambiguous (isSupported() may not have resolved yet); try
      // again shortly rather than assuming unsupported prematurely.
      return false;
    }
    return true;
  };

  const finishInit = () => {
    if (!messaging) {
      setAllButtonsState(buttons, "unsupported");
      return;
    }
    if (Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true") {
      setAllButtonsState(buttons, "on");
    } else {
      setAllButtonsState(buttons, "off");
    }
    buttons.forEach((button) => {
      button.addEventListener("click", () => subscribe(buttons));
    });
  };

  if (checkSupport()) {
    finishInit();
  } else {
    setTimeout(finishInit, 500);
  }
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
 * mind later via the "Enable notifications" toggle in the settings menu.
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
      const buttons = Array.from(document.querySelectorAll("[data-notif-toggle]"));
      subscribe(buttons);
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
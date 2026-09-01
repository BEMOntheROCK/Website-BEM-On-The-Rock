import { getToken } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";
import { messaging } from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";
import { saveNotificationToken } from "./firebase-service.js";

const STORAGE_KEY = "bem-notifications-enabled";

function setButtonState(button, state) {
  // state: "off" | "on" | "unsupported" | "denied"
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

async function subscribe(button) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setButtonState(button, permission === "denied" ? "denied" : "off");
      return;
    }
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      setButtonState(button, "off");
      return;
    }
    await saveNotificationToken(token);
    localStorage.setItem(STORAGE_KEY, "true");
    setButtonState(button, "on");
  } catch (err) {
    console.error("Notification subscription failed:", err);
    setButtonState(button, "off");
  }
}

export function initNotificationToggle() {
  const button = document.querySelector("[data-notif-toggle]");
  if (!button) return;

  if (!("Notification" in window)) {
    setButtonState(button, "unsupported");
    return;
  }

  if (Notification.permission === "denied") {
    setButtonState(button, "denied");
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
      setButtonState(button, "unsupported");
      return;
    }
    if (Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true") {
      setButtonState(button, "on");
    } else {
      setButtonState(button, "off");
    }
    button.addEventListener("click", () => subscribe(button));
  };

  if (checkSupport()) {
    finishInit();
  } else {
    setTimeout(finishInit, 500);
  }
}
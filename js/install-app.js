/**
 * "Download the app" install flow.
 *
 * Two entry points trigger the exact same logic:
 *   - The floating button (mobile only, dismissible for the session)
 *   - The permanent "Download the app" item in the mobile hamburger menu
 *     (always reachable, even after the floating button is dismissed)
 *
 * Behavior depends on what the visitor's browser actually supports:
 *   - Already installed (standalone)        → both entry points hidden
 *   - Android/Desktop Chrome, Edge, Samsung  → real native install prompt
 *   - Android, unsupported browser (Firefox) → generic fallback instructions
 *   - iOS, in Safari                         → Share → Add to Home Screen guide
 *   - iOS, NOT in Safari                     → "please switch to Safari" guide
 */

const DISMISS_KEY = "bem-install-fab-dismissed";

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  updateVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  updateVisibility();
});

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as "MacIntel" in the user agent, so touch
    // support is the only reliable way left to tell it apart from a real Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isIOSSafari() {
  if (!isIOS()) return false;
  // Every non-Safari browser on iOS still identifies itself in the user
  // agent, even though (per Apple's rules) they all actually run on
  // Safari's own engine under the hood. Only real Safari lacks all of these.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(navigator.userAgent);
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function getScenario() {
  if (deferredPrompt) return "native";
  if (isIOS()) return isIOSSafari() ? "step2" : "step1";
  if (isAndroid()) return "fallback";
  return "fallback";
}

function openModal(scenario) {
  const overlay = document.querySelector("[data-install-modal]");
  if (!overlay) return;

  overlay.querySelectorAll("[data-install-scenario]").forEach((panel) => {
    panel.classList.toggle("active", panel.getAttribute("data-install-scenario") === scenario);
  });

  overlay.classList.add("open");
}

function closeModal() {
  const overlay = document.querySelector("[data-install-modal]");
  if (overlay) overlay.classList.remove("open");
}

async function handleInstallTrigger() {
  if (isStandalone()) return;

  const scenario = getScenario();

  if (scenario === "native") {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    updateVisibility();
    // Whether accepted or dismissed, the browser's own native prompt
    // already gave the visitor a clear choice — no follow-up modal needed.
    return;
  }

  openModal(scenario);
}

function updateVisibility() {
  const fab = document.querySelectorAll("[data-install-fab]");
  const menuItems = document.querySelectorAll("[data-install-menu-item]");
  const installed = isStandalone();
  const dismissed = sessionStorage.getItem(DISMISS_KEY) === "true";

  menuItems.forEach((el) => {
    el.hidden = installed;
  });
  fab.forEach((el) => {
    el.hidden = installed || dismissed;
  });
}

export function initInstallApp() {
  updateVisibility();

  document.querySelectorAll("[data-install-fab-trigger], [data-install-menu-trigger]").forEach((el) => {
    el.addEventListener("click", handleInstallTrigger);
  });

  const dismissBtn = document.querySelector("[data-install-fab-dismiss]");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      sessionStorage.setItem(DISMISS_KEY, "true");
      updateVisibility();
    });
  }

  const modalClose = document.querySelector("[data-install-modal-close]");
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  const overlay = document.querySelector("[data-install-modal]");
  if (overlay) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });
  }
}
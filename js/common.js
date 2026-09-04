import { initTheme } from "./theme.js";
import { initNotificationToggle, initAutoNotificationPrompt } from "./notifications.js";
import { initInstallApp } from "./install-app.js";

initTheme();
initNotificationToggle();
initAutoNotificationPrompt();
initInstallApp();

// Register the service worker on every public page, but never on the admin
// panel — admin should always load fresh, never an offline/cached version.
if ("serviceWorker" in navigator && !window.location.pathname.endsWith("admin.html")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}

// Themed scrollbars (see css/styles.css) are transparent until actively
// scrolled, then fade back out after a short pause. A single capture-phase
// listener on the document catches scroll events from the page itself and
// from any nested scrollable element (admin sidebar/content, modals, etc.)
// without needing to know in advance which elements are scrollable.
(function initAutoHideScrollbars() {
  const hideTimers = new WeakMap();
  document.addEventListener(
    "scroll",
    (event) => {
      const target = event.target === document ? document.documentElement : event.target;
      if (!target || !target.classList) return;

      target.classList.add("is-scrolling");
      clearTimeout(hideTimers.get(target));
      hideTimers.set(
        target,
        setTimeout(() => target.classList.remove("is-scrolling"), 800)
      );
    },
    true
  );
})();

const mobileBtn = document.querySelector("[data-mobile-menu]");
const navLinks  = document.querySelector(".nav-links");
const navMoreToggle = document.querySelector("[data-nav-more-toggle]");

function collapseMoreSection() {
  if (!navLinks || !navMoreToggle) return;
  navLinks.classList.remove("more-open");
  navMoreToggle.setAttribute("aria-expanded", "false");
}

function openMenu() {
  navLinks.classList.add("open");
  document.body.classList.add("nav-open");
  mobileBtn.textContent = "✕";
  mobileBtn.setAttribute("aria-label", "Close menu");
  // The "More" section always starts collapsed each time the menu opens,
  // regardless of whether it was left expanded on a previous open.
  collapseMoreSection();
}

function closeMenu() {
  navLinks.classList.remove("open");
  document.body.classList.remove("nav-open");
  mobileBtn.textContent = "☰";
  mobileBtn.setAttribute("aria-label", "Open menu");
}

if (mobileBtn && navLinks) {
  // Toggle on hamburger click
  mobileBtn.addEventListener("click", () => {
    navLinks.classList.contains("open") ? closeMenu() : openMenu();
  });

  // Close when a nav link is clicked
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => closeMenu());
  });

  // Close when clicking outside the nav
  document.addEventListener("click", e => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !mobileBtn.contains(e.target)
    ) {
      closeMenu();
    }
  });
}

// ── Collapsible "More" section inside the mobile menu ──
if (navMoreToggle && navLinks) {
  navMoreToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("more-open");
    navMoreToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

// ── Desktop settings dropdown (gear icon: language, privacy, admin) ──
document.querySelectorAll("[data-settings-dropdown]").forEach((wrapper) => {
  const toggleBtn = wrapper.querySelector("[data-settings-toggle]");
  const menu = wrapper.querySelector("[data-settings-menu]");
  if (!toggleBtn || !menu) return;

  function openDropdown() {
    wrapper.classList.add("open");
    toggleBtn.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    wrapper.classList.remove("open");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  document.addEventListener("click", (e) => {
    if (wrapper.classList.contains("open") && !wrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && wrapper.classList.contains("open")) {
      closeDropdown();
      toggleBtn.focus();
    }
  });

  // Close the dropdown only when a real navigational link inside it is
  // used (Privacy Policy, Admin) — the language and notification toggles
  // should stay open so people can flip between options without the menu
  // closing on them each time.
  menu.querySelectorAll(".settings-dropdown-link").forEach((el) => {
    el.addEventListener("click", () => closeDropdown());
  });
});

export function showAlert(container, message, type = "error") {
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}
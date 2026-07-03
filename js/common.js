import { initTheme } from "./theme.js";

initTheme();

const mobileBtn = document.querySelector("[data-mobile-menu]");
const navLinks  = document.querySelector(".nav-links");

function openMenu() {
  navLinks.classList.add("open");
  mobileBtn.textContent = "✕";
  mobileBtn.setAttribute("aria-label", "Close menu");
}

function closeMenu() {
  navLinks.classList.remove("open");
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

export function showAlert(container, message, type = "error") {
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}
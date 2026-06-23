import { initTheme } from "./theme.js";

initTheme();

const mobileBtn = document.querySelector("[data-mobile-menu]");
const navLinks = document.querySelector(".nav-links");

if (mobileBtn && navLinks) {
  mobileBtn.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

export function showAlert(container, message, type = "error") {
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

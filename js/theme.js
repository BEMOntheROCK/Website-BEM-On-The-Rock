const STORAGE_KEY = "bem-theme";

export function getTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
  updateToggleIcons(theme);
}

function updateToggleIcons(theme) {
  document.querySelectorAll("[data-theme-icon]").forEach((el) => {
    el.textContent = theme === "dark" ? "☀️" : "🌙";
  });
  document.querySelectorAll("[data-theme-label]").forEach((el) => {
    el.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  });
}

export function initTheme() {
  const theme = getTheme();
  applyTheme(theme);

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });
}

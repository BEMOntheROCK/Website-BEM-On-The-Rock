// ── Scroll fade-up animation via IntersectionObserver ──

const FADE_SELECTORS = [
  ".section-header",
  ".livestream-card",
  ".card",
  ".update-item",
  ".history-card",
  ".leader-card",
  ".about-block",
  ".founder-card",
  ".info-section",
  ".office-hours-block",
  ".social-links",
  ".contact-bar",
  ".org-chart-image",
  ".leaders-category",
].join(", ");

function initFadeUp() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("fade-up--visible");
          observer.unobserve(entry.target); // animate once only
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  // Observe existing elements
  document.querySelectorAll(FADE_SELECTORS).forEach((el) => {
    el.classList.add("fade-up");
    observer.observe(el);
  });

  // Re-observe dynamically injected content (news cards, updates etc.)
  const mutationObserver = new MutationObserver(() => {
    document.querySelectorAll(`${FADE_SELECTORS}:not(.fade-up)`).forEach((el) => {
      el.classList.add("fade-up");
      observer.observe(el);
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

// ── Back to top button ──
function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 300);
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Run after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initFadeUp();
  initBackToTop();
});

// Also run immediately in case DOMContentLoaded already fired (module scripts)
if (document.readyState !== "loading") {
  initFadeUp();
  initBackToTop();
}
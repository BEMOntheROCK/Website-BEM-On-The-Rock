import { initHeroBanner } from "./common.js";
import { hideLoadingOverlay } from "./loading-overlay.js";

document.getElementById("year").textContent = new Date().getFullYear();
initHeroBanner("product", "product-hero");

// Nothing to fetch yet — this page is a placeholder until the Product
// page's actual content is decided. Swap this out once there's real data
// to load, following the same pattern as community.js/activities.js.
hideLoadingOverlay();
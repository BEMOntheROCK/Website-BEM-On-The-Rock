import "./common.js";
import { showAlert } from "./common.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { auth } from "./firebase-init.js";
import {
  getSiteSettings, saveSiteSettings,
  getAboutContent, saveAboutContent,
  getOrgStructure, saveOrgStructure,
  getLeaders, createLeader, updateLeader, deleteLeader,
  getCategories, createCategory, updateCategory, deleteCategory, saveCategories,
  getCommunityContent, saveCommunityContent,
  getPrivacyContent, savePrivacyContent,
  getCommunityPhotos, createCommunityPhoto, updateCommunityPhoto, deleteCommunityPhoto, saveCommunityPhotosOrder,
  getActivities, createActivity, updateActivity, deleteActivity,
  getServices, createService, updateService, deleteService,
  getCarouselVideos, createCarouselVideo, updateCarouselVideo, deleteCarouselVideo, saveCarouselVideosOrder,
  getNews, createNews, updateNews, deleteNews,
  getUpdates, createUpdate, updateUpdate, deleteUpdate,
  getHistory, createHistory, updateHistory, deleteHistory,
  formatDate, displayHistoryDate,
  extractDateYear, isAmbiguousGroup, computeBackfillOrder,
} from "./firebase-service.js";
import { bindImageUpload, deleteImage, getImageUrl } from "./image-service.js";
import { createCropEditor } from "./crop-editor.js";
import { DEFAULT_CROP } from "./image-crop.js";

// ── DOM refs ──
const authScreen    = document.getElementById("auth-screen");
const dashboard     = document.getElementById("admin-dashboard");
const logoutBtn     = document.getElementById("logout-btn");
const authAlert     = document.getElementById("auth-alert");
const adminAlert    = document.getElementById("admin-alert");
const loginForm     = document.getElementById("login-form");

// Modals
const crudModal     = document.getElementById("crud-modal");
const crudForm      = document.getElementById("crud-form");
const leaderModal   = document.getElementById("leader-modal");
const leaderForm    = document.getElementById("leader-form");
const catModal      = document.getElementById("category-modal");
const catForm       = document.getElementById("category-form");
const confirmModal  = document.getElementById("confirm-modal");
const confirmMsgEl  = document.getElementById("confirm-modal-message");
const confirmYesBtn = document.getElementById("confirm-modal-yes");
const confirmNoBtn  = document.getElementById("confirm-modal-no");

// ── State ──
let newsData       = [];
let updatesData    = [];
let historyData    = [];
let leadersData    = [];
let categoriesData = [];
let activitiesData    = [];
let servicesData      = [];
let communityContentData = { introText: "" };
let communityPhotosData  = [];
let carouselVideosData = [];
let dataLoaded     = false;

let crudImgUpload    = null;
let cropEditor        = null;
let leaderImgUpload  = null;
let orgChartUpload   = null;
let activityImgUpload = null;
let serviceImgUpload = null;
let communityPhotoImgUpload = null;
let aboutUploads     = {};

// ── Helpers ──
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

function toInputDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (val.toDate) return val.toDate().toISOString().slice(0, 10);
  return new Date(val).toISOString().slice(0, 10);
}

function getCategoryName(id) {
  if (!id) return "—";
  return categoriesData.find(c => c.id === id)?.name || "—";
}

function safeBind(id, opts) {
  const el = document.getElementById(id);
  if (!el) return null;
  return bindImageUpload(el, opts);
}

function authError(code) {
  const map = {
    "auth/invalid-email": "Invalid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
  };
  return map[code] || "Sign in failed. Please try again.";
}

// ── Custom confirm modal (replaces native confirm()) ──
function confirmAction(message) {
  return new Promise(resolve => {
    confirmMsgEl.textContent = message;
    confirmModal.classList.add("open");
    const cleanup = result => {
      confirmModal.classList.remove("open");
      confirmYesBtn.removeEventListener("click", onYes);
      confirmNoBtn.removeEventListener("click", onNo);
      confirmModal.removeEventListener("click", onOverlay);
      resolve(result);
    };
    const onYes = () => cleanup(true);
    const onNo  = () => cleanup(false);
    const onOverlay = e => { if (e.target === confirmModal) cleanup(false); };
    confirmYesBtn.addEventListener("click", onYes);
    confirmNoBtn.addEventListener("click", onNo);
    confirmModal.addEventListener("click", onOverlay);
  });
}

// ── Plain-language validation messages ──
function friendlyValidationMessage(input) {
  if (input.validity.valueMissing) return "This field is required.";
  if (input.type === "url" && input.validity.typeMismatch) {
    return "This doesn't look like a web link — make sure it starts with https://";
  }
  if (input.type === "email" && input.validity.typeMismatch) {
    return "This doesn't look like an email address — check for typos.";
  }
  return "";
}

document.addEventListener("invalid", e => {
  const input = e.target;
  if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA" && input.tagName !== "SELECT") return;
  const msg = friendlyValidationMessage(input);
  if (msg) input.setCustomValidity(msg);
}, true);

document.addEventListener("input", e => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") e.target.setCustomValidity("");
});
document.addEventListener("change", e => {
  if (e.target.tagName === "SELECT") e.target.setCustomValidity("");
});

/** Shows "Last edited" for a Firestore document, falling back to
    createdAt (updatedAt is only set once an item has been edited). */
function formatUpdatedAt(item) {
  const ts = item?.updatedAt ?? item?.createdAt;
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Resolve image URLs for a batch of items in parallel (dedupes by imageId).
    Returns a Map<imageId, url|null> for use with thumbCell(). */
async function buildThumbMap(items) {
  const ids = [...new Set(items.map(i => i?.imageId).filter(Boolean))];
  const entries = await Promise.all(ids.map(async id => [id, await getImageUrl(id).catch(() => null)]));
  return new Map(entries);
}

/** Render a <td> thumbnail cell — an actual image preview if one exists,
    otherwise a placeholder icon, so admins can recognize items at a glance. */
function thumbCell(imageId, thumbMap, alt = "") {
  const url = imageId ? thumbMap.get(imageId) : null;
  if (url) {
    return `<td class="admin-thumb-cell"><img class="admin-thumb" src="${url}" alt="${esc(alt)}" loading="lazy" /></td>`;
  }
  return `<td class="admin-thumb-cell"><span class="admin-thumb-placeholder" title="No image uploaded"><i class="fa-solid fa-image"></i></span></td>`;
}
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAlert(authAlert, authError(err.code));
  }
});

// ── Show/hide password toggle on the login screen ──
const loginPasswordInput = document.getElementById("login-password");
const loginPasswordToggle = document.getElementById("login-password-toggle");
loginPasswordToggle?.addEventListener("click", () => {
  const isHidden = loginPasswordInput.type === "password";
  loginPasswordInput.type = isHidden ? "text" : "password";
  loginPasswordToggle.setAttribute("aria-pressed", String(isHidden));
  loginPasswordToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  loginPasswordToggle.innerHTML = isHidden
    ? `<i class="fa-solid fa-eye-slash"></i>`
    : `<i class="fa-solid fa-eye"></i>`;
  loginPasswordInput.focus();
});

logoutBtn.addEventListener("click", () => {
  dataLoaded = false;
  signOut(auth);
});

onAuthStateChanged(auth, user => {
  if (user) {
    authScreen.style.display  = "none";
    dashboard.style.display   = "grid";
    logoutBtn.style.display   = "inline-flex";
    if (!dataLoaded) { dataLoaded = true; initAll(); }
  } else {
    authScreen.style.display  = "flex";
    dashboard.style.display   = "none";
    logoutBtn.style.display   = "none";
    dataLoaded = false;
  }
});

// ── Panel switching ──
document.querySelectorAll("[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-panel]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
  });
});

// ── Init ──
async function initAll() {
  // Bind image uploads once
  const cropEditorContainer = document.getElementById("crud-crop-editor");
  if (cropEditorContainer) {
    cropEditor = createCropEditor(cropEditorContainer);
  }
  crudImgUpload   = safeBind("crud-image-upload",      {
    inputId: "crud-img-in",
    label: "Article Image",
    onImageIdChange: async (newId) => {
      if (!cropEditor) return;
      const url = newId ? await getImageUrl(newId) : null;
      cropEditor.setImage(url);
    },
  });
  leaderImgUpload = safeBind("leader-image-upload",    { inputId: "leader-img-in",  label: "Leader Photo" });
  orgChartUpload  = safeBind("org-chart-image-upload", { inputId: "org-img-in",     label: "Organisation Chart Image" });
  activityImgUpload = safeBind("activity-image-upload", { inputId: "act-img-in", label: "Activity Image" });
  serviceImgUpload = safeBind("service-image-upload", { inputId: "service-img-in", label: "Service Image" });
  communityPhotoImgUpload = safeBind("community-photo-image-upload", { inputId: "comm-img-in", label: "Photo" });
  aboutUploads = {
    founder: safeBind("about-founder-image-upload", { inputId: "ab-founder-in", label: "Founder Photo" }),
    mission: safeBind("about-mission-image-upload", { inputId: "ab-mission-in", label: "Mission Image" }),
    vision:  safeBind("about-vision-image-upload",  { inputId: "ab-vision-in",  label: "Vision Image" }),
    values:  safeBind("about-values-image-upload",  { inputId: "ab-values-in",  label: "Values Image" }),
  };

  await Promise.all([
    loadNews(),
    loadUpdates(),
    loadHistory(),
    loadCategories(),
    loadAboutForm(),
    loadOrgForm(),
    loadSettings(),
    loadYoutubeSettings(),
    loadCommunityContent(),
    loadCommunityPhotos(),
    loadPrivacyForm(),
  ]);
  // Leaders and activities depend on their categories being loaded first
  await loadLeaders();
  await loadActivities();
  await loadServices();
  await loadCarouselVideos();
}

// ══════════════════════════════════════════
// NEWS
// ══════════════════════════════════════════
async function loadNews() {
  const tbody = document.getElementById("news-table-body");
  tbody.innerHTML = `<tr><td colspan="5" class="loading">Loading…</td></tr>`;
  newsData = await getNews();
  document.getElementById("news-count").textContent = `${newsData.length} article(s)`;

  if (!newsData.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No news yet.</td></tr>`;
    return;
  }
  const thumbs = await buildThumbMap(newsData);
  tbody.innerHTML = newsData.map(item => `
    <tr>
      ${thumbCell(item.imageId, thumbs, item.title)}
      <td>${esc(item.title)}</td>
      <td>${esc(formatDate(item.date))}</td>
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-news" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-news"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");
}

document.getElementById("add-news-btn").addEventListener("click", () => openCrud("news"));

document.getElementById("news-table-body").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-news") openCrud("news", btn.dataset.id);
  if (btn.dataset.action === "del-news")  confirmDelete("news", btn.dataset.id);
});

// ══════════════════════════════════════════
// UPDATES
// ══════════════════════════════════════════
async function loadUpdates() {
  const tbody = document.getElementById("updates-table-body");
  tbody.innerHTML = `<tr><td colspan="6" class="loading">Loading…</td></tr>`;
  updatesData = await getUpdates();
  document.getElementById("updates-count").textContent = `${updatesData.length} update(s)`;

  if (!updatesData.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No updates yet.</td></tr>`;
    return;
  }
  const thumbs = await buildThumbMap(updatesData);
  tbody.innerHTML = updatesData.map(item => `
    <tr>
      ${thumbCell(item.imageId, thumbs, item.title)}
      <td>${esc(item.title)}</td>
      <td>${esc(formatDate(item.date))}</td>
      <td>${esc(item.priority || "normal")}</td>
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-update" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-update"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");
}

document.getElementById("add-update-btn").addEventListener("click", () => openCrud("updates"));

document.getElementById("updates-table-body").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-update") openCrud("updates", btn.dataset.id);
  if (btn.dataset.action === "del-update")  confirmDelete("updates", btn.dataset.id);
});

// ══════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════
async function loadHistory() {
  const tbody = document.getElementById("history-table-body");
  tbody.innerHTML = `<tr><td colspan="6" class="loading">Loading…</td></tr>`;
  historyData = await getHistory("desc");
  await backfillHistoryOrder(historyData);
  document.getElementById("history-count").textContent = `${historyData.length} article(s)`;

  if (!historyData.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No history articles yet.</td></tr>`;
    return;
  }

  const yearGroups = {};
  historyData.forEach(item => {
    const year = extractDateYear(item.date) ?? "unknown";
    (yearGroups[year] ??= []).push(item);
  });

  const thumbs = await buildThumbMap(historyData);
  tbody.innerHTML = historyData.map(item => {
    const year = extractDateYear(item.date) ?? "unknown";
    const group = yearGroups[year];
    const groupable = isAmbiguousGroup(group);
    const groupIdx = groupable ? group.findIndex(g => g.id === item.id) : -1;
    return `
    <tr ${groupable ? `draggable="true"` : ""} data-history-id="${item.id}" data-history-year="${esc(String(year))}">
      <td>
        ${groupable ? `<span class="drag-handle" title="Drag to reorder within same year">⠿</span>
        <span class="reorder-btns">
          <button type="button" class="reorder-btn" data-reorder="history-up" data-id="${item.id}" ${groupIdx === 0 ? "disabled" : ""} aria-label="Move up">▲</button>
          <button type="button" class="reorder-btn" data-reorder="history-down" data-id="${item.id}" ${groupIdx === group.length - 1 ? "disabled" : ""} aria-label="Move down">▼</button>
        </span>` : ""}
      </td>
      ${thumbCell(item.imageId, thumbs, item.title)}
      <td>${esc(item.title)}</td>
      <td>${esc(displayHistoryDate(item.date))}</td>
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-history" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-history"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  bindHistoryDrag(tbody);
}

/** One-time backfill: assign `order` to any item in an ambiguous year-group
    that lacks one. Default ranks less-precise dates earlier, more-precise
    dates later (see computeBackfillOrder in firebase-service.js). */
async function backfillHistoryOrder(items) {
  const updates = computeBackfillOrder(items);
  if (updates.length) {
    await Promise.all(updates.map(u => updateHistory(u.id, { order: u.order })));
  }
}

function bindHistoryDrag(tbody) {
  let dragSrc = null;
  tbody.querySelectorAll("tr[draggable='true']").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      dragSrc = null;
    });
    row.addEventListener("dragover", e => {
      if (!dragSrc || dragSrc.dataset.historyYear !== row.dataset.historyYear) return;
      e.preventDefault();
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      if (row !== dragSrc) row.classList.add("drag-over");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      if (dragSrc.dataset.historyYear !== row.dataset.historyYear) return;

      const groupYear = row.dataset.historyYear;
      const group = historyData.filter(i => String(extractDateYear(i.date) ?? "unknown") === groupYear);
      const rows  = [...tbody.querySelectorAll(`tr[data-history-year="${CSS.escape(groupYear)}"]`)];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      const reorder = [...group];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);

      try {
        await Promise.all(reorder.map((item, i) => updateHistory(item.id, { order: i, orderSource: "manual" })));
        showAlert(adminAlert, "History order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save history order.");
      }
      await loadHistory();
    });
  });
}

document.getElementById("add-history-btn").addEventListener("click", () => openCrud("history"));

document.getElementById("history-table-body").addEventListener("click", async e => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit-history") openCrud("history", btn.dataset.id);
    if (btn.dataset.action === "del-history")  confirmDelete("history", btn.dataset.id);
    return;
  }
  const reorderBtn = e.target.closest("[data-reorder]");
  if (!reorderBtn || reorderBtn.disabled) return;
  const id  = reorderBtn.dataset.id;
  const dir = reorderBtn.dataset.reorder === "history-up" ? -1 : 1;
  const item = historyData.find(h => h.id === id);
  if (!item) return;
  const year = extractDateYear(item.date) ?? "unknown";
  const group = historyData.filter(h => (extractDateYear(h.date) ?? "unknown") === year);
  const idx = group.findIndex(h => h.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= group.length) return;
  const reorder = [...group];
  [reorder[idx], reorder[swapIdx]] = [reorder[swapIdx], reorder[idx]];
  try {
    await Promise.all(reorder.map((h, i) => updateHistory(h.id, { order: i, orderSource: "manual" })));
    showAlert(adminAlert, "History order saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save history order.");
  }
  await loadHistory();
});

// ══════════════════════════════════════════
// CRUD MODAL (News / Updates / History)
// ══════════════════════════════════════════
const CRUD_LABELS = { news: "News", updates: "Update", history: "History Article" };

function getItems(type) {
  if (type === "news")    return newsData;
  if (type === "updates") return updatesData;
  return historyData;
}

function openCrud(type, id = null) {
  const item  = id ? getItems(type).find(i => i.id === id) : null;
  const label = CRUD_LABELS[type] || "Item";

  document.getElementById("modal-title").textContent  = id ? `Edit ${label}` : `Add ${label}`;
  document.getElementById("crud-id").value            = id || "";
  document.getElementById("crud-type").value          = type;
  document.getElementById("crud-title").value         = item?.title || "";
  document.getElementById("crud-content").value       = item?.content || "";

  const dateInput  = document.getElementById("crud-date");
  const dateLabel  = document.getElementById("crud-date-label");
  const prioGroup  = document.getElementById("crud-priority-group");

  if (type === "history") {
    dateInput.type        = "text";
    dateInput.placeholder = "e.g. 1998 or March 2005";
    dateLabel.textContent = "Date / Period";
    dateInput.value       = item?.date || "";
  } else {
    dateInput.type        = "date";
    dateInput.placeholder = "";
    dateLabel.textContent = "Date";
    dateInput.value       = toInputDate(item?.date);
  }

  prioGroup.style.display = type === "updates" ? "block" : "none";
  if (type === "updates") document.getElementById("crud-priority").value = item?.priority || "normal";

  crudImgUpload?.setImageId(item?.imageId || null);

  const cropEditorContainer = document.getElementById("crud-crop-editor");
  if (cropEditorContainer) {
    cropEditorContainer.style.display = type === "news" ? "block" : "none";
    if (type === "news" && item?.imageId) {
      getImageUrl(item.imageId).then(url => {
        cropEditor?.setImage(url);
        cropEditor?.setCrop(item?.crop || DEFAULT_CROP);
      });
    } else {
      cropEditor?.setImage(null);
    }
  }

  crudModal.classList.add("open");
}

function closeCrud() {
  crudModal.classList.remove("open");
  crudForm.reset();
  crudImgUpload?.setImageId(null);
  cropEditor?.setImage(null);
}

document.getElementById("modal-close").addEventListener("click", closeCrud);
document.getElementById("modal-cancel").addEventListener("click", closeCrud);

crudForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id      = document.getElementById("crud-id").value;
  const type    = document.getElementById("crud-type").value;
  const payload = {
    title:   document.getElementById("crud-title").value.trim(),
    content: document.getElementById("crud-content").value.trim(),
    date:    document.getElementById("crud-date").value.trim(),
    imageId: crudImgUpload?.getImageId() || null,
  };
  if (type === "updates") payload.priority = document.getElementById("crud-priority").value;
  if (type === "news" && payload.imageId) payload.crop = cropEditor?.getCrop() || DEFAULT_CROP;

  try {
    if (type === "news") {
      id ? await updateNews(id, payload) : await createNews(payload);
      await loadNews();
    } else if (type === "updates") {
      id ? await updateUpdate(id, payload) : await createUpdate(payload);
      await loadUpdates();
    } else {
      id ? await updateHistory(id, payload) : await createHistory(payload);
      await loadHistory();
    }
    closeCrud();
    showAlert(adminAlert, "Saved successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save.");
    console.error(err);
  }
});

async function confirmDelete(type, id) {
  const labels = { news: "news article", updates: "update", history: "history article" };
  if (!(await confirmAction(`Delete this ${labels[type]}? This cannot be undone.`))) return;
  const item = getItems(type).find(i => i.id === id);
  try {
    if (type === "news")    { await deleteNews(id);    await loadNews(); }
    if (type === "updates") { await deleteUpdate(id);  await loadUpdates(); }
    if (type === "history") { await deleteHistory(id); await loadHistory(); }
    if (item?.imageId) await deleteImage(item.imageId).catch(() => {});
    showAlert(adminAlert, "Deleted successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete.");
    console.error(err);
  }
}

// ══════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════
async function loadCategories() {
  const container = document.getElementById("categories-list");
  categoriesData  = await getCategories();
  document.getElementById("categories-count").textContent = `${categoriesData.length} category(s)`;
  renderCategories();
}

function renderCategories() {
  const container = document.getElementById("categories-list");
  if (!categoriesData.length) {
    container.innerHTML = `<p class="admin-hint">No categories yet. Add one to get started.</p>`;
    return;
  }
  container.innerHTML = categoriesData.map(cat => `
    <div class="category-item" draggable="true" data-cat-id="${cat.id}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="category-item-name">${esc(cat.name)}</span>
      <div class="category-item-actions">
        <button class="btn btn-outline btn-sm" data-action="edit-cat" data-id="${cat.id}">Edit</button>
        <button class="btn btn-danger btn-sm"  data-action="del-cat"  data-id="${cat.id}">Delete</button>
      </div>
    </div>`).join("");

  bindCatDrag(container);
}

document.getElementById("categories-list").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-cat") openCatModal(btn.dataset.id);
  if (btn.dataset.action === "del-cat")  confirmDeleteCat(btn.dataset.id);
});

function bindCatDrag(container) {
  let dragSrc = null;
  container.querySelectorAll(".category-item").forEach(item => {
    item.addEventListener("dragstart", e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = "move";
      item.style.opacity = "0.5";
    });
    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      container.querySelectorAll(".category-item").forEach(i => i.classList.remove("drag-over"));
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      container.querySelectorAll(".category-item").forEach(i => i.classList.remove("drag-over"));
      if (item !== dragSrc) item.classList.add("drag-over");
    });
    item.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      const items   = [...container.querySelectorAll(".category-item")];
      const srcIdx  = items.indexOf(dragSrc);
      const tgtIdx  = items.indexOf(item);
      const reorder = [...categoriesData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      categoriesData = reorder.map((c, i) => ({ ...c, order: i }));
      renderCategories();
      try {
        await saveCategories(categoriesData);
        showAlert(adminAlert, "Category order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save order.");
      }
    });
  });
}

// Category modal
function openCatModal(id = null) {
  const cat = id ? categoriesData.find(c => c.id === id) : null;
  document.getElementById("category-modal-title").textContent = id ? "Edit Category" : "Add Category";
  document.getElementById("category-id").value   = id || "";
  document.getElementById("category-name").value = cat?.name || "";
  catModal.classList.add("open");
}

function closeCatModal() {
  catModal.classList.remove("open");
  catForm.reset();
}

document.getElementById("add-category-btn").addEventListener("click", () => openCatModal());
document.getElementById("category-modal-close").addEventListener("click", closeCatModal);
document.getElementById("category-modal-cancel").addEventListener("click", closeCatModal);

catForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id   = document.getElementById("category-id").value;
  const name = document.getElementById("category-name").value.trim();
  try {
    if (id) await updateCategory(id, { name });
    else    await createCategory({ name, order: categoriesData.length });
    await loadCategories();
    closeCatModal();
    showAlert(adminAlert, "Category saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save category.");
    console.error(err);
  }
});

async function confirmDeleteCat(id) {
  if (leadersData.some(l => l.categoryId === id)) {
    showAlert(adminAlert, "Cannot delete: leaders are still assigned to this category.");
    return;
  }
  if (!(await confirmAction("Delete this category? This cannot be undone."))) return;
  try {
    await deleteCategory(id);
    await loadCategories();
    showAlert(adminAlert, "Category deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete category.");
  }
}

// ══════════════════════════════════════════
// LEADERS
// ══════════════════════════════════════════
async function loadLeaders() {
  const tbody = document.getElementById("leaders-table-body");
  tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading…</td></tr>`;
  leadersData = await getLeaders();
  leadersData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("leaders-count").textContent = `${leadersData.length} leader(s)`;

  if (!leadersData.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No leaders yet.</td></tr>`;
    return;
  }
  const thumbs = await buildThumbMap(leadersData);
  tbody.innerHTML = leadersData.map((item, idx) => `
    <tr draggable="true" data-leader-id="${item.id}">
      <td>
        <span class="drag-handle">⠿</span>
        <span class="reorder-btns">
          <button type="button" class="reorder-btn" data-reorder="leader-up" data-id="${item.id}" ${idx === 0 ? "disabled" : ""} aria-label="Move up">▲</button>
          <button type="button" class="reorder-btn" data-reorder="leader-down" data-id="${item.id}" ${idx === leadersData.length - 1 ? "disabled" : ""} aria-label="Move down">▼</button>
        </span>
      </td>
      <td>${esc(item.name)}</td>
      <td>${esc(item.title)}</td>
      <td>${esc(getCategoryName(item.categoryId))}</td>
      ${thumbCell(item.imageId, thumbs, item.name)}
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-leader" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-leader"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");

  bindLeaderDrag(tbody);
}

document.getElementById("add-leader-btn").addEventListener("click", () => openLeaderModal());

document.getElementById("leaders-table-body").addEventListener("click", async e => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit-leader") openLeaderModal(btn.dataset.id);
    if (btn.dataset.action === "del-leader")  confirmDeleteLeader(btn.dataset.id);
    return;
  }
  const reorderBtn = e.target.closest("[data-reorder]");
  if (!reorderBtn || reorderBtn.disabled) return;
  const id  = reorderBtn.dataset.id;
  const dir = reorderBtn.dataset.reorder === "leader-up" ? -1 : 1;
  const idx = leadersData.findIndex(l => l.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= leadersData.length) return;
  const reorder = [...leadersData];
  [reorder[idx], reorder[swapIdx]] = [reorder[swapIdx], reorder[idx]];
  const reordered = reorder.map((l, i) => ({ ...l, order: i }));
  try {
    await Promise.all(reordered.map(l => updateLeader(l.id, { order: l.order })));
    showAlert(adminAlert, "Leader order saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save leader order.");
  }
  await loadLeaders();
});

function bindLeaderDrag(tbody) {
  let dragSrc = null;
  tbody.querySelectorAll("tr[data-leader-id]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      dragSrc = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      if (row !== dragSrc) row.classList.add("drag-over");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows   = [...tbody.querySelectorAll("tr[data-leader-id]")];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      const reorder = [...leadersData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      const reordered = reorder.map((l, i) => ({ ...l, order: i }));
      try {
        await Promise.all(reordered.map(l => updateLeader(l.id, { order: l.order })));
        showAlert(adminAlert, "Leader order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save leader order.");
      }
      await loadLeaders();
    });
  });
}

function populateCatSelect(selectedId = "") {
  const sel = document.getElementById("leader-category");
  sel.innerHTML = `<option value="">— Select a category —</option>`;
  categoriesData.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openLeaderModal(id = null) {
  const item = id ? leadersData.find(l => l.id === id) : null;
  document.getElementById("leader-modal-title").textContent = id ? "Edit Leader" : "Add Leader";
  document.getElementById("leader-id").value    = id || "";
  document.getElementById("leader-name").value  = item?.name || "";
  document.getElementById("leader-title").value = item?.title || "";
  populateCatSelect(item?.categoryId || "");
  leaderImgUpload?.setImageId(item?.imageId || null);
  leaderModal.classList.add("open");
}

function closeLeaderModal() {
  leaderModal.classList.remove("open");
  leaderForm.reset();
  leaderImgUpload?.setImageId(null);
}

document.getElementById("leader-modal-close").addEventListener("click", closeLeaderModal);
document.getElementById("leader-modal-cancel").addEventListener("click", closeLeaderModal);

leaderForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id         = document.getElementById("leader-id").value;
  const categoryId = document.getElementById("leader-category").value;
  if (!categoryId) { showAlert(adminAlert, "Please select a category."); return; }
  const payload = {
    name:       document.getElementById("leader-name").value.trim(),
    title:      document.getElementById("leader-title").value.trim(),
    categoryId,
    imageId:    leaderImgUpload?.getImageId() || null,
    order:      id ? leadersData.find(l => l.id === id)?.order ?? leadersData.length : leadersData.length,
  };
  try {
    if (id) await updateLeader(id, payload);
    else    await createLeader(payload);
    await loadLeaders();
    closeLeaderModal();
    showAlert(adminAlert, "Leader saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save leader.");
    console.error(err);
  }
});

async function confirmDeleteLeader(id) {
  if (!(await confirmAction("Delete this leader? This cannot be undone."))) return;
  const item = leadersData.find(l => l.id === id);
  try {
    await deleteLeader(id);
    if (item?.imageId) await deleteImage(item.imageId).catch(() => {});
    await loadLeaders();
    showAlert(adminAlert, "Leader deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete leader.");
  }
}

// ══════════════════════════════════════════
// ABOUT FORM
// ══════════════════════════════════════════
async function loadAboutForm() {
  const about = await getAboutContent();
  const set   = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set("about-full-name",        about.fullName);
  set("about-denomination",     about.denomination);
  set("about-registration",     about.registrationNumber);
  set("about-office-hours",     about.officeHours);
  set("about-address",          about.address);
  set("about-service-times",    about.serviceTimes);
  set("about-whatsapp",         about.whatsapp);
  set("about-office-phone",     about.officePhone);
  set("about-office-phone-link",about.officePhoneLink);
  set("about-instagram",        about.instagram);
  set("about-facebook",         about.facebook);
  set("about-email-admin",      about.emailAdmin);
  set("about-email-account",    about.emailAccount);
  set("about-youtube-social",   about.youtubeSocial);
  set("about-founder-name",     about.founderName);
  set("about-founder-bio",      about.founderBio);
  set("about-mission",          about.mission);
  set("about-vision",           about.vision);
  set("about-values",           about.values);
  set("about-contact-note",     about.contactNote);
  aboutUploads.founder?.setImageId(about.founderImageId);
  aboutUploads.mission?.setImageId(about.missionImageId);
  aboutUploads.vision?.setImageId(about.visionImageId);
  aboutUploads.values?.setImageId(about.valuesImageId);
}

document.getElementById("about-form").addEventListener("submit", async e => {
  e.preventDefault();
  const get = id => document.getElementById(id)?.value.trim() || "";
  try {
    await saveAboutContent({
      fullName:         get("about-full-name"),
      denomination:     get("about-denomination"),
      registrationNumber: get("about-registration"),
      officeHours:      get("about-office-hours"),
      address:          get("about-address"),
      serviceTimes:     get("about-service-times"),
      whatsapp:         get("about-whatsapp"),
      officePhone:      get("about-office-phone"),
      officePhoneLink:  get("about-office-phone-link"),
      instagram:        get("about-instagram"),
      facebook:         get("about-facebook"),
      emailAdmin:       get("about-email-admin"),
      emailAccount:     get("about-email-account"),
      youtubeSocial:    get("about-youtube-social"),
      founderName:      get("about-founder-name"),
      founderBio:       get("about-founder-bio"),
      founderImageId:   aboutUploads.founder?.getImageId() || null,
      mission:          get("about-mission"),
      vision:           get("about-vision"),
      values:           get("about-values"),
      contactNote:      get("about-contact-note"),
      missionImageId:   aboutUploads.mission?.getImageId() || null,
      visionImageId:    aboutUploads.vision?.getImageId() || null,
      valuesImageId:    aboutUploads.values?.getImageId() || null,
    });
    showAlert(adminAlert, "About page saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save about page.");
    console.error(err);
  }
});

// ══════════════════════════════════════════
// ORG CHART
// ══════════════════════════════════════════
async function loadOrgForm() {
  const org = await getOrgStructure();
  orgChartUpload?.setImageId(org.chartImageId);
}

document.getElementById("org-chart-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await saveOrgStructure({ chartImageId: orgChartUpload?.getImageId() || null });
    showAlert(adminAlert, "Organisation chart saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save chart.");
    console.error(err);
  }
});

// ══════════════════════════════════════════
// SITE SETTINGS
// ══════════════════════════════════════════
async function loadSettings() {
  const s   = await getSiteSettings();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set("settings-tagline",          s.tagline);
}

document.getElementById("settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const get = id => document.getElementById(id)?.value.trim() || "";
  try {
    await saveSiteSettings({
      tagline:          get("settings-tagline"),
    });
    showAlert(adminAlert, "Settings saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save settings.");
    console.error(err);
  }
});

// ══════════════════════════════════════════
// YOUTUBE SETTINGS
// ══════════════════════════════════════════
async function loadYoutubeSettings() {
  const s   = await getSiteSettings();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set("settings-youtube-live",     s.youtubeLiveUrl);
  set("settings-youtube-channel",  s.youtubeChannelUrl);
  set("settings-youtube-channel-id", s.youtubeChannelId);
}

document.getElementById("youtube-settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const get = id => document.getElementById(id)?.value.trim() || "";
  try {
    await saveSiteSettings({
      youtubeLiveUrl:   get("settings-youtube-live"),
      youtubeChannelUrl:get("settings-youtube-channel"),
      youtubeChannelId: get("settings-youtube-channel-id"),
    });
    showAlert(adminAlert, "YouTube settings saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save YouTube settings.");
    console.error(err);
  }
});
// ══════════════════════════════════════════
// PRIVACY POLICY
// ══════════════════════════════════════════
async function loadPrivacyForm() {
  const textarea = document.getElementById("privacy-content");
  if (!textarea) return;
  const privacy = await getPrivacyContent();
  textarea.value = privacy.content || "";
  const lastUpdatedEl = document.getElementById("privacy-last-updated");
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = privacy.updatedAt
      ? `Last updated: ${formatDate(privacy.updatedAt)}`
      : "";
  }
}

document.getElementById("privacy-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await savePrivacyContent({
      content: document.getElementById("privacy-content").value.trim(),
    });
    showAlert(adminAlert, "Privacy policy saved.", "success");
    await loadPrivacyForm();
  } catch (err) {
    showAlert(adminAlert, "Failed to save privacy policy.");
    console.error(err);
  }
});

// ══════════════════════════════════════════
// COMMUNITY CONTRIBUTIONS — intro text
// ══════════════════════════════════════════
async function loadCommunityContent() {
  const textarea = document.getElementById("community-intro-text");
  if (!textarea) return;
  communityContentData = await getCommunityContent();
  textarea.value = communityContentData.introText || "";
}

const communityIntroForm = document.getElementById("community-intro-form");
communityIntroForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const introText = document.getElementById("community-intro-text").value.trim();
  try {
    await saveCommunityContent({ introText });
    communityContentData.introText = introText;
    showAlert(adminAlert, "Community Contributions text saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save text.");
    console.error(err);
  }
});

// ══════════════════════════════════════════
// COMMUNITY CONTRIBUTIONS — photo collage
// ══════════════════════════════════════════
async function loadCommunityPhotos() {
  const container = document.getElementById("community-photos-list");
  if (!container) return;
  communityPhotosData = await getCommunityPhotos();
  communityPhotosData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("community-photos-count").textContent = `${communityPhotosData.length} photo(s)`;
  renderCommunityPhotos();
}

async function renderCommunityPhotos() {
  const container = document.getElementById("community-photos-list");
  if (!container) return;
  if (!communityPhotosData.length) {
    container.innerHTML = `<p class="admin-hint">No photos yet. Add one to get started.</p>`;
    return;
  }
  const thumbs = await buildThumbMap(communityPhotosData);
  container.innerHTML = communityPhotosData.map(photo => {
    const url = photo.imageId ? thumbs.get(photo.imageId) : null;
    const thumbHtml = url
      ? `<img class="admin-thumb" src="${url}" alt="${esc(photo.title)}" loading="lazy" />`
      : `<span class="admin-thumb-placeholder" title="No image uploaded"><i class="fa-solid fa-image"></i></span>`;
    const sizeLabel = { small: "Small", medium: "Medium", large: "Large" }[photo.size] || "Small";
    const orientationLabel = photo.size === "medium" && photo.orientation === "tall" ? " (Tall)" : photo.size === "medium" ? " (Wide)" : "";
    return `
    <div class="category-item" draggable="true" data-comm-photo-id="${photo.id}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      ${thumbHtml}
      <span class="category-item-name">${esc(photo.title)}</span>
      <span class="badge">${sizeLabel}${orientationLabel}</span>
      <div class="category-item-actions">
        <button class="btn btn-outline btn-sm" data-action="edit-comm-photo" data-id="${photo.id}">Edit</button>
        <button class="btn btn-danger btn-sm"  data-action="del-comm-photo"  data-id="${photo.id}">Delete</button>
      </div>
    </div>`;
  }).join("");

  bindCommunityPhotoDrag(container);
}

document.getElementById("community-photos-list")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-comm-photo") openCommunityPhotoModal(btn.dataset.id);
  if (btn.dataset.action === "del-comm-photo")  confirmDeleteCommunityPhoto(btn.dataset.id);
});

function bindCommunityPhotoDrag(container) {
  let dragSrc = null;
  container.querySelectorAll(".category-item").forEach(item => {
    item.addEventListener("dragstart", e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = "move";
      item.style.opacity = "0.5";
    });
    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      container.querySelectorAll(".category-item").forEach(i => i.classList.remove("drag-over"));
    });
    item.addEventListener("dragover", e => {
      e.preventDefault();
      container.querySelectorAll(".category-item").forEach(i => i.classList.remove("drag-over"));
      if (item !== dragSrc) item.classList.add("drag-over");
    });
    item.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      const items   = [...container.querySelectorAll(".category-item")];
      const srcIdx  = items.indexOf(dragSrc);
      const tgtIdx  = items.indexOf(item);
      const reorder = [...communityPhotosData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      communityPhotosData = reorder.map((p, i) => ({ ...p, order: i }));
      renderCommunityPhotos();
      try {
        await saveCommunityPhotosOrder(communityPhotosData);
        showAlert(adminAlert, "Photo order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save order.");
      }
    });
  });
}

const communityPhotoModal = document.getElementById("community-photo-modal");
const communityPhotoForm  = document.getElementById("community-photo-form");

function openCommunityPhotoModal(id = null) {
  const photo = id ? communityPhotosData.find(p => p.id === id) : null;
  document.getElementById("community-photo-modal-title").textContent = id ? "Edit Photo" : "Add Photo";
  document.getElementById("community-photo-id").value          = id || "";
  document.getElementById("community-photo-title").value       = photo?.title || "";
  document.getElementById("community-photo-date").value        = photo?.date || "";
  document.getElementById("community-photo-size").value         = photo?.size || "small";
  document.getElementById("community-photo-orientation").value  = photo?.orientation || "wide";
  toggleCommunityOrientationField();
  communityPhotoImgUpload?.setImageId(photo?.imageId || null);
  communityPhotoModal.classList.add("open");
}

function closeCommunityPhotoModal() {
  communityPhotoModal.classList.remove("open");
  communityPhotoForm.reset();
  communityPhotoImgUpload?.setImageId(null);
  toggleCommunityOrientationField();
}

function toggleCommunityOrientationField() {
  const size = document.getElementById("community-photo-size").value;
  document.getElementById("community-photo-orientation-group").hidden = size !== "medium";
}
document.getElementById("community-photo-size")?.addEventListener("change", toggleCommunityOrientationField);

document.getElementById("add-community-photo-btn")?.addEventListener("click", () => openCommunityPhotoModal());
document.getElementById("community-photo-modal-close")?.addEventListener("click", closeCommunityPhotoModal);
document.getElementById("community-photo-modal-cancel")?.addEventListener("click", closeCommunityPhotoModal);

communityPhotoForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("community-photo-id").value;
  const payload = {
    title:       document.getElementById("community-photo-title").value.trim(),
    date:        document.getElementById("community-photo-date").value || null,
    size:        document.getElementById("community-photo-size").value || "small",
    orientation: document.getElementById("community-photo-size").value === "medium"
      ? (document.getElementById("community-photo-orientation").value || "wide")
      : null,
    imageId:     communityPhotoImgUpload?.getImageId() || null,
    order:       id ? communityPhotosData.find(p => p.id === id)?.order ?? communityPhotosData.length : communityPhotosData.length,
  };
  try {
    if (id) await updateCommunityPhoto(id, payload);
    else    await createCommunityPhoto(payload);
    await loadCommunityPhotos();
    closeCommunityPhotoModal();
    showAlert(adminAlert, "Photo saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save photo.");
    console.error(err);
  }
});

async function confirmDeleteCommunityPhoto(id) {
  if (!(await confirmAction("Delete this photo? This cannot be undone."))) return;
  const photo = communityPhotosData.find(p => p.id === id);
  try {
    if (photo?.imageId) await deleteImage(photo.imageId);
    await deleteCommunityPhoto(id);
    await loadCommunityPhotos();
    showAlert(adminAlert, "Photo deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete photo.");
  }
}

// ══════════════════════════════════════════
// ACTIVITIES
// ══════════════════════════════════════════
async function loadActivities() {
  const tbody = document.getElementById("activities-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading…</td></tr>`;
  activitiesData = await getActivities();
  activitiesData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("activities-count").textContent = `${activitiesData.length} activity(s)`;

  if (!activitiesData.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No activities yet.</td></tr>`;
    return;
  }

  const thumbs = await buildThumbMap(activitiesData);
  tbody.innerHTML = activitiesData.map((item, idx) => `
    <tr draggable="true" data-activity-id="${item.id}">
      <td>
        <span class="drag-handle">⠿</span>
        <span class="reorder-btns">
          <button type="button" class="reorder-btn" data-reorder="activity-up" data-id="${item.id}" ${idx === 0 ? "disabled" : ""} aria-label="Move up">▲</button>
          <button type="button" class="reorder-btn" data-reorder="activity-down" data-id="${item.id}" ${idx === activitiesData.length - 1 ? "disabled" : ""} aria-label="Move down">▼</button>
        </span>
      </td>
      <td>${esc(item.title)}</td>
      <td>${esc(item.subtitle || "—")}</td>
      <td>${esc(getActSectionLabel(item.section))}</td>
      ${thumbCell(item.imageId, thumbs, item.title)}
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-activity" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-activity"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");

  bindActivityDrag(tbody);
}

const ACT_SECTIONS = { ministries: "Ministries", activities: "Activities" };

function getActSectionLabel(section) {
  return ACT_SECTIONS[section] || "—";
}

document.getElementById("add-activity-btn").addEventListener("click", () => openActivityModal());

document.getElementById("activities-table-body").addEventListener("click", async e => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit-activity") openActivityModal(btn.dataset.id);
    if (btn.dataset.action === "del-activity")  confirmDeleteActivity(btn.dataset.id);
    return;
  }
  const reorderBtn = e.target.closest("[data-reorder]");
  if (!reorderBtn || reorderBtn.disabled) return;
  const id  = reorderBtn.dataset.id;
  const dir = reorderBtn.dataset.reorder === "activity-up" ? -1 : 1;
  const idx = activitiesData.findIndex(a => a.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= activitiesData.length) return;
  const reorder = [...activitiesData];
  [reorder[idx], reorder[swapIdx]] = [reorder[swapIdx], reorder[idx]];
  const reordered = reorder.map((a, i) => ({ ...a, order: i }));
  try {
    await Promise.all(reordered.map(a => updateActivity(a.id, { order: a.order })));
    showAlert(adminAlert, "Activity order saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save activity order.");
  }
  await loadActivities();
});

function bindActivityDrag(tbody) {
  let dragSrc = null;
  tbody.querySelectorAll("tr[data-activity-id]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      dragSrc = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      if (row !== dragSrc) row.classList.add("drag-over");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows   = [...tbody.querySelectorAll("tr[data-activity-id]")];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      const reorder = [...activitiesData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      const reordered = reorder.map((a, i) => ({ ...a, order: i }));
      try {
        await Promise.all(reordered.map(a => updateActivity(a.id, { order: a.order })));
        showAlert(adminAlert, "Activity order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save activity order.");
      }
      await loadActivities();
    });
  });
}

const activityModal = document.getElementById("activity-modal");
const activityForm  = document.getElementById("activity-form");

function openActivityModal(id = null) {
  const item = id ? activitiesData.find(a => a.id === id) : null;
  document.getElementById("activity-modal-title").textContent = id ? "Edit Activity" : "Add Activity";
  document.getElementById("activity-id").value          = id || "";
  document.getElementById("activity-title").value       = item?.title || "";
  document.getElementById("activity-subtitle").value    = item?.subtitle || "";
  document.getElementById("activity-description").value = item?.description || "";
  document.getElementById("activity-section").value     = item?.section || "";
  activityImgUpload?.setImageId(item?.imageId || null);
  activityModal.classList.add("open");
}

function closeActivityModal() {
  activityModal.classList.remove("open");
  activityForm.reset();
  activityImgUpload?.setImageId(null);
}

document.getElementById("activity-modal-close").addEventListener("click", closeActivityModal);
document.getElementById("activity-modal-cancel").addEventListener("click", closeActivityModal);

activityForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id      = document.getElementById("activity-id").value;
  const section = document.getElementById("activity-section").value;
  if (!section) { showAlert(adminAlert, "Please select a section."); return; }
  const payload = {
    title:       document.getElementById("activity-title").value.trim(),
    subtitle:    document.getElementById("activity-subtitle").value.trim(),
    description: document.getElementById("activity-description").value.trim(),
    section,
    imageId:     activityImgUpload?.getImageId() || null,
    order:       id ? activitiesData.find(a => a.id === id)?.order ?? activitiesData.length : activitiesData.length,
  };
  try {
    if (id) await updateActivity(id, payload);
    else    await createActivity(payload);
    await loadActivities();
    closeActivityModal();
    showAlert(adminAlert, "Activity saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save activity.");
    console.error(err);
  }
});

async function confirmDeleteActivity(id) {
  if (!(await confirmAction("Delete this activity? This cannot be undone."))) return;
  const item = activitiesData.find(a => a.id === id);
  try {
    await deleteActivity(id);
    if (item?.imageId) await deleteImage(item.imageId).catch(() => {});
    await loadActivities();
    showAlert(adminAlert, "Activity deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete activity.");
  }
}

// ══════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════
async function loadServices() {
  const tbody = document.getElementById("services-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading…</td></tr>`;
  servicesData = await getServices();
  servicesData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("services-count").textContent = `${servicesData.length} service(s)`;

  if (!servicesData.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No services yet.</td></tr>`;
    return;
  }

  const thumbs = await buildThumbMap(servicesData);
  tbody.innerHTML = servicesData.map((item, idx) => `
    <tr draggable="true" data-service-id="${item.id}">
      <td>
        <span class="drag-handle">⠿</span>
        <span class="reorder-btns">
          <button type="button" class="reorder-btn" data-reorder="service-up" data-id="${item.id}" ${idx === 0 ? "disabled" : ""} aria-label="Move up">▲</button>
          <button type="button" class="reorder-btn" data-reorder="service-down" data-id="${item.id}" ${idx === servicesData.length - 1 ? "disabled" : ""} aria-label="Move down">▼</button>
        </span>
      </td>
      <td>${esc(item.title)}</td>
      <td>${esc((item.description || "—").slice(0, 60))}</td>
      <td><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc((item.link || "").slice(0, 40))}</a></td>
      ${thumbCell(item.imageId, thumbs, item.title)}
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-service" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-service"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");

  bindServiceDrag(tbody);
}

document.getElementById("add-service-btn").addEventListener("click", () => openServiceModal());

document.getElementById("services-table-body").addEventListener("click", async e => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    if (btn.dataset.action === "edit-service") openServiceModal(btn.dataset.id);
    if (btn.dataset.action === "del-service")  confirmDeleteService(btn.dataset.id);
    return;
  }
  const reorderBtn = e.target.closest("[data-reorder]");
  if (!reorderBtn || reorderBtn.disabled) return;
  const id  = reorderBtn.dataset.id;
  const dir = reorderBtn.dataset.reorder === "service-up" ? -1 : 1;
  const idx = servicesData.findIndex(s => s.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= servicesData.length) return;
  const reorder = [...servicesData];
  [reorder[idx], reorder[swapIdx]] = [reorder[swapIdx], reorder[idx]];
  const reordered = reorder.map((s, i) => ({ ...s, order: i }));
  try {
    await Promise.all(reordered.map(s => updateService(s.id, { order: s.order })));
    showAlert(adminAlert, "Service order saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save service order.");
  }
  await loadServices();
});

function bindServiceDrag(tbody) {
  let dragSrc = null;
  tbody.querySelectorAll("tr[data-service-id]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      dragSrc = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      if (row !== dragSrc) row.classList.add("drag-over");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows   = [...tbody.querySelectorAll("tr[data-service-id]")];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      const reorder = [...servicesData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      const reordered = reorder.map((s, i) => ({ ...s, order: i }));
      try {
        await Promise.all(reordered.map(s => updateService(s.id, { order: s.order })));
        showAlert(adminAlert, "Service order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save service order.");
      }
      await loadServices();
    });
  });
}

const serviceModal = document.getElementById("service-modal");
const serviceForm  = document.getElementById("service-form");

function openServiceModal(id = null) {
  const item = id ? servicesData.find(s => s.id === id) : null;
  document.getElementById("service-modal-title").textContent = id ? "Edit Service" : "Add Service";
  document.getElementById("service-id").value          = id || "";
  document.getElementById("service-title").value       = item?.title || "";
  document.getElementById("service-description").value = item?.description || "";
  document.getElementById("service-link").value         = item?.link || "";
  serviceImgUpload?.setImageId(item?.imageId || null);
  serviceModal.classList.add("open");
}

function closeServiceModal() {
  serviceModal.classList.remove("open");
  serviceForm.reset();
  serviceImgUpload?.setImageId(null);
}

document.getElementById("service-modal-close").addEventListener("click", closeServiceModal);
document.getElementById("service-modal-cancel").addEventListener("click", closeServiceModal);

serviceForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id   = document.getElementById("service-id").value;
  const link = document.getElementById("service-link").value.trim();
  const payload = {
    title:       document.getElementById("service-title").value.trim(),
    description: document.getElementById("service-description").value.trim(),
    link,
    imageId:     serviceImgUpload?.getImageId() || null,
    order:       id ? servicesData.find(s => s.id === id)?.order ?? servicesData.length : servicesData.length,
  };
  try {
    if (id) await updateService(id, payload);
    else    await createService(payload);
    await loadServices();
    closeServiceModal();
    showAlert(adminAlert, "Service saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save service.");
    console.error(err);
  }
});

async function confirmDeleteService(id) {
  if (!(await confirmAction("Delete this service? This cannot be undone."))) return;
  const item = servicesData.find(s => s.id === id);
  try {
    await deleteService(id);
    if (item?.imageId) await deleteImage(item.imageId).catch(() => {});
    await loadServices();
    showAlert(adminAlert, "Service deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete service.");
  }
}

// ══════════════════════════════════════════
// CAROUSEL VIDEOS
// ══════════════════════════════════════════
async function loadCarouselVideos() {
  const tbody = document.getElementById("carousel-videos-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="loading">Loading…</td></tr>`;
  carouselVideosData = await getCarouselVideos();
  carouselVideosData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("carousel-videos-count").textContent = `${carouselVideosData.length} video(s)`;

  if (!carouselVideosData.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No videos added yet.</td></tr>`;
    return;
  }

  // Videos have no uploaded imageId — use YouTube's own thumbnail so staff
  // can recognize the clip at a glance, same as other panels.
  tbody.innerHTML = carouselVideosData.map(item => {
    const ytThumb = item.videoId
      ? `<img class="admin-thumb" src="https://img.youtube.com/vi/${esc(item.videoId)}/default.jpg" alt="${esc(item.title)}" loading="lazy" />`
      : `<span class="admin-thumb-placeholder" title="No video ID"><i class="fa-solid fa-image"></i></span>`;
    return `
    <tr draggable="true" data-cvid="${item.id}">
      <td><span class="drag-handle">⠿</span></td>
      <td class="admin-thumb-cell">${ytThumb}</td>
      <td>${esc(item.title)}</td>
      <td>${item.date ? esc(formatDate(item.date)) : "—"}</td>
      <td>${esc(item.videoId)}</td>
      <td>${formatUpdatedAt(item)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-cv" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-cv"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  bindCarouselVideoDrag(tbody);
}

document.getElementById("add-carousel-video-btn").addEventListener("click", () => openCarouselVideoModal());

document.getElementById("carousel-videos-table-body").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-cv") openCarouselVideoModal(btn.dataset.id);
  if (btn.dataset.action === "del-cv")  confirmDeleteCarouselVideo(btn.dataset.id);
});

function bindCarouselVideoDrag(tbody) {
  let dragSrc = null;
  tbody.querySelectorAll("tr[data-cvid]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      dragSrc = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("drag-over"));
      if (row !== dragSrc) row.classList.add("drag-over");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows   = [...tbody.querySelectorAll("tr[data-cvid]")];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      const reorder = [...carouselVideosData];
      const [moved] = reorder.splice(srcIdx, 1);
      reorder.splice(tgtIdx, 0, moved);
      carouselVideosData = reorder.map((v, i) => ({ ...v, order: i }));
      await loadCarouselVideos();
      try {
        await saveCarouselVideosOrder(carouselVideosData);
        showAlert(adminAlert, "Video order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save video order.");
      }
    });
  });
}

const carouselVideoModal = document.getElementById("carousel-video-modal");
const carouselVideoForm  = document.getElementById("carousel-video-form");

function openCarouselVideoModal(id = null) {
  const item = id ? carouselVideosData.find(v => v.id === id) : null;
  document.getElementById("carousel-video-modal-title").textContent = id ? "Edit Video" : "Add Video";
  document.getElementById("carousel-video-id").value    = id || "";
  document.getElementById("carousel-video-title").value = item?.title || "";
  document.getElementById("carousel-video-date").value  = item?.date ? toInputDate(item.date) : "";
  document.getElementById("carousel-video-yt-id").value = item?.videoId || "";
  carouselVideoModal.classList.add("open");
}

function closeCarouselVideoModal() {
  carouselVideoModal.classList.remove("open");
  carouselVideoForm.reset();
}

document.getElementById("carousel-video-modal-close").addEventListener("click", closeCarouselVideoModal);
document.getElementById("carousel-video-modal-cancel").addEventListener("click", closeCarouselVideoModal);

carouselVideoForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("carousel-video-id").value;
  const payload = {
    title:   document.getElementById("carousel-video-title").value.trim(),
    date:    document.getElementById("carousel-video-date").value,
    videoId: document.getElementById("carousel-video-yt-id").value.trim(),
    order:   id ? carouselVideosData.find(v => v.id === id)?.order ?? carouselVideosData.length : carouselVideosData.length,
  };
  try {
    if (id) await updateCarouselVideo(id, payload);
    else    await createCarouselVideo(payload);
    await loadCarouselVideos();
    closeCarouselVideoModal();
    showAlert(adminAlert, "Video saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save video.");
    console.error(err);
  }
});

async function confirmDeleteCarouselVideo(id) {
  if (!(await confirmAction("Delete this video? This cannot be undone."))) return;
  try {
    await deleteCarouselVideo(id);
    await loadCarouselVideos();
    showAlert(adminAlert, "Video deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete video.");
  }
}
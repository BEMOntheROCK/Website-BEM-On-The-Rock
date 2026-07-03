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
  getNews, createNews, updateNews, deleteNews,
  getUpdates, createUpdate, updateUpdate, deleteUpdate,
  getHistory, createHistory, updateHistory, deleteHistory,
  formatDate, displayHistoryDate,
} from "./firebase-service.js";
import { bindImageUpload, deleteImage } from "./image-service.js";

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

// ── State ──
let newsData       = [];
let updatesData    = [];
let historyData    = [];
let leadersData    = [];
let categoriesData = [];
let dataLoaded     = false;

let crudImgUpload    = null;
let leaderImgUpload  = null;
let orgChartUpload   = null;
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

// ── Auth ──
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
  crudImgUpload   = safeBind("crud-image-upload",      { inputId: "crud-img-in",    label: "Article Image" });
  leaderImgUpload = safeBind("leader-image-upload",    { inputId: "leader-img-in",  label: "Leader Photo" });
  orgChartUpload  = safeBind("org-chart-image-upload", { inputId: "org-img-in",     label: "Organisation Chart Image" });
  aboutUploads = {
    hero:    safeBind("about-hero-image-upload",    { inputId: "ab-hero-in",    label: "Hero Background" }),
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
  ]);
  // Leaders depend on categories being loaded first
  await loadLeaders();
}

// ══════════════════════════════════════════
// NEWS
// ══════════════════════════════════════════
async function loadNews() {
  const tbody = document.getElementById("news-table-body");
  tbody.innerHTML = `<tr><td colspan="3" class="loading">Loading…</td></tr>`;
  newsData = await getNews();
  document.getElementById("news-count").textContent = `${newsData.length} article(s)`;

  if (!newsData.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No news yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = newsData.map(item => `
    <tr>
      <td>${esc(item.title)}${item.imageId ? " 🖼" : ""}</td>
      <td>${esc(formatDate(item.date))}</td>
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
  tbody.innerHTML = `<tr><td colspan="4" class="loading">Loading…</td></tr>`;
  updatesData = await getUpdates();
  document.getElementById("updates-count").textContent = `${updatesData.length} update(s)`;

  if (!updatesData.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No updates yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = updatesData.map(item => `
    <tr>
      <td>${esc(item.title)}${item.imageId ? " 🖼" : ""}</td>
      <td>${esc(formatDate(item.date))}</td>
      <td>${esc(item.priority || "normal")}</td>
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
  tbody.innerHTML = `<tr><td colspan="4" class="loading">Loading…</td></tr>`;
  historyData = await getHistory("desc");
  document.getElementById("history-count").textContent = `${historyData.length} article(s)`;

  if (!historyData.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No history articles yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = historyData.map(item => `
    <tr>
      <td>${esc(item.title)}</td>
      <td>${esc(displayHistoryDate(item.date))}</td>
      <td>${item.imageId ? "Yes" : "—"}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-outline btn-sm" data-action="edit-history" data-id="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm"  data-action="del-history"  data-id="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");
}

document.getElementById("add-history-btn").addEventListener("click", () => openCrud("history"));

document.getElementById("history-table-body").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-history") openCrud("history", btn.dataset.id);
  if (btn.dataset.action === "del-history")  confirmDelete("history", btn.dataset.id);
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
  crudModal.classList.add("open");
}

function closeCrud() {
  crudModal.classList.remove("open");
  crudForm.reset();
  crudImgUpload?.setImageId(null);
}

document.getElementById("modal-close").addEventListener("click", closeCrud);
document.getElementById("modal-cancel").addEventListener("click", closeCrud);
crudModal.addEventListener("click", e => { if (e.target === crudModal) closeCrud(); });

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
  if (!confirm(`Delete this ${labels[type]}? This cannot be undone.`)) return;
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
catModal.addEventListener("click", e => { if (e.target === catModal) closeCatModal(); });

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
  if (!confirm("Delete this category? This cannot be undone.")) return;
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
  tbody.innerHTML = `<tr><td colspan="6" class="loading">Loading…</td></tr>`;
  leadersData = await getLeaders();
  leadersData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  document.getElementById("leaders-count").textContent = `${leadersData.length} leader(s)`;

  if (!leadersData.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No leaders yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = leadersData.map(item => `
    <tr draggable="true" data-leader-id="${item.id}">
      <td><span class="drag-handle">⠿</span></td>
      <td>${esc(item.name)}</td>
      <td>${esc(item.title)}</td>
      <td>${esc(getCategoryName(item.categoryId))}</td>
      <td>${item.imageId ? "Yes" : "—"}</td>
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

document.getElementById("leaders-table-body").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-leader") openLeaderModal(btn.dataset.id);
  if (btn.dataset.action === "del-leader")  confirmDeleteLeader(btn.dataset.id);
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
      leadersData = reorder.map((l, i) => ({ ...l, order: i }));
      await loadLeaders();
      try {
        await Promise.all(leadersData.map(l => updateLeader(l.id, { order: l.order })));
        showAlert(adminAlert, "Leader order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save leader order.");
      }
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
leaderModal.addEventListener("click", e => { if (e.target === leaderModal) closeLeaderModal(); });

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
  if (!confirm("Delete this leader? This cannot be undone.")) return;
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
  aboutUploads.hero?.setImageId(about.heroImageId);
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
      heroImageId:      aboutUploads.hero?.getImageId() || null,
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
  set("settings-church-name",      s.churchName);
  set("settings-tagline",          s.tagline);
  set("settings-youtube-live",     s.youtubeLiveUrl);
  set("settings-youtube-channel",  s.youtubeChannelUrl);
  set("settings-youtube-video-id", s.youtubeVideoId);
  set("settings-service-times",    s.serviceTimes);
  set("settings-address",          s.address);
  set("settings-phone",            s.phone);
  set("settings-email",            s.email);
}

document.getElementById("settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const get = id => document.getElementById(id)?.value.trim() || "";
  try {
    await saveSiteSettings({
      churchName:       get("settings-church-name"),
      tagline:          get("settings-tagline"),
      youtubeLiveUrl:   get("settings-youtube-live"),
      youtubeChannelUrl:get("settings-youtube-channel"),
      youtubeVideoId:   get("settings-youtube-video-id"),
      serviceTimes:     get("settings-service-times"),
      address:          get("settings-address"),
      phone:            get("settings-phone"),
      email:            get("settings-email"),
    });
    showAlert(adminAlert, "Settings saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save settings.");
    console.error(err);
  }
});
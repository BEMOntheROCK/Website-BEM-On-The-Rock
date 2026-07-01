import "./common.js";
import { showAlert } from "./common.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { auth } from "./firebase-init.js";
import {
  getSiteSettings,
  saveSiteSettings,
  getAboutContent,
  saveAboutContent,
  getOrgStructure,
  saveOrgStructure,
  getLeaders,
  createLeader,
  updateLeader,
  deleteLeader,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  saveCategories,
  getNews,
  createNews,
  updateNews,
  deleteNews,
  getUpdates,
  createUpdate,
  updateUpdate,
  deleteUpdate,
  getHistory,
  createHistory,
  updateHistory,
  deleteHistory,
  formatDate,
  displayHistoryDate,
} from "./firebase-service.js";
import { bindImageUpload, deleteImage } from "./image-service.js";

const authScreen = document.getElementById("auth-screen");
const dashboard = document.getElementById("admin-dashboard");
const logoutBtn = document.getElementById("logout-btn");
const authAlert = document.getElementById("auth-alert");
const adminAlert = document.getElementById("admin-alert");

const modal = document.getElementById("crud-modal");
const crudForm = document.getElementById("crud-form");
const leaderModal = document.getElementById("leader-modal");
const leaderForm = document.getElementById("leader-form");
const categoryModal = document.getElementById("category-modal");
const categoryForm = document.getElementById("category-form");

let newsData = [];
let updatesData = [];
let historyData = [];
let leadersData = [];
let categoriesData = [];

let crudImageUpload = null;
let leaderImageUpload = null;
let orgChartUpload = null;
let aboutUploads = {};

// ── Drag state ──
let dragSrcRow = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function toInputDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function toHistoryDateText(value) {
  if (!value) return "";
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) return value;
  return displayHistoryDate(value);
}

function initImageUploads() {
  crudImageUpload = bindImageUpload(document.getElementById("crud-image-upload"), {
    inputId: "crud-image-input",
    label: "Article Image",
  });

  leaderImageUpload = bindImageUpload(document.getElementById("leader-image-upload"), {
    inputId: "leader-image-input",
    label: "Leader Photo",
  });

  orgChartUpload = bindImageUpload(document.getElementById("org-chart-image-upload"), {
    inputId: "org-chart-image-input",
    label: "Organisation Chart Image",
  });

  aboutUploads = {
    hero: bindImageUpload(document.getElementById("about-hero-image-upload"), {
      inputId: "about-hero-image-input",
      label: "About Page Hero Background",
    }),
    founder: bindImageUpload(document.getElementById("about-founder-image-upload"), {
      inputId: "about-founder-image-input",
      label: "Founder Photo",
    }),
    mission: bindImageUpload(document.getElementById("about-mission-image-upload"), {
      inputId: "about-mission-image-input",
      label: "Mission Section Image",
    }),
    vision: bindImageUpload(document.getElementById("about-vision-image-upload"), {
      inputId: "about-vision-image-input",
      label: "Vision Section Image",
    }),
    values: bindImageUpload(document.getElementById("about-values-image-upload"), {
      inputId: "about-values-image-input",
      label: "Values Section Image",
    }),
  };
}

let dataLoaded = false;

function showDashboard(user) {
  authScreen.style.display = "none";
  dashboard.style.display = user ? "grid" : "none";
  logoutBtn.style.display = user ? "inline-flex" : "none";
  if (user && !dataLoaded) {
    dataLoaded = true;
    loadAllData();
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showDashboard(user);
  } else {
    dataLoaded = false;
    authScreen.style.display = "flex";
    dashboard.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAlert(authAlert, getAuthErrorMessage(err.code));
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

function getAuthErrorMessage(code) {
  const messages = {
    "auth/invalid-email": "Invalid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
  };
  return messages[code] || "Sign in failed. Please try again.";
}

document.querySelectorAll("[data-panel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.dataset.panel;
    document.querySelectorAll("[data-panel]").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${panel}`).classList.add("active");
  });
});

async function loadAllData() {
  if (!crudImageUpload) initImageUploads();
  await Promise.all([
    loadNewsTable(),
    loadUpdatesTable(),
    loadHistoryTable(),
    loadAboutForm(),
    loadOrgForm(),
    loadCategoriesList(),
    loadLeadersTable(),
    loadSettingsForm(),
  ]);
}

// ── News ──
async function loadNewsTable() {
  const tbody = document.getElementById("news-table-body");
  try {
    newsData = await getNews();
    document.getElementById("news-count").textContent = `${newsData.length} article(s)`;

    if (!newsData.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No news yet. Add your first article.</td></tr>`;
      return;
    }

    tbody.innerHTML = newsData
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.title)}${item.imageId ? " 🖼" : ""}</td>
        <td>${escapeHtml(formatDate(item.date))}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-news="${item.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-news="${item.id}">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    bindTableActions(tbody, "news");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3">Failed to load news.</td></tr>`;
    console.error(err);
  }
}

// ── Updates ──
async function loadUpdatesTable() {
  const tbody = document.getElementById("updates-table-body");
  try {
    updatesData = await getUpdates();
    document.getElementById("updates-count").textContent = `${updatesData.length} update(s)`;

    if (!updatesData.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No updates yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = updatesData
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.title)}${item.imageId ? " 🖼" : ""}</td>
        <td>${escapeHtml(formatDate(item.date))}</td>
        <td>${escapeHtml(item.priority || "normal")}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-update="${item.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-update="${item.id}">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    bindTableActions(tbody, "updates");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Failed to load updates.</td></tr>`;
    console.error(err);
  }
}

// ── History ──
async function loadHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  try {
    historyData = await getHistory("desc");
    document.getElementById("history-count").textContent = `${historyData.length} article(s)`;

    if (!historyData.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No history articles yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = historyData
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(displayHistoryDate(item.date))}</td>
        <td>${item.imageId ? "Yes" : "—"}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-history="${item.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-history="${item.id}">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    bindTableActions(tbody, "history");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Failed to load history.</td></tr>`;
    console.error(err);
  }
}

// ── Categories ──
async function loadCategoriesList() {
  const container = document.getElementById("categories-list");
  try {
    categoriesData = await getCategories();
    document.getElementById("categories-count").textContent = `${categoriesData.length} category(s)`;
    renderCategoriesList();
  } catch (err) {
    container.innerHTML = `<p style="color: var(--text-muted);">Failed to load categories.</p>`;
    console.error(err);
  }
}

function renderCategoriesList() {
  const container = document.getElementById("categories-list");

  if (!categoriesData.length) {
    container.innerHTML = `<p class="admin-hint">No categories yet. Add one to get started.</p>`;
    return;
  }

  container.innerHTML = categoriesData
    .map(
      (cat) => `
    <div class="category-item" draggable="true" data-category-id="${cat.id}">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="category-item-name">${escapeHtml(cat.name)}</span>
      <div class="category-item-actions">
        <button class="btn btn-outline btn-sm" data-edit-category="${cat.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-delete-category="${cat.id}">Delete</button>
      </div>
    </div>`
    )
    .join("");

  // Bind edit/delete
  container.querySelectorAll("[data-edit-category]").forEach((btn) => {
    btn.addEventListener("click", () => openCategoryModal(btn.getAttribute("data-edit-category")));
  });
  container.querySelectorAll("[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteCategory(btn.getAttribute("data-delete-category")));
  });

  // Drag-and-drop for categories
  bindCategoryDrag(container);
}

function bindCategoryDrag(container) {
  let dragSrc = null;

  container.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = "move";
      item.style.opacity = "0.5";
    });

    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      container.querySelectorAll(".category-item").forEach((i) => i.classList.remove("drag-over"));
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      container.querySelectorAll(".category-item").forEach((i) => i.classList.remove("drag-over"));
      if (item !== dragSrc) item.classList.add("drag-over");
    });

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;

      // Reorder in DOM and data array
      const items = [...container.querySelectorAll(".category-item")];
      const srcIdx = items.indexOf(dragSrc);
      const tgtIdx = items.indexOf(item);

      const reordered = [...categoriesData];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx, 0, moved);

      // Assign new order values
      categoriesData = reordered.map((cat, i) => ({ ...cat, order: i }));

      renderCategoriesList();

      try {
        await saveCategories(categoriesData);
        showAlert(adminAlert, "Category order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save category order.");
        console.error(err);
      }
    });
  });
}

// ── Leaders ──
async function loadLeadersTable() {
  const tbody = document.getElementById("leaders-table-body");
  try {
    leadersData = await getLeaders();
    document.getElementById("leaders-count").textContent = `${leadersData.length} leader(s)`;

    if (!leadersData.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No leaders yet.</td></tr>`;
      return;
    }

    // Sort by order field
    leadersData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    tbody.innerHTML = leadersData
      .map(
        (item) => `
      <tr draggable="true" data-leader-id="${item.id}">
        <td><span class="drag-handle" title="Drag to reorder">⠿</span></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(getCategoryName(item.categoryId))}</td>
        <td>${item.imageId ? "Yes" : "—"}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-leader="${item.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-leader="${item.id}">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-edit-leader]").forEach((btn) => {
      btn.addEventListener("click", () => openLeaderModal(btn.getAttribute("data-edit-leader")));
    });
    tbody.querySelectorAll("[data-delete-leader]").forEach((btn) => {
      btn.addEventListener("click", () => handleDeleteLeader(btn.getAttribute("data-delete-leader")));
    });

    bindLeaderDrag(tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Failed to load leaders.</td></tr>`;
    console.error(err);
  }
}

function getCategoryName(categoryId) {
  if (!categoryId) return "—";
  const cat = categoriesData.find((c) => c.id === categoryId);
  return cat ? cat.name : "—";
}

function bindLeaderDrag(tbody) {
  tbody.querySelectorAll("tr[data-leader-id]").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      dragSrcRow = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("drag-over"));
      dragSrcRow = null;
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tbody.querySelectorAll("tr").forEach((r) => r.classList.remove("drag-over"));
      if (row !== dragSrcRow) row.classList.add("drag-over");
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (!dragSrcRow || dragSrcRow === row) return;

      const rows = [...tbody.querySelectorAll("tr[data-leader-id]")];
      const srcIdx = rows.indexOf(dragSrcRow);
      const tgtIdx = rows.indexOf(row);

      const reordered = [...leadersData];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx, 0, moved);

      // Assign new order values and persist each
      leadersData = reordered.map((l, i) => ({ ...l, order: i }));

      // Re-render table immediately for responsiveness
      await loadLeadersTable();

      try {
        await Promise.all(
          leadersData.map((l) => updateLeader(l.id, { order: l.order }))
        );
        showAlert(adminAlert, "Leader order saved.", "success");
      } catch (err) {
        showAlert(adminAlert, "Failed to save leader order.");
        console.error(err);
      }
    });
  });
}

function bindTableActions(tbody, type) {
  tbody.querySelectorAll(`[data-edit-${type}]`).forEach((btn) => {
    btn.addEventListener("click", () =>
      openModal(type, btn.getAttribute(`data-edit-${type}`))
    );
  });
  tbody.querySelectorAll(`[data-delete-${type}]`).forEach((btn) => {
    btn.addEventListener("click", () =>
      handleDelete(type, btn.getAttribute(`data-delete-${type}`))
    );
  });
}

// ── About form ──
async function loadAboutForm() {
  const about = await getAboutContent();
  document.getElementById("about-full-name").value = about.fullName || "";
  document.getElementById("about-denomination").value = about.denomination || "";
  document.getElementById("about-registration").value = about.registrationNumber || "";
  document.getElementById("about-office-hours").value = about.officeHours || "";
  document.getElementById("about-whatsapp").value = about.whatsapp || "";
  document.getElementById("about-office-phone").value = about.officePhone || "";
  document.getElementById("about-office-phone-link").value = about.officePhoneLink || "";
  document.getElementById("about-instagram").value = about.instagram || "";
  document.getElementById("about-facebook").value = about.facebook || "";
  document.getElementById("about-email-admin").value = about.emailAdmin || "";
  document.getElementById("about-email-account").value = about.emailAccount || "";
  document.getElementById("about-youtube-social").value = about.youtubeSocial || "";
  document.getElementById("about-founder-name").value = about.founderName || "";
  document.getElementById("about-founder-bio").value = about.founderBio || "";
  document.getElementById("about-mission").value = about.mission || "";
  document.getElementById("about-vision").value = about.vision || "";
  document.getElementById("about-values").value = about.values || "";
  document.getElementById("about-contact-note").value = about.contactNote || "";

  aboutUploads.hero?.setImageId(about.heroImageId);
  aboutUploads.founder?.setImageId(about.founderImageId);
  aboutUploads.mission?.setImageId(about.missionImageId);
  aboutUploads.vision?.setImageId(about.visionImageId);
  aboutUploads.values?.setImageId(about.valuesImageId);
}

async function loadOrgForm() {
  const org = await getOrgStructure();
  orgChartUpload?.setImageId(org.chartImageId);
}

async function loadSettingsForm() {
  const settings = await getSiteSettings();
  document.getElementById("settings-church-name").value = settings.churchName || "";
  document.getElementById("settings-tagline").value = settings.tagline || "";
  document.getElementById("settings-youtube-live").value = settings.youtubeLiveUrl || "";
  document.getElementById("settings-youtube-channel").value = settings.youtubeChannelUrl || "";
  document.getElementById("settings-youtube-video-id").value = settings.youtubeVideoId || "";
  document.getElementById("settings-service-times").value = settings.serviceTimes || "";
  document.getElementById("settings-address").value = settings.address || "";
  document.getElementById("settings-phone").value = settings.phone || "";
  document.getElementById("settings-email").value = settings.email || "";
}

// ── CRUD modal (News / Updates / History) ──
document.getElementById("add-news-btn").addEventListener("click", () => openModal("news"));
document.getElementById("add-update-btn").addEventListener("click", () => openModal("updates"));
document.getElementById("add-history-btn").addEventListener("click", () => openModal("history"));
document.getElementById("add-leader-btn").addEventListener("click", () => openLeaderModal());
document.getElementById("add-category-btn").addEventListener("click", () => openCategoryModal());

const MODAL_LABELS = { news: "News", updates: "Update", history: "History Article" };

function getDataForType(type) {
  if (type === "news") return newsData;
  if (type === "updates") return updatesData;
  return historyData;
}

function configureDateField(type, data) {
  const dateInput = document.getElementById("crud-date");
  const dateLabel = document.getElementById("crud-date-label");

  if (type === "history") {
    dateInput.type = "text";
    dateInput.placeholder = "e.g. 1998 or March 2005";
    dateLabel.textContent = "Date / Period";
    dateInput.value = toHistoryDateText(data?.date);
  } else {
    dateInput.type = "date";
    dateInput.placeholder = "";
    dateLabel.textContent = "Date";
    dateInput.value = toInputDate(data?.date);
  }
}

function openModal(type, id = null) {
  const data = id ? getDataForType(type).find((item) => item.id === id) : null;
  const label = MODAL_LABELS[type] || "Item";

  document.getElementById("modal-title").textContent = id ? `Edit ${label}` : `Add ${label}`;
  document.getElementById("crud-id").value = id || "";
  document.getElementById("crud-type").value = type;
  document.getElementById("crud-title").value = data?.title || "";
  document.getElementById("crud-content").value = data?.content || "";
  configureDateField(type, data);
  document.getElementById("crud-priority-group").style.display = type === "updates" ? "block" : "none";

  if (type === "updates") {
    document.getElementById("crud-priority").value = data?.priority || "normal";
  }

  crudImageUpload?.setImageId(data?.imageId || null);
  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
  crudForm.reset();
  crudImageUpload?.setImageId(null);
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

crudForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("crud-id").value;
  const type = document.getElementById("crud-type").value;
  const imageId = crudImageUpload?.getImageId() || null;

  const payload = {
    title: document.getElementById("crud-title").value.trim(),
    content: document.getElementById("crud-content").value.trim(),
    date: document.getElementById("crud-date").value.trim(),
    imageId,
  };

  if (type === "updates") {
    payload.priority = document.getElementById("crud-priority").value;
  }

  try {
    if (type === "news") {
      if (id) await updateNews(id, payload);
      else await createNews(payload);
      await loadNewsTable();
    } else if (type === "updates") {
      if (id) await updateUpdate(id, payload);
      else await createUpdate(payload);
      await loadUpdatesTable();
    } else if (type === "history") {
      if (id) await updateHistory(id, payload);
      else await createHistory(payload);
      await loadHistoryTable();
    }
    closeModal();
    showAlert(adminAlert, "Saved successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save. Check your permissions.");
    console.error(err);
  }
});

// ── Category modal ──
function openCategoryModal(id = null) {
  const data = id ? categoriesData.find((c) => c.id === id) : null;
  document.getElementById("category-modal-title").textContent = id ? "Edit Category" : "Add Category";
  document.getElementById("category-id").value = id || "";
  document.getElementById("category-name").value = data?.name || "";
  categoryModal.classList.add("open");
}

function closeCategoryModal() {
  categoryModal.classList.remove("open");
  categoryForm.reset();
}

document.getElementById("category-modal-close").addEventListener("click", closeCategoryModal);
document.getElementById("category-modal-cancel").addEventListener("click", closeCategoryModal);
categoryModal.addEventListener("click", (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("category-id").value;
  const name = document.getElementById("category-name").value.trim();

  try {
    if (id) {
      await updateCategory(id, { name });
    } else {
      await createCategory({ name, order: categoriesData.length });
    }
    await loadCategoriesList();
    closeCategoryModal();
    showAlert(adminAlert, "Category saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save category.");
    console.error(err);
  }
});

async function handleDeleteCategory(id) {
  // Check if any leader uses this category
  const inUse = leadersData.some((l) => l.categoryId === id);
  if (inUse) {
    showAlert(adminAlert, "Cannot delete: some leaders are assigned to this category. Reassign them first.");
    return;
  }
  if (!confirm("Delete this category? This cannot be undone.")) return;

  try {
    await deleteCategory(id);
    await loadCategoriesList();
    showAlert(adminAlert, "Category deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete category.");
    console.error(err);
  }
}

// ── Leader modal ──
function populateCategorySelect(selectedId = "") {
  const select = document.getElementById("leader-category");
  select.innerHTML = `<option value="">— Select a category —</option>`;
  categoriesData.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    if (cat.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

function openLeaderModal(id = null) {
  const data = id ? leadersData.find((item) => item.id === id) : null;
  document.getElementById("leader-modal-title").textContent = id ? "Edit Leader" : "Add Leader";
  document.getElementById("leader-id").value = id || "";
  document.getElementById("leader-name").value = data?.name || "";
  document.getElementById("leader-title").value = data?.title || "";
  populateCategorySelect(data?.categoryId || "");
  leaderImageUpload?.setImageId(data?.imageId || null);
  leaderModal.classList.add("open");
}

function closeLeaderModal() {
  leaderModal.classList.remove("open");
  leaderForm.reset();
  leaderImageUpload?.setImageId(null);
}

document.getElementById("leader-modal-close").addEventListener("click", closeLeaderModal);
document.getElementById("leader-modal-cancel").addEventListener("click", closeLeaderModal);
leaderModal.addEventListener("click", (e) => {
  if (e.target === leaderModal) closeLeaderModal();
});

leaderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("leader-id").value;
  const categoryId = document.getElementById("leader-category").value;

  if (!categoryId) {
    showAlert(adminAlert, "Please select a category for this leader.");
    return;
  }

  const payload = {
    name: document.getElementById("leader-name").value.trim(),
    title: document.getElementById("leader-title").value.trim(),
    categoryId,
    imageId: leaderImageUpload?.getImageId() || null,
    order: id
      ? leadersData.find((l) => l.id === id)?.order ?? leadersData.length
      : leadersData.length,
  };

  try {
    if (id) await updateLeader(id, payload);
    else await createLeader(payload);
    await loadLeadersTable();
    closeLeaderModal();
    showAlert(adminAlert, "Leader saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save leader.");
    console.error(err);
  }
});

async function handleDeleteLeader(id) {
  if (!confirm("Delete this leader? This cannot be undone.")) return;
  const data = leadersData.find((item) => item.id === id);

  try {
    await deleteLeader(id);
    if (data?.imageId) {
      try {
        await deleteImage(data.imageId);
      } catch {
        /* non-critical */
      }
    }
    await loadLeadersTable();
    showAlert(adminAlert, "Leader deleted.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete leader.");
    console.error(err);
  }
}

async function handleDelete(type, id) {
  const labels = { news: "news article", updates: "update", history: "history article" };
  if (!confirm(`Delete this ${labels[type]}? This cannot be undone.`)) return;

  const data = getDataForType(type).find((item) => item.id === id);

  try {
    if (type === "news") {
      await deleteNews(id);
      await loadNewsTable();
    } else if (type === "updates") {
      await deleteUpdate(id);
      await loadUpdatesTable();
    } else if (type === "history") {
      await deleteHistory(id);
      await loadHistoryTable();
    }

    if (data?.imageId) {
      try {
        await deleteImage(data.imageId);
      } catch {
        /* orphaned media is non-critical */
      }
    }

    showAlert(adminAlert, "Deleted successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete. Check your permissions.");
    console.error(err);
  }
}

// ── About form submit ──
document.getElementById("about-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    fullName: document.getElementById("about-full-name").value.trim(),
    denomination: document.getElementById("about-denomination").value.trim(),
    registrationNumber: document.getElementById("about-registration").value.trim(),
    officeHours: document.getElementById("about-office-hours").value.trim(),
    whatsapp: document.getElementById("about-whatsapp").value.trim(),
    officePhone: document.getElementById("about-office-phone").value.trim(),
    officePhoneLink: document.getElementById("about-office-phone-link").value.trim(),
    instagram: document.getElementById("about-instagram").value.trim(),
    facebook: document.getElementById("about-facebook").value.trim(),
    emailAdmin: document.getElementById("about-email-admin").value.trim(),
    emailAccount: document.getElementById("about-email-account").value.trim(),
    youtubeSocial: document.getElementById("about-youtube-social").value.trim(),
    founderName: document.getElementById("about-founder-name").value.trim(),
    founderBio: document.getElementById("about-founder-bio").value.trim(),
    founderImageId: aboutUploads.founder?.getImageId() || null,
    mission: document.getElementById("about-mission").value.trim(),
    vision: document.getElementById("about-vision").value.trim(),
    values: document.getElementById("about-values").value.trim(),
    contactNote: document.getElementById("about-contact-note").value.trim(),
    heroImageId: aboutUploads.hero?.getImageId() || null,
    missionImageId: aboutUploads.mission?.getImageId() || null,
    visionImageId: aboutUploads.vision?.getImageId() || null,
    valuesImageId: aboutUploads.values?.getImageId() || null,
  };

  try {
    await saveAboutContent(data);
    showAlert(adminAlert, "About page saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save about page.");
    console.error(err);
  }
});

// ── Org chart form submit ──
document.getElementById("org-chart-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveOrgStructure({
      chartImageId: orgChartUpload?.getImageId() || null,
    });
    showAlert(adminAlert, "Organisation chart saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save organisation chart.");
    console.error(err);
  }
});

// ── Settings form submit ──
document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    churchName: document.getElementById("settings-church-name").value.trim(),
    tagline: document.getElementById("settings-tagline").value.trim(),
    youtubeLiveUrl: document.getElementById("settings-youtube-live").value.trim(),
    youtubeChannelUrl: document.getElementById("settings-youtube-channel").value.trim(),
    youtubeVideoId: document.getElementById("settings-youtube-video-id").value.trim(),
    serviceTimes: document.getElementById("settings-service-times").value.trim(),
    address: document.getElementById("settings-address").value.trim(),
    phone: document.getElementById("settings-phone").value.trim(),
    email: document.getElementById("settings-email").value.trim(),
  };

  try {
    await saveSiteSettings(data);
    showAlert(adminAlert, "Settings saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save settings.");
    console.error(err);
  }
});
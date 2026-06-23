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
  getNews,
  createNews,
  updateNews,
  deleteNews,
  getUpdates,
  createUpdate,
  updateUpdate,
  deleteUpdate,
  formatDate,
} from "./firebase-service.js";

const authScreen = document.getElementById("auth-screen");
const dashboard = document.getElementById("admin-dashboard");
const logoutBtn = document.getElementById("logout-btn");
const authAlert = document.getElementById("auth-alert");
const adminAlert = document.getElementById("admin-alert");

const modal = document.getElementById("crud-modal");
const crudForm = document.getElementById("crud-form");

let newsData = [];
let updatesData = [];

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

function showDashboard(user) {
  authScreen.style.display = "none";
  dashboard.style.display = user ? "grid" : "none";
  logoutBtn.style.display = user ? "inline-flex" : "none";
  if (user) loadAllData();
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showDashboard(user);
  } else {
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
  await Promise.all([loadNewsTable(), loadUpdatesTable(), loadAboutForm(), loadSettingsForm()]);
}

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
        <td>${escapeHtml(item.title)}</td>
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

    tbody.querySelectorAll("[data-edit-news]").forEach((btn) => {
      btn.addEventListener("click", () => openModal("news", btn.dataset.editNews));
    });
    tbody.querySelectorAll("[data-delete-news]").forEach((btn) => {
      btn.addEventListener("click", () => handleDelete("news", btn.dataset.deleteNews));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3">Failed to load news.</td></tr>`;
    console.error(err);
  }
}

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
        <td>${escapeHtml(item.title)}</td>
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

    tbody.querySelectorAll("[data-edit-update]").forEach((btn) => {
      btn.addEventListener("click", () => openModal("updates", btn.dataset.editUpdate));
    });
    tbody.querySelectorAll("[data-delete-update]").forEach((btn) => {
      btn.addEventListener("click", () => handleDelete("updates", btn.dataset.deleteUpdate));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Failed to load updates.</td></tr>`;
    console.error(err);
  }
}

async function loadAboutForm() {
  const about = await getAboutContent();
  document.getElementById("about-history").value = about.history || "";
  document.getElementById("about-mission").value = about.mission || "";
  document.getElementById("about-vision").value = about.vision || "";
  document.getElementById("about-values").value = about.values || "";
  document.getElementById("about-contact-note").value = about.contactNote || "";
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

document.getElementById("add-news-btn").addEventListener("click", () => openModal("news"));
document.getElementById("add-update-btn").addEventListener("click", () => openModal("updates"));

function openModal(type, id = null) {
  const isUpdate = type === "updates";
  const data = id
    ? (isUpdate ? updatesData : newsData).find((item) => item.id === id)
    : null;

  document.getElementById("modal-title").textContent = id
    ? `Edit ${isUpdate ? "Update" : "News"}`
    : `Add ${isUpdate ? "Update" : "News"}`;
  document.getElementById("crud-id").value = id || "";
  document.getElementById("crud-type").value = type;
  document.getElementById("crud-title").value = data?.title || "";
  document.getElementById("crud-content").value = data?.content || "";
  document.getElementById("crud-date").value = toInputDate(data?.date);
  document.getElementById("crud-priority-group").style.display = isUpdate ? "block" : "none";
  if (isUpdate) {
    document.getElementById("crud-priority").value = data?.priority || "normal";
  }

  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
  crudForm.reset();
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
  const payload = {
    title: document.getElementById("crud-title").value.trim(),
    content: document.getElementById("crud-content").value.trim(),
    date: document.getElementById("crud-date").value,
  };

  if (type === "updates") {
    payload.priority = document.getElementById("crud-priority").value;
  }

  try {
    if (type === "news") {
      if (id) await updateNews(id, payload);
      else await createNews(payload);
      await loadNewsTable();
    } else {
      if (id) await updateUpdate(id, payload);
      else await createUpdate(payload);
      await loadUpdatesTable();
    }
    closeModal();
    showAlert(adminAlert, "Saved successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save. Check your permissions.");
    console.error(err);
  }
});

async function handleDelete(type, id) {
  const label = type === "news" ? "news article" : "update";
  if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;

  try {
    if (type === "news") {
      await deleteNews(id);
      await loadNewsTable();
    } else {
      await deleteUpdate(id);
      await loadUpdatesTable();
    }
    showAlert(adminAlert, "Deleted successfully.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to delete. Check your permissions.");
    console.error(err);
  }
}

document.getElementById("about-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    history: document.getElementById("about-history").value.trim(),
    mission: document.getElementById("about-mission").value.trim(),
    vision: document.getElementById("about-vision").value.trim(),
    values: document.getElementById("about-values").value.trim(),
    contactNote: document.getElementById("about-contact-note").value.trim(),
  };

  try {
    await saveAboutContent(data);
    showAlert(adminAlert, "About page saved.", "success");
  } catch (err) {
    showAlert(adminAlert, "Failed to save about page.");
    console.error(err);
  }
});

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

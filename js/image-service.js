import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { db, storage } from "./firebase-init.js";
import { compressImageForFirestore, toDataUrl } from "./image-compress.js";

const MAX_STORAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Uploads a file to Firebase Storage exactly as given — no compression or
 * re-encoding. Use this (instead of uploadImage, which re-encodes
 * everything to JPEG) for media that must stay unmodified, like an
 * animated GIF, where compressing it would just flatten it to a single
 * static frame. Returns the file's public download URL.
 */
export async function uploadRawMedia(file, pathPrefix = "siteMedia") {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image or GIF file.");
  }
  if (file.size > MAX_STORAGE_UPLOAD_BYTES) {
    throw new Error("File exceeds the 25 MB upload limit.");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${pathPrefix}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return { url: await getDownloadURL(fileRef), path };
}

/** Deletes a previously uploaded raw media file by its Storage path. */
export async function deleteRawMedia(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    // Already gone, or never existed — not worth failing over.
    console.error("Failed to delete storage file:", err);
  }
}

const mediaCache = new Map();

/**
 * Upload a compressed image to Firestore media collection.
 * @returns {Promise<string>} media document ID
 */
export async function uploadImage(file) {
  const compressed = await compressImageForFirestore(file);
  const ref = await addDoc(collection(db, "media"), {
    ...compressed,
    createdAt: serverTimestamp(),
  });
  mediaCache.set(ref.id, compressed);
  return ref.id;
}

export async function getImage(imageId) {
  if (!imageId) return null;
  if (mediaCache.has(imageId)) {
    const cached = mediaCache.get(imageId);
    return { id: imageId, ...cached, url: toDataUrl(cached.mimeType, cached.data) };
  }
  const snap = await getDoc(doc(db, "media", imageId));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  data.url = toDataUrl(data.mimeType, data.data);
  mediaCache.set(imageId, data);
  return data;
}

export async function getImageUrl(imageId) {
  const img = await getImage(imageId);
  return img?.url || null;
}

export async function deleteImage(imageId) {
  if (!imageId) return;
  await deleteDoc(doc(db, "media", imageId));
  mediaCache.delete(imageId);
}

/** Bind an image upload widget to a container element */
export function bindImageUpload(container, options = {}) {
  const {
    inputId = `img-input-${Math.random().toString(36).slice(2)}`,
    label = "Image",
    hint = "Max 8 MB upload — compressed to ~800 KB for storage.",
    currentImageId = null,
    onImageIdChange = () => {},
  } = options;

  let pendingImageId = currentImageId;
  let previewUrl = null;

  container.innerHTML = `
    <div class="image-upload" data-image-upload>
      <label for="${inputId}">${label}</label>
      <p class="image-upload-hint">${hint}</p>
      <div class="image-upload-preview" data-preview>
        <span class="image-upload-placeholder">No image selected</span>
      </div>
      <div class="image-upload-actions">
        <input type="file" id="${inputId}" accept="image/*" class="image-upload-hidden-input" />
        <label for="${inputId}" class="btn btn-outline btn-sm">Choose Image</label>
        <button type="button" class="btn btn-ghost btn-sm" data-remove-image style="display:none;">Remove</button>
        <span class="image-upload-status" data-status></span>
      </div>
      <input type="hidden" data-image-id value="${currentImageId || ""}" />
    </div>`;

  const input = container.querySelector(`#${inputId}`);
  const preview = container.querySelector("[data-preview]");
  const status = container.querySelector("[data-status]");
  const hidden = container.querySelector("[data-image-id]");
  const removeBtn = container.querySelector("[data-remove-image]");

  async function showPreview(imageId) {
    if (!imageId) {
      preview.innerHTML = `<span class="image-upload-placeholder">No image selected</span>`;
      removeBtn.style.display = "none";
      return;
    }
    const url = previewUrl || (await getImageUrl(imageId));
    if (url) {
      preview.innerHTML = `<img src="${url}" alt="Preview" />`;
      removeBtn.style.display = "inline-flex";
    }
  }

  showPreview(currentImageId);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    status.textContent = "Compressing…";
    status.className = "image-upload-status loading-text";

    try {
      const oldId = pendingImageId;
      const newId = await uploadImage(file);
      pendingImageId = newId;
      hidden.value = newId;
      previewUrl = null;
      await showPreview(newId);
      onImageIdChange(newId, oldId);
      status.textContent = "Image ready";
      status.className = "image-upload-status success-text";
    } catch (err) {
      status.textContent = err.message || "Upload failed";
      status.className = "image-upload-status error-text";
      input.value = "";
    }
  });

  removeBtn.addEventListener("click", () => {
    pendingImageId = null;
    hidden.value = "";
    previewUrl = null;
    input.value = "";
    preview.innerHTML = `<span class="image-upload-placeholder">No image selected</span>`;
    removeBtn.style.display = "none";
    status.textContent = "";
    onImageIdChange(null);
  });

  return {
    getImageId: () => hidden.value || null,
    setImageId: (id) => {
      pendingImageId = id;
      hidden.value = id || "";
      showPreview(id);
    },
  };
}

/**
 * Bind an upload widget for media that must stay unmodified (e.g. an
 * animated GIF) — same look and feel as bindImageUpload, but backed by
 * uploadRawMedia/Storage instead of the Firestore compression pipeline.
 * The old file (if any) is deleted from Storage whenever it's replaced
 * or removed, so replacing the tagline GIF doesn't leave the previous one
 * sitting there unused.
 */
export function bindRawMediaUpload(container, options = {}) {
  const {
    inputId = `raw-img-input-${Math.random().toString(36).slice(2)}`,
    label = "Image",
    hint = "",
    currentUrl = null,
    currentPath = null,
    onChange = () => {},
  } = options;

  let pendingUrl = currentUrl;
  let pendingPath = currentPath;

  container.innerHTML = `
    <div class="image-upload" data-image-upload>
      <label for="${inputId}">${label}</label>
      ${hint ? `<p class="image-upload-hint">${hint}</p>` : ""}
      <div class="image-upload-preview" data-preview>
        ${currentUrl ? `<img src="${currentUrl}" alt="Preview" />` : `<span class="image-upload-placeholder">No file selected</span>`}
      </div>
      <div class="image-upload-actions">
        <input type="file" id="${inputId}" accept="image/*" class="image-upload-hidden-input" />
        <label for="${inputId}" class="btn btn-outline btn-sm">Choose File</label>
        <button type="button" class="btn btn-ghost btn-sm" data-remove-image style="display:${currentUrl ? "inline-flex" : "none"};">Remove</button>
        <span class="image-upload-status" data-status></span>
      </div>
      <input type="hidden" data-url value="${currentUrl || ""}" />
      <input type="hidden" data-path value="${currentPath || ""}" />
    </div>`;

  const input = container.querySelector(`#${inputId}`);
  const preview = container.querySelector("[data-preview]");
  const status = container.querySelector("[data-status]");
  const urlField = container.querySelector("[data-url]");
  const pathField = container.querySelector("[data-path]");
  const removeBtn = container.querySelector("[data-remove-image]");

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    status.textContent = "Uploading…";
    status.className = "image-upload-status loading-text";

    try {
      const oldPath = pendingPath;
      const { url, path } = await uploadRawMedia(file);
      pendingUrl = url;
      pendingPath = path;
      urlField.value = url;
      pathField.value = path;
      preview.innerHTML = `<img src="${url}" alt="Preview" />`;
      removeBtn.style.display = "inline-flex";
      onChange(url, path);
      status.textContent = "Upload ready";
      status.className = "image-upload-status success-text";
      if (oldPath) await deleteRawMedia(oldPath);
    } catch (err) {
      status.textContent = err.message || "Upload failed";
      status.className = "image-upload-status error-text";
      input.value = "";
    }
  });

  removeBtn.addEventListener("click", async () => {
    const oldPath = pendingPath;
    pendingUrl = null;
    pendingPath = null;
    input.value = "";
    urlField.value = "";
    pathField.value = "";
    preview.innerHTML = `<span class="image-upload-placeholder">No file selected</span>`;
    removeBtn.style.display = "none";
    status.textContent = "";
    onChange(null, null);
    if (oldPath) await deleteRawMedia(oldPath);
  });

  return {
    getUrl: () => urlField.value || null,
    getPath: () => pathField.value || null,
    setValue: (url, path) => {
      pendingUrl = url;
      pendingPath = path;
      urlField.value = url || "";
      pathField.value = path || "";
      preview.innerHTML = url ? `<img src="${url}" alt="Preview" />` : `<span class="image-upload-placeholder">No file selected</span>`;
      removeBtn.style.display = url ? "inline-flex" : "none";
    },
  };
}
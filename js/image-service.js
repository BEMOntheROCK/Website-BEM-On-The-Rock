import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { compressImageForFirestore, toDataUrl } from "./image-compress.js";

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
        <input type="file" id="${inputId}" accept="image/*" class="sr-only" />
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

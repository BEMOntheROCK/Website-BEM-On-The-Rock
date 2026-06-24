/** Max upload size before compression (8 MB) */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Target compressed file size (800 KB) */
export const TARGET_COMPRESSED_BYTES = 800 * 1024;

/** Firestore doc limit is 1 MB — keep base64 payload under this */
const MAX_BASE64_CHARS = 950 * 1024;

/**
 * Validate and compress an image file for Firestore storage.
 * @param {File} file
 * @returns {Promise<{ data: string, mimeType: string, sizeBytes: number }>}
 */
export async function compressImageForFirestore(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file (JPEG, PNG, or WebP).");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image exceeds the 8 MB upload limit.");
  }

  const bitmap = await loadImageBitmap(file);
  let { width, height } = bitmap;
  const maxDim = 2400;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  let quality = 0.92;
  let blob = await canvasToBlob(bitmap, width, height, quality);

  while (blob.size > TARGET_COMPRESSED_BYTES && quality > 0.15) {
    quality -= 0.08;
    blob = await canvasToBlob(bitmap, width, height, quality);
  }

  while (blob.size > TARGET_COMPRESSED_BYTES && width > 400) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    blob = await canvasToBlob(bitmap, width, height, quality);
  }

  const dataUrl = await blobToDataUrl(blob);
  let base64 = dataUrl.split(",")[1];

  while (base64.length > MAX_BASE64_CHARS && quality > 0.1) {
    quality -= 0.1;
    blob = await canvasToBlob(bitmap, width, height, quality);
    base64 = (await blobToDataUrl(blob)).split(",")[1];
  }

  if (base64.length > MAX_BASE64_CHARS) {
    throw new Error(
      "Could not compress image enough for storage. Try a smaller image."
    );
  }

  bitmap.close?.();

  return {
    data: base64,
    mimeType: blob.type || "image/jpeg",
    sizeBytes: blob.size,
  };
}

function loadImageBitmap(file) {
  return createImageBitmap(file);
}

function canvasToBlob(bitmap, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Build a displayable data URL from stored Firestore media fields */
export function toDataUrl(mimeType, base64Data) {
  if (!base64Data) return null;
  if (base64Data.startsWith("data:")) return base64Data;
  return `data:${mimeType || "image/jpeg"};base64,${base64Data}`;
}

/** Format bytes for UI labels */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

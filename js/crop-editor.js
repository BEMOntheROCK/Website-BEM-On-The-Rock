import { DEFAULT_CROP, MIN_ZOOM, MAX_ZOOM, applyCropToImage } from "./image-crop.js";

/**
 * Mount an interactive crop editor into `container` (aspect ratio is
 * controlled by CSS on .crop-editor-box — currently 1:1).
 * Renders its own box + zoom slider. Call `.setImage(url)` when a new
 * image is uploaded, `.setCrop(crop)` to preload an existing crop,
 * `.getCrop()` to read the current value, and `.destroy()` to clean up.
 */
export function createCropEditor(container, { onChange = () => {} } = {}) {
  container.innerHTML = `
    <div class="crop-editor" data-crop-editor style="display:none;">
      <p class="crop-editor-label">Drag the image to reposition. Use the slider to zoom.</p>
      <div class="crop-editor-box" data-crop-box>
        <img data-crop-img alt="Crop preview" draggable="false" />
      </div>
      <div class="crop-editor-zoom">
        <span aria-hidden="true">－</span>
        <input type="range" data-crop-zoom min="${MIN_ZOOM}" max="${MAX_ZOOM}" step="0.01" value="${DEFAULT_CROP.zoom}" aria-label="Zoom" />
        <span aria-hidden="true">＋</span>
      </div>
    </div>`;

  const wrap   = container.querySelector("[data-crop-editor]");
  const box    = container.querySelector("[data-crop-box]");
  const img    = container.querySelector("[data-crop-img]");
  const zoomIn = container.querySelector("[data-crop-zoom]");

  let crop = { ...DEFAULT_CROP };
  let dragging = false;
  let dragStart = { px: 0, py: 0, x: 0, y: 0 };

  function render() {
    if (!img.src) return;
    applyCropToImage(img, box, crop);
  }

  function setImage(url) {
    if (!url) {
      wrap.style.display = "none";
      img.src = "";
      return;
    }
    wrap.style.display = "block";
    crop = { ...DEFAULT_CROP };
    zoomIn.value = crop.zoom;
    img.src = url;
    img.onload = render;
  }

  function setCrop(newCrop) {
    crop = { ...DEFAULT_CROP, ...(newCrop || {}) };
    zoomIn.value = crop.zoom;
    render();
  }

  function getCrop() {
    return { ...crop };
  }

  function pointerPos(e) {
    return e.touches ? { px: e.touches[0].clientX, py: e.touches[0].clientY } : { px: e.clientX, py: e.clientY };
  }

  function startDrag(e) {
    if (!img.src) return;
    dragging = true;
    const pos = pointerPos(e);
    dragStart = { px: pos.px, py: pos.py, x: crop.x, y: crop.y };
    box.classList.add("dragging");
  }

  function moveDrag(e) {
    if (!dragging) return;
    e.preventDefault();
    const pos = pointerPos(e);
    const boxW = box.clientWidth;
    const boxH = box.clientHeight;

    // Rough range estimate for converting px delta into a 0..1 fraction —
    // recomputed precisely enough via the same scale math each render.
    const naturalW = img.naturalWidth || boxW;
    const naturalH = img.naturalHeight || boxH;
    const baseScale = Math.max(boxW / naturalW, boxH / naturalH);
    const scale = baseScale * crop.zoom;
    const maxOffsetX = Math.max(1, naturalW * scale - boxW);
    const maxOffsetY = Math.max(1, naturalH * scale - boxH);

    const dx = pos.px - dragStart.px;
    const dy = pos.py - dragStart.py;

    crop.x = Math.min(1, Math.max(0, dragStart.x - dx / maxOffsetX));
    crop.y = Math.min(1, Math.max(0, dragStart.y - dy / maxOffsetY));
    render();
    onChange(getCrop());
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    box.classList.remove("dragging");
  }

  box.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", moveDrag);
  window.addEventListener("mouseup", endDrag);
  box.addEventListener("touchstart", startDrag, { passive: true });
  window.addEventListener("touchmove", moveDrag, { passive: false });
  window.addEventListener("touchend", endDrag);

  zoomIn.addEventListener("input", () => {
    crop.zoom = parseFloat(zoomIn.value);
    render();
    onChange(getCrop());
  });

  return { setImage, setCrop, getCrop };
}
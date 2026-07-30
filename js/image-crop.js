/**
 * Shared crop math for the fixed-aspect-ratio pan+zoom cropper (currently
 * 1:1, set via CSS — this module doesn't hardcode a ratio itself).
 *
 * A crop is stored as: { zoom, x, y }
 *   zoom — multiplier on top of the minimum "cover" scale (1 = no extra zoom,
 *          up to MAX_ZOOM = fully zoomed in)
 *   x, y — 0..1 fraction of how far the image is panned within its
 *          available range (0 = image's left/top edge aligned with the
 *          container, 1 = image's right/bottom edge aligned with the
 *          container, 0.5 = centered)
 *
 * This normalized (fraction-based) representation means the same crop
 * reproduces identically regardless of how large the container is actually
 * rendered at (admin editor vs. homepage carousel vs. modal).
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export const DEFAULT_CROP = { zoom: 1, x: 0.5, y: 0.5 };

/**
 * Compute the width/height/left/top (in px) to apply to an absolutely
 * positioned <img> inside an overflow:hidden container so that it fills
 * the container per the given crop.
 */
export function computeCropRect({ containerW, containerH, naturalW, naturalH, zoom = 1, x = 0.5, y = 0.5 }) {
  if (!containerW || !containerH || !naturalW || !naturalH) {
    return { width: containerW || 0, height: containerH || 0, left: 0, top: 0 };
  }

  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const baseScale = Math.max(containerW / naturalW, containerH / naturalH);
  const scale = baseScale * clampedZoom;

  const displayW = naturalW * scale;
  const displayH = naturalH * scale;

  const maxOffsetX = Math.max(0, displayW - containerW);
  const maxOffsetY = Math.max(0, displayH - containerH);

  const clampedX = Math.min(1, Math.max(0, x));
  const clampedY = Math.min(1, Math.max(0, y));

  const left = -(maxOffsetX * clampedX);
  const top  = -(maxOffsetY * clampedY);

  return { width: displayW, height: displayH, left, top };
}

/** Apply a crop to an <img> element that sits inside a container with
    position:relative + overflow:hidden. Requires the image to already
    be loaded (naturalWidth/naturalHeight available). */
export function applyCropToImage(imgEl, containerEl, crop = DEFAULT_CROP) {
  const containerW = containerEl.clientWidth;
  const containerH = containerEl.clientHeight;
  const naturalW = imgEl.naturalWidth;
  const naturalH = imgEl.naturalHeight;

  const rect = computeCropRect({
    containerW, containerH, naturalW, naturalH,
    zoom: crop.zoom, x: crop.x, y: crop.y,
  });

  imgEl.style.position = "absolute";
  imgEl.style.width  = `${rect.width}px`;
  imgEl.style.height = `${rect.height}px`;
  imgEl.style.left   = `${rect.left}px`;
  imgEl.style.top    = `${rect.top}px`;
  imgEl.style.maxWidth = "none";
}

/** Load an image and apply the crop once ready; re-applies on container
    resize via ResizeObserver so it stays correct responsively. */
export function mountCroppedImage(containerEl, imgEl, crop = DEFAULT_CROP) {
  const apply = () => {
    if (imgEl.naturalWidth) applyCropToImage(imgEl, containerEl, crop);
  };

  if (imgEl.complete && imgEl.naturalWidth) {
    apply();
  } else {
    imgEl.addEventListener("load", apply, { once: true });
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(apply);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }
  return () => {};
}
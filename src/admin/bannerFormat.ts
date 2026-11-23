import { AdminError } from './api';

/**
 * Campaign banner formats. The admin picks one; the uploaded image is centre-cropped and resized to it in the
 * browser before upload, so every banner the pop-up shows is exactly 1:1 or 16:9 (no schema change needed:
 * the format lives in the image itself).
 */
export type BannerFormat = 'square' | 'wide';

export const BANNER_SIZES: Record<BannerFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1920, height: 1080 },
};

/** Same cap as the server (MAX_IMAGE_BYTES). */
const MAX_BYTES = 500_000;

/** The format closest to an image's aspect ratio (existing banners of other shapes map to the nearer one). */
export function nearestFormat(width: number, height: number): BannerFormat {
  if (width <= 0 || height <= 0) return 'square';
  const ratio = width / height;
  return Math.abs(Math.log(ratio / 1)) <= Math.abs(Math.log(ratio / (16 / 9))) ? 'square' : 'wide';
}

/** The largest centred source rectangle with the target aspect ratio (what object-fit: cover keeps). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const target = dstW / dstH;
  if (srcW / srcH > target) {
    const w = Math.round(srcH * target);
    return { x: Math.round((srcW - w) / 2), y: 0, w, h: srcH };
  }
  const h = Math.round(srcW / target);
  return { x: 0, y: Math.round((srcH - h) / 2), w: srcW, h };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AdminError('image_unreadable', 400));
    img.src = src;
  });
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/** Centre-crops and resizes an image file to the format, as a JPEG under the upload limit. */
export async function fitBanner(file: Blob, format: BannerFormat): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = BANNER_SIZES[format];
    const crop = coverCrop(img.naturalWidth, img.naturalHeight, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AdminError('image_unreadable', 400);
    ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
      const blob = await toBlob(canvas, quality);
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new AdminError('image_too_large', 413);
  } finally {
    URL.revokeObjectURL(url);
  }
}

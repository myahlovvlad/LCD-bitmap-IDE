/**
 * @module features/pixel-importer/imageProcessor
 * @description Browser-side image loading and letterbox scaling to LCD size.
 */

import { SCREEN_H, SCREEN_W } from '../../shared/constants/display';

export interface PreparedImage {
  readonly originalUrl: string;
  readonly imageData: ImageData;
}

/** Loads PNG/JPG/BMP/SVG through an ImageBitmap-safe browser path. */
export async function prepareImageFile(file: File, width = SCREEN_W, height = SCREEN_H): Promise<PreparedImage> {
  const originalUrl = URL.createObjectURL(file);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(originalUrl);
    throw new Error('Canvas 2D context is unavailable.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawWidth = Math.max(1, Math.round(bitmap.width * scale));
  const drawHeight = Math.max(1, Math.round(bitmap.height * scale));
  const left = Math.floor((width - drawWidth) / 2);
  const top = Math.floor((height - drawHeight) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, left, top, drawWidth, drawHeight);
  bitmap.close();
  return { originalUrl, imageData: ctx.getImageData(0, 0, width, height) };
}

/**
 * @module features/pixel-importer/dithering
 * @description Image binarization and Floyd-Steinberg dithering for converting
 * imported artwork into a monochrome LCD framebuffer.
 */

import { packFrameBuffer, type FrameBuffer } from '../../renderer/utils/render';

export interface BinarizeOptions {
  readonly threshold: number;
  readonly dither: boolean;
}

/** Converts RGBA pixels into 8-bit luminance values. */
export function rgbaToGrayscale(data: Uint8ClampedArray, width: number, height: number): number[] {
  const gray = new Array<number>(width * height);
  for (let i = 0; i < gray.length; i += 1) {
    const offset = i * 4;
    const alpha = data[offset + 3] / 255;
    const r = 255 * (1 - alpha) + data[offset] * alpha;
    const g = 255 * (1 - alpha) + data[offset + 1] * alpha;
    const b = 255 * (1 - alpha) + data[offset + 2] * alpha;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/**
 * Binarizes grayscale pixels. With dithering enabled, quantization error is
 * distributed to neighboring pixels using the Floyd-Steinberg kernel:
 * right 7/16, down-left 3/16, down 5/16, down-right 1/16.
 */
export function binarizeGrayscale(
  grayscale: readonly number[],
  width: number,
  height: number,
  options: BinarizeOptions
): FrameBuffer {
  const values = grayscale.map((value) => value);
  const frameBuffer: FrameBuffer = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  const threshold = Math.max(0, Math.min(255, Math.round(options.threshold)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldPixel = values[index];
      const newPixel = oldPixel < threshold ? 0 : 255;
      frameBuffer[y][x] = newPixel === 0;

      if (!options.dither) {
        continue;
      }

      const error = oldPixel - newPixel;
      distributeError(values, width, height, x + 1, y, error * 7 / 16);
      distributeError(values, width, height, x - 1, y + 1, error * 3 / 16);
      distributeError(values, width, height, x, y + 1, error * 5 / 16);
      distributeError(values, width, height, x + 1, y + 1, error * 1 / 16);
    }
  }

  return frameBuffer;
}

/** Packs binarized grayscale into vertical LSB LCD page bytes. */
export function binarizeToBytes(
  grayscale: readonly number[],
  width: number,
  height: number,
  options: BinarizeOptions
): number[] {
  return packFrameBuffer(binarizeGrayscale(grayscale, width, height, options), width, height);
}

function distributeError(values: number[], width: number, height: number, x: number, y: number, error: number): void {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return;
  }
  const index = y * width + x;
  values[index] = Math.max(0, Math.min(255, values[index] + error));
}

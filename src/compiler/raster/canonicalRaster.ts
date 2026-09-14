export interface CanonicalRaster {
  readonly width: number;
  readonly height: number;
  /** Row-major, unpremultiplied 0xAARRGGBB pixels. */
  readonly pixels: Uint32Array;
}

export const OPAQUE_BLACK = 0xff000000;
export const OPAQUE_WHITE = 0xffffffff;

export function createCanonicalRaster(width: number, height: number, pixels?: Iterable<number>): CanonicalRaster {
  assertDimensions(width, height);
  const data = pixels ? Uint32Array.from(pixels) : new Uint32Array(width * height).fill(OPAQUE_BLACK);
  if (data.length !== width * height) {
    throw new Error(`Canonical raster needs ${width * height} pixels, received ${data.length}.`);
  }
  return { width, height, pixels: data };
}

export function canonicalRasterFromMonochromeRows(rows: readonly (readonly boolean[])[]): CanonicalRaster {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  assertDimensions(width, height);
  if (rows.some((row) => row.length !== width)) throw new Error('Canonical raster rows must have equal width.');
  return createCanonicalRaster(width, height, rows.flatMap((row) => row.map((pixel) => pixel ? OPAQUE_WHITE : OPAQUE_BLACK)));
}

export function canonicalRasterToMonochromeRows(raster: CanonicalRaster): boolean[][] {
  assertCanonicalRaster(raster);
  return Array.from({ length: raster.height }, (_, y) =>
    Array.from({ length: raster.width }, (_, x) => luminance(raster.pixels[y * raster.width + x]) >= 128)
  );
}

export function canonicalRasterToRgbaBytes(raster: CanonicalRaster): Uint8Array {
  assertCanonicalRaster(raster);
  const bytes = new Uint8Array(raster.pixels.length * 4);
  raster.pixels.forEach((pixel, index) => {
    bytes[index * 4] = (pixel >>> 16) & 0xff;
    bytes[index * 4 + 1] = (pixel >>> 8) & 0xff;
    bytes[index * 4 + 2] = pixel & 0xff;
    bytes[index * 4 + 3] = (pixel >>> 24) & 0xff;
  });
  return bytes;
}

export function rgba(r: number, g: number, b: number, a = 255): number {
  return ((clampByte(a) << 24) | (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)) >>> 0;
}

export function channels(pixel: number): { r: number; g: number; b: number; a: number } {
  return { r: (pixel >>> 16) & 0xff, g: (pixel >>> 8) & 0xff, b: pixel & 0xff, a: (pixel >>> 24) & 0xff };
}

export function luminance(pixel: number): number {
  const { r, g, b, a } = channels(pixel);
  if (a === 0) return 0;
  return Math.round((r * 299 + g * 587 + b * 114) / 1000);
}

export function assertCanonicalRaster(raster: CanonicalRaster): void {
  assertDimensions(raster.width, raster.height);
  if (!(raster.pixels instanceof Uint32Array) || raster.pixels.length !== raster.width * raster.height) {
    throw new Error('Canonical raster pixels must be a width*height Uint32Array.');
  }
}

function assertDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Canonical raster dimensions must be positive integers.');
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

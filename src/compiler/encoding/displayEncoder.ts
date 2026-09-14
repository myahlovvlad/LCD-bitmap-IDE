import {
  displayMemoryDimensions,
  minimumRowStride,
  validateDisplayProfile,
  type DisplayProfile
} from '../../domain/displayProfile';
import { assertCanonicalRaster, channels, luminance, type CanonicalRaster } from '../raster/canonicalRaster';

export type DisplayEncodingSpec = DisplayProfile;

export function calculateEncodedByteLength(profile: DisplayProfile): number {
  assertDisplayProfile(profile);
  const memory = displayMemoryDimensions(profile);
  const alignment = profile.alignment ?? 1;
  if (profile.packing === 'vertical-pages') {
    const pageHeight = profile.pageHeight ?? 8;
    const stride = profile.rowStride ?? align(memory.width, alignment);
    return stride * Math.ceil(memory.height / pageHeight);
  }
  const minimum = profile.packing === 'planar'
    ? Math.ceil(memory.width / 8)
    : minimumRowStride(profile);
  const stride = profile.rowStride ?? align(minimum, alignment);
  return stride * memory.height * (profile.packing === 'planar' ? profile.bitsPerPixel : 1);
}

/** @deprecated Use calculateEncodedByteLength. */
export const getEncodedDisplayByteLength = calculateEncodedByteLength;

export function encodeDisplayRaster(raster: CanonicalRaster, profile: DisplayProfile): number[] {
  assertDisplayProfile(profile);
  assertCanonicalRaster(raster);
  if (raster.width !== profile.width || raster.height !== profile.height) {
    throw new Error(`Canonical raster ${raster.width}x${raster.height} does not match display ${profile.width}x${profile.height}.`);
  }
  const bytes = new Uint8Array(calculateEncodedByteLength(profile));
  if (profile.inverted) bytes.fill(0xff);
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const sample = sampleFromPixel(raster.pixels[y * raster.width + x], profile);
      writeDisplaySample(bytes, profile, x, y, profile.inverted ? maxSample(profile) - sample : sample);
    }
  }
  return Array.from(bytes);
}

export function writeDisplaySample(bytes: Uint8Array, profile: DisplayProfile, x: number, y: number, sample: number): void {
  const point = logicalToMemory(profile, x, y);
  const memory = displayMemoryDimensions(profile);
  if (profile.packing === 'vertical-pages') {
    const stride = profile.rowStride ?? align(memory.width, profile.alignment ?? 1);
    const pageHeight = profile.pageHeight ?? 8;
    const byteIndex = Math.floor(point.y / pageHeight) * stride + point.x;
    const bitInPage = point.y % pageHeight;
    const bit = profile.bitOrder === 'lsb-first' ? bitInPage : 7 - bitInPage;
    writeBit(bytes, byteIndex, bit, sample & 1);
    return;
  }
  if (profile.packing === 'planar') {
    const stride = profile.rowStride ?? align(Math.ceil(memory.width / 8), profile.alignment ?? 1);
    const planeSize = stride * memory.height;
    for (let plane = 0; plane < profile.bitsPerPixel; plane += 1) {
      const byteIndex = plane * planeSize + point.y * stride + Math.floor(point.x / 8);
      const bit = profile.bitOrder === 'lsb-first' ? point.x % 8 : 7 - (point.x % 8);
      writeBit(bytes, byteIndex, bit, (sample >>> plane) & 1);
    }
    return;
  }
  const stride = profile.rowStride ?? align(minimumRowStride(profile), profile.alignment ?? 1);
  const rowStart = point.y * stride;
  if (profile.bitsPerPixel < 8) {
    const bitOffset = point.x * profile.bitsPerPixel;
    const byteIndex = rowStart + Math.floor(bitOffset / 8);
    const shift = profile.bitOrder === 'lsb-first'
      ? bitOffset % 8
      : 8 - profile.bitsPerPixel - (bitOffset % 8);
    const mask = maxSample(profile) << shift;
    bytes[byteIndex] = (bytes[byteIndex] & ~mask) | ((sample << shift) & mask);
    return;
  }
  writeMultiByteSample(bytes, rowStart + point.x * (profile.bitsPerPixel / 8), sample, profile.bitsPerPixel / 8, profile.byteOrder);
}

export function sampleFromPixel(pixel: number, profile: DisplayProfile): number {
  const { r, g, b, a } = channels(pixel);
  switch (profile.pixelFormat) {
    case 'mono1': return luminance(pixel) >= 128 ? 1 : 0;
    case 'gray2': return Math.round(luminance(pixel) * 3 / 255);
    case 'gray4': return Math.round(luminance(pixel) * 15 / 255);
    case 'indexed8': return nearestPaletteIndex(pixel, profile.palette);
    case 'rgb332': return ((r >>> 5) << 5) | ((g >>> 5) << 2) | (b >>> 6);
    case 'rgb565': return ((r >>> 3) << 11) | ((g >>> 2) << 5) | (b >>> 3);
    case 'rgb888': return (r << 16) | (g << 8) | b;
    case 'argb8888': return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }
}

export function logicalToMemory(profile: DisplayProfile, logicalX: number, logicalY: number): { x: number; y: number } {
  const x = profile.mirrorX ? profile.width - 1 - logicalX : logicalX;
  const y = profile.mirrorY ? profile.height - 1 - logicalY : logicalY;
  switch (profile.rotation) {
    case 0: return { x, y };
    case 90: return { x: profile.height - 1 - y, y: x };
    case 180: return { x: profile.width - 1 - x, y: profile.height - 1 - y };
    case 270: return { x: y, y: profile.width - 1 - x };
  }
}

export function maxSample(profile: Pick<DisplayProfile, 'bitsPerPixel'>): number {
  return profile.bitsPerPixel === 32 ? 0xffffffff : (2 ** profile.bitsPerPixel) - 1;
}

function assertDisplayProfile(profile: DisplayProfile): void {
  const errors = validateDisplayProfile(profile).filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`Invalid display profile: ${errors.map((item) => `${item.path}: ${item.message}`).join('; ')}`);
}

function align(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function writeBit(bytes: Uint8Array, index: number, bit: number, value: number): void {
  if (value) bytes[index] |= 1 << bit;
  else bytes[index] &= ~(1 << bit);
}

function writeMultiByteSample(bytes: Uint8Array, index: number, sample: number, byteCount: number, byteOrder: DisplayProfile['byteOrder']): void {
  for (let byte = 0; byte < byteCount; byte += 1) {
    const source = byteOrder === 'little-endian' ? byte : byteCount - 1 - byte;
    bytes[index + byte] = Math.floor(sample / (2 ** (source * 8))) & 0xff;
  }
}

function nearestPaletteIndex(pixel: number, palette?: string[]): number {
  if (!palette?.length) return luminance(pixel);
  const source = channels(pixel);
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  palette.slice(0, 256).forEach((entry, index) => {
    const target = parseHexColor(entry);
    const distance = (source.r - target.r) ** 2 + (source.g - target.g) ** 2 + (source.b - target.b) ** 2 + (source.a - target.a) ** 2;
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
  });
  return bestIndex;
}

function parseHexColor(value: string): { r: number; g: number; b: number; a: number } {
  const hex = value.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 255 };
  if (/^[0-9a-f]{8}$/i.test(hex)) return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: parseInt(hex.slice(6, 8), 16) };
  return { r: 0, g: 0, b: 0, a: 255 };
}

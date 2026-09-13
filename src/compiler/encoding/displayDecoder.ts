import { displayMemoryDimensions, minimumRowStride, type DisplayProfile } from '../../domain/displayProfile';
import { channels, createCanonicalRaster, rgba, type CanonicalRaster } from '../raster/canonicalRaster';
import { calculateEncodedByteLength, logicalToMemory, maxSample } from './displayEncoder';

export function decodeDisplayBytes(bytesInput: readonly number[] | Uint8Array, profile: DisplayProfile): CanonicalRaster {
  const expectedLength = calculateEncodedByteLength(profile);
  if (bytesInput.length !== expectedLength) {
    throw new Error(`Encoded display artifact has ${bytesInput.length} bytes; profile requires ${expectedLength}.`);
  }
  const bytes = bytesInput instanceof Uint8Array ? bytesInput : Uint8Array.from(bytesInput);
  const pixels = new Uint32Array(profile.width * profile.height);
  for (let y = 0; y < profile.height; y += 1) {
    for (let x = 0; x < profile.width; x += 1) {
      const encoded = readDisplaySample(bytes, profile, x, y);
      const sample = profile.inverted ? maxSample(profile) - encoded : encoded;
      pixels[y * profile.width + x] = pixelFromSample(sample, profile);
    }
  }
  return createCanonicalRaster(profile.width, profile.height, pixels);
}

export const decode = decodeDisplayBytes;

export function readDisplaySample(bytes: Uint8Array, profile: DisplayProfile, x: number, y: number): number {
  const point = logicalToMemory(profile, x, y);
  const memory = displayMemoryDimensions(profile);
  const alignment = profile.alignment ?? 1;
  if (profile.packing === 'vertical-pages') {
    const stride = profile.rowStride ?? align(memory.width, alignment);
    const bitInPage = point.y % (profile.pageHeight ?? 8);
    const bit = profile.bitOrder === 'lsb-first' ? bitInPage : 7 - bitInPage;
    return (bytes[Math.floor(point.y / (profile.pageHeight ?? 8)) * stride + point.x] >>> bit) & 1;
  }
  if (profile.packing === 'planar') {
    const stride = profile.rowStride ?? align(Math.ceil(memory.width / 8), alignment);
    const planeSize = stride * memory.height;
    let sample = 0;
    for (let plane = 0; plane < profile.bitsPerPixel; plane += 1) {
      const byteIndex = plane * planeSize + point.y * stride + Math.floor(point.x / 8);
      const bit = profile.bitOrder === 'lsb-first' ? point.x % 8 : 7 - (point.x % 8);
      sample |= ((bytes[byteIndex] >>> bit) & 1) << plane;
    }
    return sample;
  }
  const stride = profile.rowStride ?? align(minimumRowStride(profile), alignment);
  const rowStart = point.y * stride;
  if (profile.bitsPerPixel < 8) {
    const bitOffset = point.x * profile.bitsPerPixel;
    const shift = profile.bitOrder === 'lsb-first' ? bitOffset % 8 : 8 - profile.bitsPerPixel - (bitOffset % 8);
    return (bytes[rowStart + Math.floor(bitOffset / 8)] >>> shift) & maxSample(profile);
  }
  return readMultiByteSample(bytes, rowStart + point.x * (profile.bitsPerPixel / 8), profile.bitsPerPixel / 8, profile.byteOrder);
}

export function pixelFromSample(sample: number, profile: DisplayProfile): number {
  switch (profile.pixelFormat) {
    case 'mono1': return sample ? 0xffffffff : 0xff000000;
    case 'gray2': return gray(sample, 3);
    case 'gray4': return gray(sample, 15);
    case 'indexed8': return palettePixel(sample, profile.palette);
    case 'rgb332': {
      const r = expandBits((sample >>> 5) & 0x7, 3);
      const g = expandBits((sample >>> 2) & 0x7, 3);
      const b = expandBits(sample & 0x3, 2);
      return rgba(r, g, b);
    }
    case 'rgb565': {
      const r = expandBits((sample >>> 11) & 0x1f, 5);
      const g = expandBits((sample >>> 5) & 0x3f, 6);
      const b = expandBits(sample & 0x1f, 5);
      return rgba(r, g, b);
    }
    case 'rgb888': return rgba((sample >>> 16) & 0xff, (sample >>> 8) & 0xff, sample & 0xff);
    case 'argb8888': return sample >>> 0;
  }
}

function gray(sample: number, max: number): number {
  const value = Math.round(sample * 255 / max);
  return rgba(value, value, value);
}

function palettePixel(index: number, palette?: string[]): number {
  const value = palette?.[index];
  if (!value) return rgba(index, index, index);
  const hex = value.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return rgba(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
  if (/^[0-9a-f]{8}$/i.test(hex)) return rgba(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16));
  return 0xff000000;
}

function expandBits(value: number, bits: number): number {
  const max = (1 << bits) - 1;
  return Math.round(value * 255 / max);
}

function readMultiByteSample(bytes: Uint8Array, index: number, byteCount: number, order: DisplayProfile['byteOrder']): number {
  let sample = 0;
  for (let byte = 0; byte < byteCount; byte += 1) {
    const target = order === 'little-endian' ? byte : byteCount - 1 - byte;
    sample += bytes[index + byte] * (2 ** (target * 8));
  }
  return sample >>> 0;
}

function align(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

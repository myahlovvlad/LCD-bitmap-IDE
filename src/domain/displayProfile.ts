export const DISPLAY_PROFILE_SCHEMA_VERSION = 1 as const;

export type DisplayPixelFormat =
  | 'mono1'
  | 'gray2'
  | 'gray4'
  | 'indexed8'
  | 'rgb332'
  | 'rgb565'
  | 'rgb888'
  | 'argb8888';

export type DisplayBitsPerPixel = 1 | 2 | 4 | 8 | 16 | 24 | 32;
export type DisplayPacking = 'vertical-pages' | 'horizontal-row-major' | 'planar' | 'interleaved';
export type DisplayBitOrder = 'lsb-first' | 'msb-first';
export type DisplayByteOrder = 'little-endian' | 'big-endian';
export type DisplayRotation = 0 | 90 | 180 | 270;

export interface DisplayProfileSpec {
  id: string;
  schemaVersion: typeof DISPLAY_PROFILE_SCHEMA_VERSION;
  name: string;
  controller?: string;
  width: number;
  height: number;
  pixelFormat: DisplayPixelFormat;
  bitsPerPixel: DisplayBitsPerPixel;
  packing: DisplayPacking;
  bitOrder: DisplayBitOrder;
  byteOrder: DisplayByteOrder;
  rowStride?: number;
  pageHeight?: number;
  alignment?: number;
  rotation: DisplayRotation;
  mirrorX: boolean;
  mirrorY: boolean;
  inverted: boolean;
  palette?: string[];
}

export interface DisplayProfile extends DisplayProfileSpec {
  fingerprint: string;
}

export interface DisplayProfileDiagnostic {
  path: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface LegacyDisplayConfig {
  width: number;
  height: number;
  colorMode: 'monochrome';
  packing: 'vertical-lsb';
}

export function createDisplayProfile(spec: DisplayProfileSpec): DisplayProfile {
  const normalized = normalizeProfileSpec(spec);
  return { ...normalized, fingerprint: fingerprintDisplayProfile(normalized) };
}

export function exportDisplayProfile(profile: DisplayProfile): string {
  const diagnostics = validateDisplayProfile(profile).filter((item) => item.severity === 'error');
  if (diagnostics.length) throw new Error(diagnostics.map((item) => `${item.path}: ${item.message}`).join('; '));
  return `${JSON.stringify(sortRecord(profile as unknown as Record<string, unknown>), null, 2)}\n`;
}

export function importDisplayProfile(input: string | unknown): DisplayProfile {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isRecord(value) || value.schemaVersion !== DISPLAY_PROFILE_SCHEMA_VERSION) {
    throw new Error(`DisplayProfile schemaVersion ${DISPLAY_PROFILE_SCHEMA_VERSION} is required.`);
  }
  const suppliedFingerprint = value.fingerprint;
  const profile = normalizeDisplayProfile(value);
  if (typeof suppliedFingerprint !== 'string' || suppliedFingerprint !== profile.fingerprint) {
    throw new Error('DisplayProfile fingerprint does not match its canonical fields.');
  }
  const diagnostics = validateDisplayProfile(profile).filter((item) => item.severity === 'error');
  if (diagnostics.length) throw new Error(diagnostics.map((item) => `${item.path}: ${item.message}`).join('; '));
  return profile;
}

export function normalizeDisplayProfile(value: unknown, fallback?: Partial<DisplayProfileSpec>): DisplayProfile {
  const record = isRecord(value) ? value : {};
  const legacy = record.packing === 'vertical-lsb';
  const pixelFormat = readPixelFormat(record.pixelFormat, fallback?.pixelFormat ?? 'mono1');
  const bitsPerPixel = readBitsPerPixel(record.bitsPerPixel, bitsForPixelFormat(pixelFormat));
  const packing = legacy
    ? 'vertical-pages'
    : readPacking(record.packing, fallback?.packing ?? defaultPacking(pixelFormat));
  const spec: DisplayProfileSpec = {
    id: readNonEmptyString(record.id, fallback?.id ?? legacyProfileId(record.width, record.height)),
    schemaVersion: DISPLAY_PROFILE_SCHEMA_VERSION,
    name: readNonEmptyString(record.name, fallback?.name ?? `Display ${readPositiveInteger(record.width, fallback?.width ?? 128)}x${readPositiveInteger(record.height, fallback?.height ?? 64)}`),
    controller: readOptionalString(record.controller, fallback?.controller),
    width: readPositiveInteger(record.width, fallback?.width ?? 128),
    height: readPositiveInteger(record.height, fallback?.height ?? 64),
    pixelFormat,
    bitsPerPixel,
    packing,
    bitOrder: legacy ? 'lsb-first' : readBitOrder(record.bitOrder, fallback?.bitOrder ?? 'lsb-first'),
    byteOrder: readByteOrder(record.byteOrder, fallback?.byteOrder ?? 'little-endian'),
    rowStride: readOptionalPositiveInteger(record.rowStride, fallback?.rowStride),
    pageHeight: legacy ? 8 : readOptionalPositiveInteger(record.pageHeight, fallback?.pageHeight),
    alignment: readOptionalPositiveInteger(record.alignment, fallback?.alignment),
    rotation: readRotation(record.rotation, fallback?.rotation ?? 0),
    mirrorX: readBoolean(record.mirrorX, fallback?.mirrorX ?? false),
    mirrorY: readBoolean(record.mirrorY, fallback?.mirrorY ?? false),
    inverted: readBoolean(record.inverted, fallback?.inverted ?? false),
    palette: readPalette(record.palette, fallback?.palette)
  };
  return createDisplayProfile(spec);
}

export function fingerprintDisplayProfile(profile: DisplayProfileSpec | DisplayProfile): string {
  const canonical = JSON.stringify({
    id: profile.id,
    schemaVersion: profile.schemaVersion,
    name: profile.name,
    controller: profile.controller ?? null,
    width: profile.width,
    height: profile.height,
    pixelFormat: profile.pixelFormat,
    bitsPerPixel: profile.bitsPerPixel,
    packing: profile.packing,
    bitOrder: profile.bitOrder,
    byteOrder: profile.byteOrder,
    rowStride: profile.rowStride ?? null,
    pageHeight: profile.pageHeight ?? null,
    alignment: profile.alignment ?? null,
    rotation: profile.rotation,
    mirrorX: profile.mirrorX,
    mirrorY: profile.mirrorY,
    inverted: profile.inverted,
    palette: profile.palette ?? null
  });
  return `fnv1a64:${fnv1a64(canonical)}`;
}

export function validateDisplayProfile(profile: DisplayProfile): DisplayProfileDiagnostic[] {
  const diagnostics: DisplayProfileDiagnostic[] = [];
  const error = (path: string, code: string, message: string): void => {
    diagnostics.push({ path, severity: 'error', code, message });
  };
  if (typeof profile.id !== 'string' || !profile.id.trim()) error('id', 'required', 'Profile id is required.');
  if (!Number.isInteger(profile.width) || profile.width <= 0) error('width', 'positive-integer', 'Width must be a positive integer.');
  if (!Number.isInteger(profile.height) || profile.height <= 0) error('height', 'positive-integer', 'Height must be a positive integer.');
  const packingSupported = ['vertical-pages', 'horizontal-row-major', 'planar', 'interleaved'].includes(String(profile.packing));
  if (!packingSupported) {
    error('packing', 'unsupported-packing', `Unsupported display packing: ${String(profile.packing)}.`);
  }
  if (profile.bitsPerPixel !== bitsForPixelFormat(profile.pixelFormat)) {
    error('bitsPerPixel', 'pixel-format-mismatch', `${profile.pixelFormat} requires ${bitsForPixelFormat(profile.pixelFormat)} bits per pixel.`);
  }
  if (packingSupported && profile.packing === 'vertical-pages' && (profile.pixelFormat !== 'mono1' || profile.pageHeight !== 8)) {
    error('packing', 'vertical-pages-contract', 'Vertical pages currently require mono1 with pageHeight 8.');
  }
  if (packingSupported && profile.packing === 'planar' && !['gray2', 'gray4'].includes(profile.pixelFormat)) {
    error('packing', 'planar-contract', 'Planar packing currently supports gray2 and gray4.');
  }
  if (packingSupported && profile.pixelFormat === 'rgb565' && !['horizontal-row-major', 'interleaved'].includes(profile.packing)) {
    error('packing', 'rgb565-contract', 'RGB565 requires horizontal-row-major or interleaved packing.');
  }
  if (profile.rowStride !== undefined && profile.rowStride < minimumRowStride(profile)) {
    error('rowStride', 'stride-too-small', `rowStride must be at least ${minimumRowStride(profile)} bytes.`);
  }
  if (profile.alignment !== undefined && (!isPowerOfTwo(profile.alignment) || profile.alignment > 4096)) {
    error('alignment', 'invalid-alignment', 'Alignment must be a power of two no greater than 4096.');
  }
  if (profile.fingerprint !== fingerprintDisplayProfile(profile)) {
    error('fingerprint', 'fingerprint-mismatch', 'Profile fingerprint does not match its canonical fields.');
  }
  return diagnostics;
}

export function bitsForPixelFormat(pixelFormat: DisplayPixelFormat): DisplayBitsPerPixel {
  switch (pixelFormat) {
    case 'mono1': return 1;
    case 'gray2': return 2;
    case 'gray4': return 4;
    case 'indexed8':
    case 'rgb332': return 8;
    case 'rgb565': return 16;
    case 'rgb888': return 24;
    case 'argb8888': return 32;
  }
}

export function displayMemoryDimensions(profile: Pick<DisplayProfile, 'width' | 'height' | 'rotation'>): { width: number; height: number } {
  return profile.rotation === 90 || profile.rotation === 270
    ? { width: profile.height, height: profile.width }
    : { width: profile.width, height: profile.height };
}

export function minimumRowStride(profile: Pick<DisplayProfile, 'width' | 'height' | 'rotation' | 'bitsPerPixel' | 'packing'>): number {
  const memory = displayMemoryDimensions(profile);
  return profile.packing === 'vertical-pages' ? memory.width : Math.ceil(memory.width * profile.bitsPerPixel / 8);
}

function normalizeProfileSpec(spec: DisplayProfileSpec): DisplayProfileSpec {
  return {
    ...spec,
    controller: spec.controller?.trim() || undefined,
    rowStride: spec.rowStride,
    pageHeight: spec.packing === 'vertical-pages' ? (spec.pageHeight ?? 8) : spec.pageHeight,
    alignment: spec.alignment ?? 1,
    palette: spec.palette ? [...spec.palette] : undefined
  };
}

function defaultPacking(pixelFormat: DisplayPixelFormat): DisplayPacking {
  if (pixelFormat === 'mono1') return 'vertical-pages';
  if (pixelFormat === 'rgb565' || pixelFormat === 'rgb888' || pixelFormat === 'argb8888') return 'interleaved';
  return 'horizontal-row-major';
}

function legacyProfileId(width: unknown, height: unknown): string {
  return `legacy-${readPositiveInteger(width, 128)}x${readPositiveInteger(height, 64)}-vertical-lsb`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readOptionalString(value: unknown, fallback?: string): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readOptionalPositiveInteger(value: unknown, fallback?: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPixelFormat(value: unknown, fallback: DisplayPixelFormat): DisplayPixelFormat {
  return ['mono1', 'gray2', 'gray4', 'indexed8', 'rgb332', 'rgb565', 'rgb888', 'argb8888'].includes(String(value))
    ? value as DisplayPixelFormat : fallback;
}

function readBitsPerPixel(value: unknown, fallback: DisplayBitsPerPixel): DisplayBitsPerPixel {
  return [1, 2, 4, 8, 16, 24, 32].includes(Number(value)) ? value as DisplayBitsPerPixel : fallback;
}

function readPacking(value: unknown, fallback: DisplayPacking): DisplayPacking {
  return ['vertical-pages', 'horizontal-row-major', 'planar', 'interleaved'].includes(String(value))
    ? value as DisplayPacking : fallback;
}

function readBitOrder(value: unknown, fallback: DisplayBitOrder): DisplayBitOrder {
  return value === 'lsb-first' || value === 'msb-first' ? value : fallback;
}

function readByteOrder(value: unknown, fallback: DisplayByteOrder): DisplayByteOrder {
  return value === 'little-endian' || value === 'big-endian' ? value : fallback;
}

function readRotation(value: unknown, fallback: DisplayRotation): DisplayRotation {
  return [0, 90, 180, 270].includes(Number(value)) ? value as DisplayRotation : fallback;
}

function readPalette(value: unknown, fallback?: string[]): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : fallback ? [...fallback] : undefined;
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function sortRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
}

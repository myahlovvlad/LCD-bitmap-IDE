import { strToU8, zipSync, zlibSync, type Zippable } from 'fflate';
import type { FontGlyphs, LanguageCode, LcdBitmapProject } from '../../domain';
import { createCodegenArtifact, type CodegenArtifact } from '../artifacts/codegenArtifacts';
import { sha256Hex } from '../artifacts/sha256';
import { generateCArray, sanitizeSymbolName } from '../backends/legacyCBackend';
import { decodeDisplayBytes } from '../encoding/displayDecoder';
import { createCompilerTargetProfile } from '../profiles/legacyTargetProfile';
import {
  canonicalRasterToRgbaBytes,
  channels,
  createCanonicalRaster,
  rgba,
  type CanonicalRaster
} from '../raster/canonicalRaster';
import { createCompilerSourceSnapshot } from '../source/createCompilerSource';
import { normalizeProject } from '../normalization/normalizeProject';
import { lowerToTargetIr } from '../lowering/lowerToTargetIr';
import type { LoweredScreenIr } from '../target-ir/targetIr';

export const SOFTWARE_EVIDENCE_SCHEMA_VERSION = 1 as const;

export interface FramebufferComparison {
  expectedWidth: number;
  expectedHeight: number;
  differentPixels: number;
  maximumDifference: number;
  expectedHash: string;
  decodedHash: string;
  result: 'passed' | 'failed';
}

export interface SoftwareEvidenceBundle {
  schemaVersion: typeof SOFTWARE_EVIDENCE_SCHEMA_VERSION;
  screenId: string;
  profileFingerprint: string;
  projectFingerprint: string;
  comparison: FramebufferComparison;
  artifacts: readonly CodegenArtifact[];
  zip: Uint8Array;
}

export interface CreateSoftwareEvidenceBundleInput {
  project: LcdBitmapProject;
  language: LanguageCode;
  screenId?: string;
  fontGlyphs?: FontGlyphs;
  toolVersions?: Record<string, string>;
}

export interface RenderProjectScreenResult {
  screen: LoweredScreenIr;
  projectFingerprint: string;
}

export function renderProjectScreen(input: CreateSoftwareEvidenceBundleInput): RenderProjectScreenResult {
  const source = createCompilerSourceSnapshot({
    project: input.project,
    fontGlyphs: input.fontGlyphs,
    requestedLocales: [input.language]
  });
  const normalized = normalizeProject(source);
  const targetProfile = createCompilerTargetProfile(input.project.display);
  const target = lowerToTargetIr(normalized.ir, { language: input.language, targetProfile, fontGlyphs: input.fontGlyphs });
  const screen = target.screens.find((candidate) => candidate.id === input.screenId) ?? target.screens[0];
  if (!screen) throw new Error('Rendering requires at least one screen.');
  return { screen, projectFingerprint: normalized.fingerprint };
}

export function createSoftwareEvidenceBundle(input: CreateSoftwareEvidenceBundleInput): SoftwareEvidenceBundle {
  const rendered = renderProjectScreen(input);
  const screen = rendered.screen;
  const targetProfile = createCompilerTargetProfile(input.project.display);
  const decoded = decodeDisplayBytes(screen.framebufferBytes, input.project.display);
  const comparison = compareFramebuffers(screen.canonicalRaster, decoded);
  const diff = createPixelDiff(screen.canonicalRaster, decoded);
  const symbol = sanitizeSymbolName(`${screen.id}_screen`);
  const deterministicArtifacts = [
    artifact('report', 'display-profile.json', 'application/json', stableJson(input.project.display)),
    artifact('report', 'project-fingerprint.json', 'application/json', stableJson({ fingerprint: rendered.projectFingerprint })),
    artifact('binary', 'canonical-framebuffer.bin', 'application/octet-stream', canonicalRasterToRgbaBytes(screen.canonicalRaster)),
    artifact('binary', 'canonical-preview.png', 'image/png', encodeRasterPng(screen.canonicalRaster)),
    artifact('c-header', 'generated-screen.h', 'text/x-c', generateCArray(symbol, screen.framebufferBytes, targetProfile.codegen.cArrayBytesPerRow)),
    artifact('binary', 'generated-screen.bin', 'application/octet-stream', Uint8Array.from(screen.framebufferBytes)),
    artifact('binary', 'decoded-framebuffer.bin', 'application/octet-stream', canonicalRasterToRgbaBytes(decoded)),
    artifact('binary', 'decoded-preview.png', 'image/png', encodeRasterPng(decoded)),
    artifact('binary', 'pixel-diff.png', 'image/png', encodeRasterPng(diff)),
    artifact('report', 'comparison.json', 'application/json', stableJson(comparison)),
    artifact('report', 'tool-versions.json', 'application/json', stableJson({
      evidenceSchemaVersion: String(SOFTWARE_EVIDENCE_SCHEMA_VERSION),
      displayProfileSchemaVersion: String(input.project.display.schemaVersion),
      ...sortedRecord(input.toolVersions ?? { 'lcd-bitmap-ide': '0.1.18' })
    })),
    artifact('report', 'operations.log', 'text/plain', [
      `profile ${input.project.display.fingerprint}`,
      `render ${screen.id} ${screen.width}x${screen.height}`,
      `encode ${screen.framebufferBytes.length} bytes`,
      `decode ${screen.framebufferBytes.length} bytes`,
      `compare differentPixels=${comparison.differentPixels} maximumDifference=${comparison.maximumDifference}`,
      `result ${comparison.result}`,
      ''
    ].join('\n'))
  ];
  const manifestBody = {
    schemaVersion: SOFTWARE_EVIDENCE_SCHEMA_VERSION,
    screenId: screen.id,
    profileFingerprint: input.project.display.fingerprint,
    projectFingerprint: rendered.projectFingerprint,
    result: comparison.result,
    artifacts: deterministicArtifacts.map(({ path, mediaType, byteLength, sha256 }) => ({ path, mediaType, byteLength, sha256 }))
  };
  const manifest = artifact('manifest', 'manifest.json', 'application/json', stableJson(manifestBody));
  const artifacts = [manifest, ...deterministicArtifacts];
  return {
    schemaVersion: SOFTWARE_EVIDENCE_SCHEMA_VERSION,
    screenId: screen.id,
    profileFingerprint: input.project.display.fingerprint,
    projectFingerprint: rendered.projectFingerprint,
    comparison,
    artifacts,
    zip: zipArtifacts(artifacts)
  };
}

export function compareFramebuffers(expected: CanonicalRaster, decoded: CanonicalRaster): FramebufferComparison {
  if (expected.width !== decoded.width || expected.height !== decoded.height) {
    throw new Error(`Framebuffer dimensions differ: ${expected.width}x${expected.height} versus ${decoded.width}x${decoded.height}.`);
  }
  let differentPixels = 0;
  let maximumDifference = 0;
  for (let index = 0; index < expected.pixels.length; index += 1) {
    const left = channels(expected.pixels[index]);
    const right = channels(decoded.pixels[index]);
    const difference = Math.max(
      Math.abs(left.r - right.r), Math.abs(left.g - right.g),
      Math.abs(left.b - right.b), Math.abs(left.a - right.a)
    );
    if (difference > 0) differentPixels += 1;
    maximumDifference = Math.max(maximumDifference, difference);
  }
  return {
    expectedWidth: expected.width,
    expectedHeight: expected.height,
    differentPixels,
    maximumDifference,
    expectedHash: sha256Hex(canonicalRasterToRgbaBytes(expected)),
    decodedHash: sha256Hex(canonicalRasterToRgbaBytes(decoded)),
    result: differentPixels === 0 ? 'passed' : 'failed'
  };
}

export function createPixelDiff(expected: CanonicalRaster, decoded: CanonicalRaster): CanonicalRaster {
  if (expected.width !== decoded.width || expected.height !== decoded.height) {
    throw new Error('Cannot create a pixel diff for different dimensions.');
  }
  return createCanonicalRaster(expected.width, expected.height, expected.pixels.map((pixel, index) => {
    const left = channels(pixel);
    const right = channels(decoded.pixels[index]);
    const difference = Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g), Math.abs(left.b - right.b), Math.abs(left.a - right.a));
    return difference === 0 ? rgba(0, 0, 0, 255) : rgba(255, 0, Math.min(255, difference * 2), 255);
  }));
}

export function encodeRasterPng(raster: CanonicalRaster): Uint8Array {
  const rgbaBytes = canonicalRasterToRgbaBytes(raster);
  const scanlines = new Uint8Array(raster.height * (1 + raster.width * 4));
  for (let y = 0; y < raster.height; y += 1) {
    const destination = y * (1 + raster.width * 4);
    scanlines[destination] = 0;
    scanlines.set(rgbaBytes.subarray(y * raster.width * 4, (y + 1) * raster.width * 4), destination + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, raster.width);
  view.setUint32(4, raster.height);
  header.set([8, 6, 0, 0, 0], 8);
  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlibSync(scanlines, { level: 9 })),
    pngChunk('IEND', new Uint8Array())
  ]);
}

function artifact(kind: CodegenArtifact['kind'], path: string, mediaType: string, content: string | Uint8Array): CodegenArtifact {
  return createCodegenArtifact(kind, path, mediaType, content);
}

function zipArtifacts(artifacts: readonly CodegenArtifact[]): Uint8Array {
  const files: Zippable = {};
  for (const item of artifacts) files[item.path] = item.content instanceof Uint8Array ? item.content : strToU8(item.content);
  return zipSync(files, { level: 9, mtime: new Date('1980-01-01T00:00:00.000Z') });
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

function sortedRecord(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = strToU8(type);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat([typeBytes, data])));
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

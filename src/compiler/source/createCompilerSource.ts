import type { LcdBitmapProject } from '../../domain/project';
import { canonicalSerializeValue } from '../serialization/canonicalSerializeIr';
import { fingerprintIr } from '../serialization/fingerprintIr';
import type { CompilerSourceInput, CompilerSourceSnapshot } from './compilerSource';

export function createCompilerSourceSnapshot(input: CompilerSourceInput): CompilerSourceSnapshot {
  const snapshot: Omit<CompilerSourceSnapshot, 'sourceFingerprint'> = deepFreeze({
    project: clone(input.project),
    fontGlyphs: input.fontGlyphs ? clone(input.fontGlyphs) : undefined,
    loadedFonts: input.loadedFonts ? clone(input.loadedFonts) : undefined,
    savedMeasurements: input.savedMeasurements ? clone(input.savedMeasurements) : undefined,
    requestedLocales: input.requestedLocales ? [...input.requestedLocales] : undefined
  });
  return {
    ...snapshot,
    sourceFingerprint: fingerprintIr(sourceFingerprintPayload(snapshot))
  };
}

function sourceFingerprintPayload(snapshot: Omit<CompilerSourceSnapshot, 'sourceFingerprint'>): unknown {
  return {
    project: stripProjectEphemera(snapshot.project),
    fontGlyphs: snapshot.fontGlyphs,
    loadedFonts: snapshot.loadedFonts,
    savedMeasurements: snapshot.savedMeasurements,
    requestedLocales: snapshot.requestedLocales
  };
}

function stripProjectEphemera(project: Readonly<LcdBitmapProject>): unknown {
  return {
    ...project,
    validation: {
      ...project.validation,
      validatedAt: null
    }
  };
}

function clone<T>(value: T): T {
  return JSON.parse(canonicalSerializeValue(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return value;
}

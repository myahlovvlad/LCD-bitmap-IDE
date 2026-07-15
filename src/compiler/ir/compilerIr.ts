import type { CompilerDiagnostic } from '../validation/compilerDiagnostics';
import type { NormalizedFsmIr } from './fsmIr';
import type { NormalizedLocalizationIr, NormalizedResourceIr } from './localizationIr';
import type { NormalizedScreenIr } from './screenIr';
import type { CompilerSymbolTable } from './symbolTable';
import type { CompilerTraceabilityMap } from './traceability';
import type { CompilerIrVersion } from './version';

export interface NormalizedDisplayIr {
  readonly width: number;
  readonly height: number;
  readonly colorMode: 'monochrome';
  readonly packing: 'vertical-lsb';
  readonly byteLength: number;
}

export interface NormalizedCompilerIrV1 {
  readonly irVersion: CompilerIrVersion;
  readonly source: {
    readonly projectId: string;
    readonly projectName: string;
    readonly projectVersion: string;
    readonly projectSchemaVersion: number;
    readonly sourceFingerprint?: string;
  };
  readonly display: NormalizedDisplayIr;
  readonly fsm: NormalizedFsmIr;
  readonly screens: readonly NormalizedScreenIr[];
  readonly localization: NormalizedLocalizationIr;
  readonly resources: NormalizedResourceIr;
  readonly symbols: CompilerSymbolTable;
  readonly traceability: CompilerTraceabilityMap;
}

export interface CompilerCompletenessReport {
  readonly stateCount: number;
  readonly eventCount: number;
  readonly transitionCount: number;
  readonly screenCount: number;
  readonly canvasObjectCount: number;
  readonly localizedTextCount: number;
  readonly fontGlyphCount: number;
  readonly diagnosticCount: number;
}

export interface NormalizedCompilerIrResult {
  readonly ir: NormalizedCompilerIrV1;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly completeness: CompilerCompletenessReport;
  readonly canonicalJson: string;
  readonly fingerprint: string;
}

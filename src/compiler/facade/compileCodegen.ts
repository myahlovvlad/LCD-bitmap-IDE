import type { FontGlyphs, LanguageCode, LcdBitmapProject } from '../../domain';
import type { CodegenArtifactSet } from '../artifacts/codegenArtifacts';
import { legacyCBackend } from '../backends/legacyCBackend';
import type { CodegenRequest } from '../backends/codegenBackend';
import { lowerToTargetIr } from '../lowering/lowerToTargetIr';
import { normalizeProject } from '../normalization/normalizeProject';
import { LEGACY_LCD_TARGET_PROFILE } from '../profiles/legacyTargetProfile';
import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { createCompilerSourceSnapshot } from '../source/createCompilerSource';
import type { CompilerDiagnostic } from '../validation/compilerDiagnostics';

export interface CompileLegacyCodegenInput {
  readonly project: LcdBitmapProject;
  readonly language: LanguageCode;
  readonly fontGlyphs?: FontGlyphs;
  readonly request: Omit<CodegenRequest, 'language'>;
}

export interface CompileLegacyCodegenResult {
  readonly artifacts: CodegenArtifactSet;
  readonly source: CompilerSourceSnapshot;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly fingerprint: string;
}

export function compileLegacyCodegen(input: CompileLegacyCodegenInput): CompileLegacyCodegenResult {
  const source = createCompilerSourceSnapshot({
    project: input.project,
    fontGlyphs: input.fontGlyphs,
    requestedLocales: [input.language]
  });
  return compileLegacyCodegenFromSource(source, input.language, input.request);
}

export function compileLegacyCodegenFromSource(
  source: CompilerSourceSnapshot,
  language: LanguageCode,
  request: Omit<CodegenRequest, 'language'>
): CompileLegacyCodegenResult {
  const normalized = normalizeProject(source);
  const targetIr = lowerToTargetIr(normalized.ir, {
    language,
    targetProfile: LEGACY_LCD_TARGET_PROFILE,
    fontGlyphs: source.fontGlyphs
  });
  const artifacts = legacyCBackend.generate(targetIr, { ...request, language });
  return {
    artifacts,
    source,
    diagnostics: normalized.diagnostics,
    fingerprint: normalized.fingerprint
  };
}

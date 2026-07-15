import { compileLegacyCodegen } from '../compiler';
import type { CodegenArtifact } from '../compiler';
import type { LanguageCode } from '../domain';
import type { ApplicationWorkspace } from './workspace';

export interface ApplicationCodegenOptions {
  readonly language: LanguageCode;
}

export function generateSelectedScreenCHeader(
  workspace: ApplicationWorkspace,
  screenId: string,
  options: ApplicationCodegenOptions
): string {
  return requireArtifactContent(
    compileLegacyCodegen({
      project: workspace.project,
      fontGlyphs: workspace.fontGlyphs,
      language: options.language,
      request: {
        scope: 'selected-screen',
        selectedScreenId: screenId,
        selectedSymbolName: `${screenId}_screen`
      }
    }).artifacts.artifacts,
    'c-header'
  );
}

export function generateSelectedScreenBinary(
  workspace: ApplicationWorkspace,
  screenId: string,
  options: ApplicationCodegenOptions
): Uint8Array {
  return requireArtifactContent(
    compileLegacyCodegen({
      project: workspace.project,
      fontGlyphs: workspace.fontGlyphs,
      language: options.language,
      request: {
        scope: 'selected-screen',
        selectedScreenId: screenId,
        selectedSymbolName: `${screenId}_screen`
      }
    }).artifacts.artifacts,
    'binary'
  );
}

export function generateAllScreensCHeader(
  workspace: ApplicationWorkspace,
  options: ApplicationCodegenOptions
): string {
  return requireArtifactContent(
    compileLegacyCodegen({
      project: workspace.project,
      fontGlyphs: workspace.fontGlyphs,
      language: options.language,
      request: {
        scope: 'all-screens',
        projectSymbolName: workspace.project.meta.id
      }
    }).artifacts.artifacts,
    'c-header'
  );
}

export function generateAllScreensBinary(
  workspace: ApplicationWorkspace,
  options: ApplicationCodegenOptions
): Uint8Array {
  return requireArtifactContent(
    compileLegacyCodegen({
      project: workspace.project,
      fontGlyphs: workspace.fontGlyphs,
      language: options.language,
      request: {
        scope: 'all-screens',
        projectSymbolName: workspace.project.meta.id
      }
    }).artifacts.artifacts,
    'binary'
  );
}

function requireArtifactContent<T extends string | Uint8Array>(
  artifacts: readonly CodegenArtifact[],
  kind: CodegenArtifact['kind']
): T {
  const artifact = artifacts.find((item) => item.kind === kind);
  if (!artifact) {
    throw new Error(`Codegen artifact is missing: ${kind}`);
  }
  return artifact.content as T;
}

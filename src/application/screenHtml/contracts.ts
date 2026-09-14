import type { ActorIdentity } from '../commandTypes';
import type { ScreenDslDiagnostic, ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslPreviewResult } from '../screenDsl/contracts';

export interface CreateScreenHtmlPreviewRequest {
  html: string;
  importMode: ScreenDslImportMode;
  expectedRevision: number;
  targetScreenId?: string;
  actor?: ActorIdentity;
}

export interface ScreenHtmlPreviewResult {
  success: boolean;
  canonicalHtml: string | null;
  screenDslSource: string | null;
  screenDslPreview: ScreenDslPreviewResult | null;
  diagnostics: readonly ScreenDslDiagnostic[];
}

import type { ScreenDslDiagnostic, ScreenDslDocumentV1 } from '../screen-dsl';

export const SCREEN_HTML_FORMAT = 'lcd-bitmap-ide/html' as const;
export const SCREEN_HTML_VERSION = 1 as const;
export const MAX_SCREEN_HTML_BYTES = 512 * 1024;

export interface ScreenHtmlParseResult {
  screenId: string | null;
  document: ScreenDslDocumentV1 | null;
  diagnostics: readonly ScreenDslDiagnostic[];
}

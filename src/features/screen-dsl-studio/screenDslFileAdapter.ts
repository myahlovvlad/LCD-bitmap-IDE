/**
 * Screen DSL file adapter interface and production implementation.
 *
 * Decouples ScreenDslStudio from the concrete file mechanism:
 * - Production: delegates to window.spectroDesigner.screenDslFiles (Electron preload)
 * - Browser tests: in-memory adapter (see tests/e2e/screenDslInMemoryFileAdapter.ts)
 *
 * The Studio component receives an adapter instance via prop — it never
 * imports window.spectroDesigner directly, ensuring the session/application
 * layers remain Electron-independent and testable.
 */

import type {
  OpenScreenDslFileResult,
  SaveScreenDslFileRequest,
  SaveScreenDslFileResult
} from '../../shared/screenDslFiles/contracts';

export interface ScreenDslFileAdapter {
  open(): Promise<OpenScreenDslFileResult>;
  save(request: SaveScreenDslFileRequest): Promise<SaveScreenDslFileResult>;
}

/**
 * Production adapter — delegates to the narrow preload API.
 * Only instantiated in the renderer when running in Electron.
 * Returns { cancelled: true } gracefully when preload API is unavailable (browser dev mode).
 */
export class ElectronScreenDslFileAdapter implements ScreenDslFileAdapter {
  async open(): Promise<OpenScreenDslFileResult> {
    const api = typeof window === 'undefined' ? undefined : window.spectroDesigner?.screenDslFiles;
    if (!api) {
      return {
        cancelled: false,
        diagnostics: [{
          code: 'SCREEN_DSL_FILE_INTERNAL_ERROR',
          severity: 'error',
          message: 'File operations are only available in the Electron desktop application.'
        }]
      };
    }
    return api.open();
  }

  async save(request: SaveScreenDslFileRequest): Promise<SaveScreenDslFileResult> {
    const api = typeof window === 'undefined' ? undefined : window.spectroDesigner?.screenDslFiles;
    if (!api) {
      return {
        cancelled: false,
        diagnostics: [{
          code: 'SCREEN_DSL_FILE_INTERNAL_ERROR',
          severity: 'error',
          message: 'File operations are only available in the Electron desktop application.'
        }]
      };
    }
    return api.save(request);
  }
}

/** Shared production adapter singleton. */
export const electronFileAdapter: ScreenDslFileAdapter = new ElectronScreenDslFileAdapter();

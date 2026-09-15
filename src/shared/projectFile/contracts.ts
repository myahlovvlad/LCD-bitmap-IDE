/**
 * Shared typed contracts for native project (.lcdproj) file operations.
 * Used by: main process, preload (via IPC), Tauri bridge, renderer.
 * Must NOT import Electron, Node.js fs/path, React, Zustand, or ProjectSession.
 */

export interface ProjectFileDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface OpenProjectFileResult {
  readonly cancelled: boolean;
  readonly filename?: string;
  readonly content?: string;
  readonly byteLength?: number;
  readonly diagnostics?: readonly ProjectFileDiagnostic[];
}

export interface SaveProjectFileRequest {
  readonly suggestedFilename: string;
  readonly content: string;
  /** Force a "Save As" dialog even when a known file path is already tracked. */
  readonly forceDialog?: boolean;
}

export interface SaveProjectFileResult {
  readonly cancelled: boolean;
  readonly filename?: string;
  readonly byteLength?: number;
  /** True when written directly to a previously-opened/saved path without a dialog. */
  readonly savedToKnownPath?: boolean;
  readonly diagnostics?: readonly ProjectFileDiagnostic[];
}

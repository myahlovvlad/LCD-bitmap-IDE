/**
 * Shared typed contracts for Screen DSL file operations.
 * Used by: main process, preload (via IPC), renderer adapter.
 * Must NOT import Electron, Node.js fs/path, React, Zustand, or ProjectSession.
 */

export type ScreenDslFileFormat = 'yaml' | 'json';

export type ScreenDslFileOperation = 'canonical-export' | 'draft-save';

export interface ScreenDslFileDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly filename?: string;
}

export interface OpenScreenDslFileResult {
  readonly cancelled: boolean;
  readonly format?: ScreenDslFileFormat;
  readonly filename?: string;
  readonly content?: string;
  readonly byteLength?: number;
  readonly diagnostics?: readonly ScreenDslFileDiagnostic[];
}

export interface SaveScreenDslFileRequest {
  readonly format: ScreenDslFileFormat;
  readonly operation: ScreenDslFileOperation;
  readonly suggestedFilename: string;
  readonly content: string;
}

export interface SaveScreenDslFileResult {
  readonly cancelled: boolean;
  readonly filename?: string;
  readonly byteLength?: number;
  readonly diagnostics?: readonly ScreenDslFileDiagnostic[];
}

export type ScreenDslFileUIState =
  | 'idle'
  | 'opening'
  | 'replacing'
  | 'exporting'
  | 'cancelled'
  | 'failed'
  | 'completed';

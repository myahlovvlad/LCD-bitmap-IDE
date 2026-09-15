/// <reference types="vite/client" />

declare global {
  const __APP_SOFTWARE_VERSION__: string | undefined;
}

import type {
  SpectroSerialCommandRequest,
  SpectroSerialCommandResult,
  SpectroSerialPortInfo,
  SpectroSerialStatus
} from '../shared/spectrophotometerSerial/contracts';

declare global {
  interface Window {
    spectroDesigner?: {
      platform: NodeJS.Platform;
      clipboardWrite?: (text: string) => Promise<boolean>;
      automationStatus?: () => Promise<{
        rest: { running: boolean; endpoint: string };
        mcp: { running: boolean; endpoint: string; healthEndpoint: string; protocolVersion: string };
        authConfigured: boolean;
      }>;
      manualExportPdf?: (html: string, filename: string) => Promise<boolean>;
      ipcSend?: (channel: string, payload: unknown) => void;
      onMutateRequest?: (handler: (requestId: string, action: string, payload: unknown) => void) => void;
      onStartupProject?: (handler: (payload: { filename: string; content: string }) => void) => void;
      screenDslFiles?: {
        open(): Promise<{
          cancelled: boolean;
          format?: 'yaml' | 'json';
          filename?: string;
          content?: string;
          byteLength?: number;
          diagnostics?: ReadonlyArray<{ code: string; severity: 'error' | 'warning' | 'info'; message: string; filename?: string }>;
        }>;
        save(request: {
          format: 'yaml' | 'json';
          operation: 'canonical-export' | 'draft-save';
          suggestedFilename: string;
          content: string;
        }): Promise<{
          cancelled: boolean;
          filename?: string;
          byteLength?: number;
          diagnostics?: ReadonlyArray<{ code: string; severity: 'error' | 'warning' | 'info'; message: string; filename?: string }>;
        }>;
      };
      projectFile?: {
        open(): Promise<{
          cancelled: boolean;
          filename?: string;
          content?: string;
          byteLength?: number;
          diagnostics?: ReadonlyArray<{ code: string; severity: 'error' | 'warning'; message: string }>;
        }>;
        save(request: {
          suggestedFilename: string;
          content: string;
          forceDialog?: boolean;
        }): Promise<{
          cancelled: boolean;
          filename?: string;
          byteLength?: number;
          savedToKnownPath?: boolean;
          diagnostics?: ReadonlyArray<{ code: string; severity: 'error' | 'warning'; message: string }>;
        }>;
        resetPath(): Promise<boolean>;
      };
      spectrophotometerSerial?: {
        list(): Promise<SpectroSerialPortInfo[]>;
        open(path: string): Promise<SpectroSerialStatus>;
        close(): Promise<SpectroSerialStatus>;
        status(): Promise<SpectroSerialStatus>;
        command(request: SpectroSerialCommandRequest): Promise<SpectroSerialCommandResult>;
      };
    };
  }
}

export {};

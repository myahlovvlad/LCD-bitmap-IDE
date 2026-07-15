/// <reference types="vite/client" />

interface Window {
  spectroDesigner?: {
    platform: NodeJS.Platform;
    clipboardWrite?: (text: string) => Promise<boolean>;
    manualExportPdf?: (html: string, filename: string) => Promise<boolean>;
    ipcSend?: (channel: string, payload: unknown) => void;
    onMutateRequest?: (handler: (requestId: string, action: string, payload: unknown) => void) => void;
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
  };
}

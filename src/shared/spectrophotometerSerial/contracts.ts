export interface SpectroSerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export interface SpectroSerialStatus {
  open: boolean;
  protocolConnected: boolean;
  path?: string;
  lastError?: string;
}

export interface SpectroSerialCommandRequest {
  commandId: string;
  argument?: string | number;
}

export interface SpectroSerialCommandResult {
  command: string;
  raw: string;
  parsed: unknown;
  durationMs: number;
}

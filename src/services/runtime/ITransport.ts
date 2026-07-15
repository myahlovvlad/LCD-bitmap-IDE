export type TransportResult =
  | { ok: true; response: string }
  | { ok: false; error: string; retriable: boolean };

export interface ITransport {
  sendCommand(command: string): Promise<TransportResult>;
  isConnected(): boolean;
  readonly kind: 'simulation' | 'serial' | 'mock';
}

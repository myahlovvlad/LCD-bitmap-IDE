import { SerialPort } from 'serialport';
import {
  buildEcrosCommand,
  ECROS_CLI_COMMANDS,
  parseEcrosResponse
} from '../../spectrophotometer/ecrosCli.js';
import type {
  SpectroSerialCommandRequest,
  SpectroSerialCommandResult,
  SpectroSerialPortInfo,
  SpectroSerialStatus
} from '../../shared/spectrophotometerSerial/contracts.js';

interface PendingResponse {
  commandId: string;
  command: string;
  responseKind: (typeof ECROS_CLI_COMMANDS)[number]['response'];
  expectedLines?: number;
  raw: string;
  startedAt: number;
  resolve: (result: SpectroSerialCommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  quietTimer?: ReturnType<typeof setTimeout>;
}

const QUIET_RESPONSE_MS = 120;
const DEFAULT_TIMEOUT_MS = 5_000;
const LONG_TIMEOUT_COMMANDS = new Set(['rezero', 'resetdark', 'boot']);

export class EcrosSerialService {
  private port: SerialPort | null = null;
  private portPath: string | undefined;
  private protocolConnected = false;
  private lastError: string | undefined;
  private pending: PendingResponse | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async listPorts(): Promise<SpectroSerialPortInfo[]> {
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId
    }));
  }

  async open(path: string): Promise<SpectroSerialStatus> {
    if (this.port?.isOpen && this.portPath === path) {
      return this.status();
    }
    await this.close();
    const allowed = (await this.listPorts()).some((port) => port.path === path);
    if (!allowed) {
      throw new Error(`Serial port "${path}" is not available.`);
    }
    const port = new SerialPort({
      path,
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      rtscts: false,
      xon: false,
      xoff: false,
      autoOpen: false
    });
    port.on('data', (chunk: Buffer) => this.handleData(chunk));
    port.on('error', (error) => {
      this.lastError = error.message;
      this.rejectPending(error);
    });
    port.on('close', () => {
      this.protocolConnected = false;
      this.rejectPending(new Error('Serial port closed while waiting for a response.'));
    });
    await new Promise<void>((resolve, reject) => port.open((error) => error ? reject(error) : resolve()));
    this.port = port;
    this.portPath = path;
    this.lastError = undefined;
    return this.status();
  }

  async close(): Promise<SpectroSerialStatus> {
    const port = this.port;
    this.rejectPending(new Error('Serial connection closed.'));
    this.port = null;
    this.portPath = undefined;
    this.protocolConnected = false;
    if (port?.isOpen) {
      await new Promise<void>((resolve) => port.close(() => resolve()));
    }
    return this.status();
  }

  status(): SpectroSerialStatus {
    return {
      open: Boolean(this.port?.isOpen),
      protocolConnected: this.protocolConnected,
      path: this.portPath,
      lastError: this.lastError
    };
  }

  send(request: SpectroSerialCommandRequest): Promise<SpectroSerialCommandResult> {
    const run = this.queue.then(() => this.execute(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async execute(request: SpectroSerialCommandRequest): Promise<SpectroSerialCommandResult> {
    const port = this.port;
    if (!port?.isOpen) {
      throw new Error('Open a serial port before sending an ECROS command.');
    }
    const contract = ECROS_CLI_COMMANDS.find((item) => item.id === request.commandId);
    if (!contract) {
      throw new Error(`Unknown ECROS command "${request.commandId}".`);
    }
    if (contract.requiresConnection && !this.protocolConnected) {
      throw new Error(`Send "connect" successfully before "${request.commandId}".`);
    }
    const command = buildEcrosCommand(request.commandId, request.argument);
    const timeoutMs = LONG_TIMEOUT_COMMANDS.has(request.commandId) ? 30_000 : DEFAULT_TIMEOUT_MS;

    const result = await new Promise<SpectroSerialCommandResult>((resolve, reject) => {
      const pending: PendingResponse = {
        commandId: request.commandId,
        command,
        responseKind: contract.response,
        expectedLines: contract.expectedLines
          ?? (request.commandId === 'ge' ? Number(request.argument) : undefined),
        raw: '',
        startedAt: Date.now(),
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.rejectPending(new Error(`ECROS command "${request.commandId}" timed out after ${timeoutMs} ms.`));
        }, timeoutMs)
      };
      this.pending = pending;
      port.write(Buffer.from(`${command}\r`, 'latin1'), (error) => {
        if (error) {
          this.rejectPending(error);
          return;
        }
        port.drain((drainError) => {
          if (drainError) {
            this.rejectPending(drainError);
            return;
          }
          if (contract.response === 'none') {
            pending.quietTimer = setTimeout(() => this.finishPending(), QUIET_RESPONSE_MS);
          }
        });
      });
    });

    if (request.commandId === 'connect') {
      this.protocolConnected = true;
    } else if (request.commandId === 'quit') {
      this.protocolConnected = false;
    }
    return result;
  }

  private handleData(chunk: Buffer): void {
    const pending = this.pending;
    if (!pending) return;
    pending.raw += chunk.toString('latin1');
    if (pending.quietTimer) clearTimeout(pending.quietTimer);

    const lineCount = countResponseLines(pending.raw);
    const canFinishImmediately =
      pending.responseKind === 'ok'
      || pending.responseKind === 'integer'
      || pending.responseKind === 'rezero'
      || (
        pending.responseKind === 'integer-list'
        && pending.expectedLines !== undefined
        && lineCount >= pending.expectedLines
      );

    if (canFinishImmediately) {
      try {
        parseEcrosResponse(pending.commandId, pending.raw);
        this.finishPending();
        return;
      } catch {
        // Incomplete fixed-size responses remain pending for the next chunk.
      }
    }
    pending.quietTimer = setTimeout(() => this.finishPending(), QUIET_RESPONSE_MS);
  }

  private finishPending(): void {
    const pending = this.pending;
    if (!pending) return;
    try {
      const parsed = parseEcrosResponse(pending.commandId, pending.raw);
      clearTimeout(pending.timeout);
      if (pending.quietTimer) clearTimeout(pending.quietTimer);
      this.pending = null;
      pending.resolve({
        command: pending.command,
        raw: pending.raw,
        parsed,
        durationMs: Date.now() - pending.startedAt
      });
    } catch (error) {
      this.rejectPending(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private rejectPending(error: Error): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timeout);
    if (pending.quietTimer) clearTimeout(pending.quietTimer);
    this.pending = null;
    this.lastError = error.message;
    pending.reject(error);
  }
}

function countResponseLines(raw: string): number {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('>'))
    .length;
}

import type { CliCommandDefinition } from '../../domain/procedure';
import type { ITransport, TransportResult } from './ITransport';

const DEFAULT_COMMAND_DURATION_MS = 50;

export interface SimulationTransportOptions {
  /** Scale factor applied to all observed timings. Default 1.0 (real-time). Use 0 to skip delays. */
  timeScale?: number;
  /** Commands that should return a failure response. Useful for testing error paths. */
  failCommands?: Set<string>;
}

export class SimulationTransport implements ITransport {
  readonly kind = 'simulation' as const;

  private readonly catalog: Map<string, CliCommandDefinition>;
  private readonly timeScale: number;
  private readonly failCommands: Set<string>;
  private _connected = true;

  constructor(
    catalog: Record<string, CliCommandDefinition> | CliCommandDefinition[] = {},
    options: SimulationTransportOptions = {}
  ) {
    const entries = Array.isArray(catalog)
      ? catalog
      : Object.values(catalog);
    this.catalog = new Map(entries.map((def) => [def.command, def]));
    this.timeScale = options.timeScale ?? 1;
    this.failCommands = options.failCommands ?? new Set();
  }

  isConnected(): boolean {
    return this._connected;
  }

  disconnect(): void {
    this._connected = false;
  }

  async sendCommand(command: string): Promise<TransportResult> {
    if (!this._connected) {
      return { ok: false, error: 'Transport is disconnected.', retriable: false };
    }

    if (this.failCommands.has(command)) {
      return { ok: false, error: `Simulated failure for command "${command}".`, retriable: false };
    }

    const durationMs = this.resolveCommandDuration(command);
    if (durationMs > 0) {
      await this.simulatedDelay(durationMs);
    }

    return { ok: true, response: 'ok.' };
  }

  private resolveCommandDuration(command: string): number {
    const def = this.catalog.get(command);
    const baseDuration = def?.expectedDurationMs ?? DEFAULT_COMMAND_DURATION_MS;
    return Math.round(baseDuration * this.timeScale);
  }

  private simulatedDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Zero-delay simulation for unit tests. */
export function createInstantSimulation(
  catalog: Record<string, CliCommandDefinition> = {},
  failCommands: string[] = []
): SimulationTransport {
  return new SimulationTransport(catalog, {
    timeScale: 0,
    failCommands: new Set(failCommands)
  });
}

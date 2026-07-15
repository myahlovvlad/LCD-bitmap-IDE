import type { FsmTransitionMechanism } from '../domain';

export const FSM_INTERCHANGE_VERSION = 1 as const;
export type FsmInterchangeVersion = typeof FSM_INTERCHANGE_VERSION;

export interface FsmInterchangeModelV1 {
  readonly version: FsmInterchangeVersion;
  readonly machine: {
    readonly projectId: string;
    readonly name?: string;
  };
  readonly states: readonly FsmInterchangeState[];
  readonly events: readonly FsmInterchangeEvent[];
  readonly transitions: readonly FsmInterchangeTransition[];
  readonly layout: readonly FsmInterchangeLayoutEntry[];
}

export interface FsmInterchangeState {
  readonly id: string;
  readonly title: string;
  readonly stateType: string;
  readonly initial: boolean;
  readonly terminal: boolean;
  readonly subsystem: string;
  readonly origin: string;
  readonly screenId: string | null;
  readonly runtimeId: string | null;
  readonly legacyIds: readonly string[];
  readonly order: number;
}

export interface FsmInterchangeEvent {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly legacyTrigger?: string;
  readonly order: number;
}

export interface FsmInterchangeTransition {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly eventId: string;
  readonly mechanism?: FsmTransitionMechanism;
  readonly buttonId?: string | null;
  readonly timerMs?: number | null;
  readonly fact?: string | null;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly kind: string;
  readonly condition: string | null;
  readonly source: string | null;
  readonly backendProcessId: string | null;
  readonly order: number;
}

export interface FsmInterchangeLayoutEntry {
  readonly stateId: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly order: number;
}

export type FsmScriptFormat = 'mermaid' | 'python';

export interface FsmParseDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export interface FsmSourceMapEntry {
  readonly entityType: 'state' | 'event' | 'transition' | 'layout' | 'machine';
  readonly entityId: string;
  readonly line: number;
  readonly column: number;
}

export interface FsmParseResult {
  readonly ok: boolean;
  readonly model?: FsmInterchangeModelV1;
  readonly diagnostics: readonly FsmParseDiagnostic[];
  readonly sourceMap: readonly FsmSourceMapEntry[];
}

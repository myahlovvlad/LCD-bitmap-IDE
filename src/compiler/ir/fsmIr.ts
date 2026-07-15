import type { TransitionBehaviorV1 } from '../../fsm-behavior';

export interface NormalizedFsmEventIr {
  readonly id: string;
  readonly order: number;
  readonly name: string;
  readonly description?: string;
  readonly legacyTrigger?: string;
  readonly symbol: string;
  readonly sourcePath: string;
}

export interface NormalizedFsmStateIr {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly subsystem: string;
  readonly stateType: string;
  readonly origin: string;
  readonly screenId: string | null;
  readonly initial: boolean;
  readonly terminal: boolean;
  readonly graphPosition?: {
    readonly x: number;
    readonly y: number;
    readonly width?: number;
    readonly height?: number;
  };
  readonly symbol: string;
  readonly sourcePath: string;
}

export interface NormalizedFsmTransitionIr {
  readonly id: string;
  readonly order: number;
  readonly fromStateId: string;
  readonly toStateId: string;
  readonly trigger: {
    readonly eventId: string;
    readonly mechanism: string;
    readonly buttonId?: string | null;
    readonly timerMs?: number | null;
    readonly fact?: string | null;
  };
  readonly kind: string;
  readonly condition: string | null;
  readonly backendProcessId: string | null;
  readonly behavior: TransitionBehaviorV1;
  readonly symbol: string;
  readonly sourcePath: string;
}

export interface NormalizedFsmIr {
  readonly states: readonly NormalizedFsmStateIr[];
  readonly events: readonly NormalizedFsmEventIr[];
  readonly transitions: readonly NormalizedFsmTransitionIr[];
  readonly initialStateIds: readonly string[];
  readonly terminalStateIds: readonly string[];
}

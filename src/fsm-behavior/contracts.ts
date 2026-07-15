export const FSM_BEHAVIOR_VERSION = 1 as const;

export const MAX_BEHAVIOR_STORAGE_LENGTH = 512 as const;
export const MAX_BEHAVIOR_EFFECTS = 8 as const;
export const MAX_BEHAVIOR_ARGUMENTS = 16 as const;
export const MAX_BEHAVIOR_STRING_LENGTH = 160 as const;
export const MAX_BEHAVIOR_ARRAY_LENGTH = 16 as const;
export const MAX_BEHAVIOR_DIAGNOSTICS = 8 as const;

export type BehaviorScalarValue = string | number | boolean | null;
export type BehaviorValue = BehaviorScalarValue | readonly BehaviorScalarValue[];
export type BehaviorArgs = Readonly<Record<string, BehaviorValue>>;

export interface GuardInvocationV1 {
  readonly version: typeof FSM_BEHAVIOR_VERSION;
  readonly contractId: string;
  readonly args: BehaviorArgs;
}

export interface EffectInvocationV1 {
  readonly version: typeof FSM_BEHAVIOR_VERSION;
  readonly contractId: string;
  readonly args: BehaviorArgs;
}

export interface TransitionBehaviorV1 {
  readonly version: typeof FSM_BEHAVIOR_VERSION;
  readonly guard: TransitionGuardBehavior;
  readonly backend: BackendBehaviorStorage;
  readonly effects: readonly EffectInvocationV1[];
}

export type TransitionGuardBehavior =
  | { readonly kind: 'empty' }
  | { readonly kind: 'typed'; readonly invocation: GuardInvocationV1; readonly canonical: string }
  | { readonly kind: 'opaque'; readonly source: string }
  | { readonly kind: 'invalid'; readonly source: string; readonly diagnostics: readonly BehaviorDiagnostic[] };

export type BackendBehaviorStorage =
  | { readonly kind: 'none' }
  | { readonly kind: 'legacy-backend-process'; readonly processId: string }
  | { readonly kind: 'typed-effects'; readonly effects: readonly EffectInvocationV1[]; readonly canonical: string }
  | { readonly kind: 'opaque'; readonly raw: string }
  | { readonly kind: 'invalid'; readonly raw: string; readonly diagnostics: readonly BehaviorDiagnostic[] };

export type BehaviorDiagnosticSeverity = 'error' | 'warning';

export interface BehaviorDiagnostic {
  readonly severity: BehaviorDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
}

export interface GuardEvaluationContext {
  readonly event: string;
  readonly button: string;
  readonly button_id: string;
  readonly status: string;
  readonly value: number;
  readonly timeout_ms: number;
}

export type GuardEvaluation = (invocation: GuardInvocationV1, context: GuardEvaluationContext) => boolean;

export interface GuardContractDefinition {
  readonly id: string;
  readonly version: typeof FSM_BEHAVIOR_VERSION;
  readonly description: string;
  readonly evaluate: GuardEvaluation;
}

export interface EffectContractDefinition {
  readonly id: string;
  readonly version: typeof FSM_BEHAVIOR_VERSION;
  readonly description: string;
}

export const CONTEXT_KEYS = ['event', 'button', 'button_id', 'status', 'value', 'timeout_ms'] as const;
export type GuardContextKey = typeof CONTEXT_KEYS[number];

export const COMPARISON_OPERATORS = ['==', '!=', '>', '<', '>=', '<='] as const;
export type ComparisonOperator = typeof COMPARISON_OPERATORS[number];

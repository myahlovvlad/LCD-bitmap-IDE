import {
  COMPARISON_OPERATORS,
  CONTEXT_KEYS,
  FSM_BEHAVIOR_VERSION,
  type BehaviorScalarValue,
  type EffectContractDefinition,
  type GuardContractDefinition,
  type GuardContextKey,
  type GuardInvocationV1
} from './contracts';

export const CORE_ALWAYS_GUARD = 'core.always';
export const CORE_NEVER_GUARD = 'core.never';
export const RUNTIME_CONTEXT_TRUTHY_GUARD = 'runtime.context.truthy';
export const RUNTIME_CONTEXT_COMPARE_GUARD = 'runtime.context.compare';
export const BACKEND_PROCESS_REQUEST_EFFECT = 'backend.process.request';

const guardContracts: Record<string, GuardContractDefinition> = {
  [CORE_ALWAYS_GUARD]: {
    id: CORE_ALWAYS_GUARD,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Always allows the transition.',
    evaluate: () => true
  },
  [CORE_NEVER_GUARD]: {
    id: CORE_NEVER_GUARD,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Never allows the transition.',
    evaluate: () => false
  },
  [RUNTIME_CONTEXT_TRUTHY_GUARD]: {
    id: RUNTIME_CONTEXT_TRUTHY_GUARD,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Checks whether a runtime context key is truthy.',
    evaluate: (invocation, context) => Boolean(context[readContextKey(invocation)])
  },
  [RUNTIME_CONTEXT_COMPARE_GUARD]: {
    id: RUNTIME_CONTEXT_COMPARE_GUARD,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Compares a runtime context key with a scalar value.',
    evaluate: (invocation, context) => {
      const key = readContextKey(invocation);
      const operator = String(invocation.args.operator);
      const expected = readScalar(invocation.args.value);
      const actual = context[key];
      if (operator === '==') return String(actual) === String(expected);
      if (operator === '!=') return String(actual) !== String(expected);
      const actualNumber = Number(actual);
      const expectedNumber = Number(expected);
      if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
        return false;
      }
      if (operator === '>') return actualNumber > expectedNumber;
      if (operator === '<') return actualNumber < expectedNumber;
      if (operator === '>=') return actualNumber >= expectedNumber;
      if (operator === '<=') return actualNumber <= expectedNumber;
      return false;
    }
  }
};

const effectContracts: Record<string, EffectContractDefinition> = {
  [BACKEND_PROCESS_REQUEST_EFFECT]: {
    id: BACKEND_PROCESS_REQUEST_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Requests an application backend process by ID.'
  }
};

export function getGuardContract(contractId: string): GuardContractDefinition | undefined {
  return guardContracts[contractId];
}

export function getEffectContract(contractId: string): EffectContractDefinition | undefined {
  return effectContracts[contractId];
}

export function listGuardContracts(): readonly GuardContractDefinition[] {
  return Object.values(guardContracts);
}

export function listEffectContracts(): readonly EffectContractDefinition[] {
  return Object.values(effectContracts);
}

export function isGuardContextKey(value: unknown): value is GuardContextKey {
  return typeof value === 'string' && (CONTEXT_KEYS as readonly string[]).includes(value);
}

export function isComparisonOperator(value: unknown): boolean {
  return typeof value === 'string' && (COMPARISON_OPERATORS as readonly string[]).includes(value);
}

function readContextKey(invocation: GuardInvocationV1): GuardContextKey {
  const key = invocation.args.key;
  return isGuardContextKey(key) ? key : 'event';
}

function readScalar(value: unknown): BehaviorScalarValue {
  return Array.isArray(value) ? null : isBehaviorScalarValue(value) ? value : null;
}

function isBehaviorScalarValue(value: unknown): value is BehaviorScalarValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

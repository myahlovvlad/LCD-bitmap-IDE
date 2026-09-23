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
export const RUNTIME_TAG_EQUALS_TAG_GUARD = 'runtime.tag.equals-tag';
export const BACKEND_PROCESS_REQUEST_EFFECT = 'backend.process.request';
export const RUNTIME_TAG_SET_EFFECT = 'runtime.tag.set';
export const RUNTIME_TAG_SET_FROM_INPUT_EFFECT = 'runtime.tag.set-from-input';
export const RUNTIME_TAG_INCREMENT_EFFECT = 'runtime.tag.increment';
export const RUNTIME_TAG_COPY_EFFECT = 'runtime.tag.copy';

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
  },
  [RUNTIME_TAG_EQUALS_TAG_GUARD]: {
    id: RUNTIME_TAG_EQUALS_TAG_GUARD,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Compares two runtime tag values for equality (e.g. a keypad-entered PIN against a stored, admin-editable PIN). Args: { tagId: string, compareTagId: string }.',
    evaluate: (invocation, context) => {
      const tagId = invocation.args.tagId;
      const compareTagId = invocation.args.compareTagId;
      if (typeof tagId !== 'string' || typeof compareTagId !== 'string') return false;
      const values = context.values ?? {};
      return String(values[tagId]) === String(values[compareTagId]);
    }
  }
};

const effectContracts: Record<string, EffectContractDefinition> = {
  [BACKEND_PROCESS_REQUEST_EFFECT]: {
    id: BACKEND_PROCESS_REQUEST_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Requests an application backend process by ID.'
  },
  [RUNTIME_TAG_SET_EFFECT]: {
    id: RUNTIME_TAG_SET_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Writes a scalar value to a runtime tag as the transition commits. Args: { tagId: string, value: scalar }.'
  },
  [RUNTIME_TAG_SET_FROM_INPUT_EFFECT]: {
    id: RUNTIME_TAG_SET_FROM_INPUT_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Writes the current numeric input session value to a runtime tag as the transition commits (e.g. capturing a keypad-entered count). Args: { tagId: string }.'
  },
  [RUNTIME_TAG_INCREMENT_EFFECT]: {
    id: RUNTIME_TAG_INCREMENT_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Increments a numeric runtime tag by a fixed step (default 1) as the transition commits (e.g. counting failed PIN attempts). Args: { tagId: string, by?: number }.'
  },
  [RUNTIME_TAG_COPY_EFFECT]: {
    id: RUNTIME_TAG_COPY_EFFECT,
    version: FSM_BEHAVIOR_VERSION,
    description: 'Copies the current value of one runtime tag into another as the transition commits (e.g. stamping who performed an action). Args: { tagId: string, fromTagId: string }.'
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

import {
  FSM_BEHAVIOR_VERSION,
  MAX_BEHAVIOR_ARGUMENTS,
  MAX_BEHAVIOR_ARRAY_LENGTH,
  MAX_BEHAVIOR_STRING_LENGTH,
  type BehaviorArgs,
  type BehaviorDiagnostic,
  type BehaviorScalarValue,
  type BehaviorValue,
  type EffectInvocationV1,
  type GuardInvocationV1
} from './contracts';
import {
  CORE_ALWAYS_GUARD,
  CORE_NEVER_GUARD,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  RUNTIME_CONTEXT_TRUTHY_GUARD,
  getEffectContract,
  getGuardContract,
  isComparisonOperator,
  isGuardContextKey
} from './registry';

export function validateGuardInvocation(invocation: GuardInvocationV1): readonly BehaviorDiagnostic[] {
  const diagnostics = validateInvocationEnvelope(invocation, 'guard', Boolean(getGuardContract(invocation.contractId)));
  if (diagnostics.length > 0) {
    return diagnostics;
  }
  if (invocation.contractId === CORE_ALWAYS_GUARD || invocation.contractId === CORE_NEVER_GUARD) {
    return Object.keys(invocation.args).length === 0
      ? []
      : [error('fsm.behavior.guard.unexpected-args', `Guard "${invocation.contractId}" does not accept arguments.`)];
  }
  if (invocation.contractId === RUNTIME_CONTEXT_TRUTHY_GUARD) {
    return validateAllowedArgs(invocation.args, ['key'])
      .concat(isGuardContextKey(invocation.args.key) ? [] : [error('fsm.behavior.guard.invalid-key', 'Guard argument "key" must be a supported runtime context key.')]);
  }
  if (invocation.contractId === RUNTIME_CONTEXT_COMPARE_GUARD) {
    return validateAllowedArgs(invocation.args, ['key', 'operator', 'value'])
      .concat(isGuardContextKey(invocation.args.key) ? [] : [error('fsm.behavior.guard.invalid-key', 'Guard argument "key" must be a supported runtime context key.')])
      .concat(isComparisonOperator(invocation.args.operator) ? [] : [error('fsm.behavior.guard.invalid-operator', 'Guard argument "operator" must be one of ==, !=, >, <, >=, <=.')])
      .concat(isBehaviorScalarValue(invocation.args.value) ? [] : [error('fsm.behavior.guard.invalid-value', 'Guard argument "value" must be a scalar JSON-safe value.')]);
  }
  return [];
}

export function validateEffectInvocation(invocation: EffectInvocationV1): readonly BehaviorDiagnostic[] {
  const diagnostics = validateInvocationEnvelope(invocation, 'effect', Boolean(getEffectContract(invocation.contractId)));
  if (diagnostics.length > 0) {
    return diagnostics;
  }
  if (invocation.contractId === 'backend.process.request') {
    return validateAllowedArgs(invocation.args, ['processId'])
      .concat(typeof invocation.args.processId === 'string' && isSafeProcessId(invocation.args.processId)
        ? []
        : [error('fsm.behavior.effect.invalid-process', 'Effect argument "processId" must be a safe backend process ID string.')]);
  }
  return [];
}

export function validateBehaviorValue(value: BehaviorValue): readonly BehaviorDiagnostic[] {
  if (isBehaviorScalarValue(value)) {
    if (typeof value === 'string' && value.length > MAX_BEHAVIOR_STRING_LENGTH) {
      return [error('fsm.behavior.value.string-too-long', `Behavior strings may be at most ${MAX_BEHAVIOR_STRING_LENGTH} characters.`)];
    }
    return [];
  }
  if (!Array.isArray(value)) {
    return [error('fsm.behavior.value.unsupported', 'Behavior values must be scalar JSON-safe values or arrays of scalar values.')];
  }
  if (value.length > MAX_BEHAVIOR_ARRAY_LENGTH) {
    return [error('fsm.behavior.value.array-too-long', `Behavior arrays may contain at most ${MAX_BEHAVIOR_ARRAY_LENGTH} items.`)];
  }
  if (!value.every(isBehaviorScalarValue)) {
    return [error('fsm.behavior.value.unsupported-array', 'Behavior arrays may contain only scalar JSON-safe values.')];
  }
  const hasLongString = value.some((item) => typeof item === 'string' && item.length > MAX_BEHAVIOR_STRING_LENGTH);
  return hasLongString
    ? [error('fsm.behavior.value.string-too-long', `Behavior strings may be at most ${MAX_BEHAVIOR_STRING_LENGTH} characters.`)]
    : [];
}

export function isBehaviorScalarValue(value: unknown): value is BehaviorScalarValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function validateInvocationEnvelope(
  invocation: GuardInvocationV1 | EffectInvocationV1,
  kind: 'guard' | 'effect',
  contractExists: boolean
): BehaviorDiagnostic[] {
  const diagnostics: BehaviorDiagnostic[] = [];
  if (invocation.version !== FSM_BEHAVIOR_VERSION) {
    diagnostics.push(error(`fsm.behavior.${kind}.version`, `${kind} invocation must use behavior version ${FSM_BEHAVIOR_VERSION}.`));
  }
  if (!/^[A-Za-z][A-Za-z0-9.-]{0,127}$/.test(invocation.contractId)) {
    diagnostics.push(error(`fsm.behavior.${kind}.contract-id`, `${kind} contract ID is not safe.`));
  }
  if (!contractExists) {
    diagnostics.push(error(`fsm.behavior.${kind}.unknown-contract`, `Unknown ${kind} contract "${invocation.contractId}".`));
  }
  const entries = Object.entries(invocation.args);
  if (entries.length > MAX_BEHAVIOR_ARGUMENTS) {
    diagnostics.push(error(`fsm.behavior.${kind}.too-many-args`, `${kind} invocation supports at most ${MAX_BEHAVIOR_ARGUMENTS} arguments.`));
  }
  for (const [key, value] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)) {
      diagnostics.push(error(`fsm.behavior.${kind}.arg-key`, `Argument key "${key}" is not safe.`));
    }
    diagnostics.push(...validateBehaviorValue(value));
  }
  return diagnostics;
}

function validateAllowedArgs(args: BehaviorArgs, allowed: readonly string[]): BehaviorDiagnostic[] {
  const diagnostics: BehaviorDiagnostic[] = [];
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      diagnostics.push(error('fsm.behavior.args.unexpected', `Unexpected behavior argument "${key}".`));
    }
  }
  for (const key of allowed) {
    if (!(key in args)) {
      diagnostics.push(error('fsm.behavior.args.missing', `Missing behavior argument "${key}".`));
    }
  }
  return diagnostics;
}

export function error(code: string, message: string): BehaviorDiagnostic {
  return { severity: 'error', code, message };
}

function isSafeProcessId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value) && !['__proto__', 'constructor', 'prototype'].some((token) => value.includes(token));
}

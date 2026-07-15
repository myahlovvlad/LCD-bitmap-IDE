import type { FsmTransition } from '../domain/project';
import { parseBackendBehaviorStorage, parseGuardCondition } from './codec';
import { FSM_BEHAVIOR_VERSION, type EffectInvocationV1, type GuardEvaluationContext, type TransitionBehaviorV1 } from './contracts';
import { getGuardContract } from './registry';

export function describeTransitionBehavior(transition: FsmTransition): TransitionBehaviorV1 {
  const backend = parseBackendBehaviorStorage(transition.backendProcessId);
  return {
    version: FSM_BEHAVIOR_VERSION,
    guard: parseGuardCondition(transition.condition),
    backend,
    effects: backend.kind === 'typed-effects' ? backend.effects : []
  };
}

export function evaluateTypedGuard(condition: string | null, context: GuardEvaluationContext): { matched: boolean; behavior: ReturnType<typeof parseGuardCondition> } {
  const behavior = parseGuardCondition(condition);
  if (behavior.kind === 'empty') {
    return { matched: true, behavior };
  }
  if (behavior.kind === 'opaque') {
    const legacyContext: Record<string, string | number | boolean> = { ...context };
    return { matched: evaluateLegacyCondition(behavior.source, legacyContext), behavior };
  }
  if (behavior.kind === 'invalid') {
    return { matched: false, behavior };
  }
  const contract = getGuardContract(behavior.invocation.contractId);
  return { matched: Boolean(contract?.evaluate(behavior.invocation, context)), behavior };
}

export function effectsFromTransition(transition: Pick<FsmTransition, 'backendProcessId'>): readonly EffectInvocationV1[] {
  const backend = parseBackendBehaviorStorage(transition.backendProcessId);
  return backend.kind === 'typed-effects' ? backend.effects : [];
}

export function evaluateLegacyCondition(expression: string, context: Record<string, string | number | boolean>): boolean {
  const trimmed = expression.trim();
  if (!trimmed) {
    return true;
  }
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) {
    return Boolean(context[trimmed]);
  }
  const [, key, operator, rawExpected] = match;
  const actual = context[key];
  const expected = parseConditionValue(rawExpected);
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

function parseConditionValue(value: string): string | number | boolean {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : trimmed;
}

import {
  FSM_BEHAVIOR_VERSION,
  MAX_BEHAVIOR_EFFECTS,
  MAX_BEHAVIOR_STORAGE_LENGTH,
  type BackendBehaviorStorage,
  type BehaviorArgs,
  type BehaviorScalarValue,
  type BehaviorValue,
  type EffectInvocationV1,
  type GuardInvocationV1,
  type TransitionGuardBehavior
} from './contracts';
import { validateBehaviorValue, validateEffectInvocation, validateGuardInvocation, isBehaviorScalarValue, error } from './validation';

export const GUARD_CONDITION_PREFIX = '@lcdide.guard/v1';
export const EFFECTS_BACKEND_PREFIX = '@lcdide.effects/v1';
const EFFECTS_RESERVED_PREFIX = '@lcdide.effects/';

export function serializeGuardInvocation(invocation: GuardInvocationV1): string {
  const diagnostics = validateGuardInvocation(invocation);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map((diagnostic) => diagnostic.message).join(' '));
  }
  const args = Object.entries(invocation.args)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${encodeBehaviorValue(value)}`);
  return [GUARD_CONDITION_PREFIX, invocation.contractId, ...args].join(' ');
}

export function parseGuardCondition(condition: string | null | undefined): TransitionGuardBehavior {
  if (!condition) {
    return { kind: 'empty' };
  }
  if (condition.length > MAX_BEHAVIOR_STORAGE_LENGTH) {
    return { kind: 'invalid', source: condition, diagnostics: [error('fsm.behavior.guard.storage-too-long', `Guard storage exceeds ${MAX_BEHAVIOR_STORAGE_LENGTH} characters.`)] };
  }
  if (!condition.startsWith(GUARD_CONDITION_PREFIX)) {
    return { kind: 'opaque', source: condition };
  }
  const source = condition;
  const rest = condition.slice(GUARD_CONDITION_PREFIX.length).trim();
  if (!rest) {
    return { kind: 'invalid', source, diagnostics: [error('fsm.behavior.guard.missing-contract', 'Canonical guard condition is missing a contract ID.')] };
  }
  const [contractId, ...tokens] = splitTokens(rest);
  if (!contractId) {
    return { kind: 'invalid', source, diagnostics: [error('fsm.behavior.guard.missing-contract', 'Canonical guard condition is missing a contract ID.')] };
  }
  const args: Record<string, BehaviorValue> = {};
  for (const token of tokens) {
    const equalsIndex = token.indexOf('=');
    if (equalsIndex <= 0) {
      return { kind: 'invalid', source, diagnostics: [error('fsm.behavior.guard.arg-syntax', `Invalid canonical guard argument "${token}".`)] };
    }
    const key = token.slice(0, equalsIndex);
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      return { kind: 'invalid', source, diagnostics: [error('fsm.behavior.guard.duplicate-arg', `Duplicate canonical guard argument "${key}".`)] };
    }
    const rawValue = token.slice(equalsIndex + 1);
    const decoded = decodeBehaviorValue(rawValue);
    if (!decoded.ok) {
      return { kind: 'invalid', source, diagnostics: [decoded.diagnostic] };
    }
    args[key] = decoded.value;
  }
  const invocation: GuardInvocationV1 = { version: FSM_BEHAVIOR_VERSION, contractId, args };
  const diagnostics = validateGuardInvocation(invocation);
  if (diagnostics.length > 0) {
    return { kind: 'invalid', source, diagnostics };
  }
  return { kind: 'typed', invocation, canonical: serializeGuardInvocation(invocation) };
}

export function serializeEffectInvocations(effects: readonly EffectInvocationV1[]): string {
  const diagnostics = validateEffectInvocations(effects);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map((diagnostic) => diagnostic.message).join(' '));
  }
  const payload = canonicalSerializeValue(effects.map((effect) => ({
    version: effect.version,
    contractId: effect.contractId,
    args: effect.args
  })));
  const storage = `${EFFECTS_BACKEND_PREFIX} ${payload}`;
  if (storage.length > MAX_BEHAVIOR_STORAGE_LENGTH) {
    throw new Error(`Effect storage exceeds ${MAX_BEHAVIOR_STORAGE_LENGTH} characters.`);
  }
  return storage;
}

export function parseBackendBehaviorStorage(backendProcessId: string | null | undefined): BackendBehaviorStorage {
  if (!backendProcessId) {
    return { kind: 'none' };
  }
  if (backendProcessId.length > MAX_BEHAVIOR_STORAGE_LENGTH) {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.storage-too-long', `Backend behavior storage exceeds ${MAX_BEHAVIOR_STORAGE_LENGTH} characters.`)] };
  }
  if (!backendProcessId.startsWith(EFFECTS_RESERVED_PREFIX)) {
    return isSafeLegacyBackendProcessId(backendProcessId)
      ? { kind: 'legacy-backend-process', processId: backendProcessId }
      : { kind: 'opaque', raw: backendProcessId };
  }
  if (!backendProcessId.startsWith(EFFECTS_BACKEND_PREFIX)) {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.unsupported-version', 'Unsupported typed effect storage version.')] };
  }
  const payload = backendProcessId.slice(EFFECTS_BACKEND_PREFIX.length).trim();
  if (!payload) {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.missing-payload', 'Typed effect storage is missing a payload.')] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.invalid-json', 'Typed effect storage payload is not valid JSON.')] };
  }
  if (!Array.isArray(parsed)) {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.invalid-payload', 'Typed effect storage payload must be an array.')] };
  }
  if (parsed.length > MAX_BEHAVIOR_EFFECTS) {
    return { kind: 'invalid', raw: backendProcessId, diagnostics: [error('fsm.behavior.backend.too-many-effects', `Typed effect storage supports at most ${MAX_BEHAVIOR_EFFECTS} effects.`)] };
  }
  const effects: EffectInvocationV1[] = [];
  for (const item of parsed) {
    const effect = readEffectInvocation(item);
    if (!effect.ok) {
      return { kind: 'invalid', raw: backendProcessId, diagnostics: [effect.diagnostic] };
    }
    const diagnostics = validateEffectInvocation(effect.value);
    if (diagnostics.length > 0) {
      return { kind: 'invalid', raw: backendProcessId, diagnostics };
    }
    effects.push(effect.value);
  }
  return { kind: 'typed-effects', effects, canonical: serializeEffectInvocations(effects) };
}

export function encodeBehaviorValue(value: BehaviorValue): string {
  const diagnostics = validateBehaviorValue(value);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map((diagnostic) => diagnostic.message).join(' '));
  }
  if (Array.isArray(value)) {
    return `[${value.map(encodeBehaviorScalar).join(',')}]`;
  }
  return encodeBehaviorScalar(value as BehaviorScalarValue);
}

function encodeBehaviorScalar(value: BehaviorScalarValue): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function decodeBehaviorValue(source: string): { ok: true; value: BehaviorValue } | { ok: false; diagnostic: ReturnType<typeof error> } {
  if (source === '') {
    return { ok: false, diagnostic: error('fsm.behavior.value.empty', 'Canonical behavior values must not be empty.') };
  }
  if (source.startsWith('"')) {
    try {
      const parsed = JSON.parse(source) as unknown;
      return typeof parsed === 'string'
        ? { ok: true, value: parsed }
        : { ok: false, diagnostic: error('fsm.behavior.value.invalid-string', 'Quoted behavior values must decode to strings.') };
    } catch {
      return { ok: false, diagnostic: error('fsm.behavior.value.invalid-json', 'Invalid quoted behavior value.') };
    }
  }
  if (source.startsWith('[')) {
    try {
      const parsed = JSON.parse(source) as unknown;
      return Array.isArray(parsed) && parsed.every(isBehaviorScalarValue)
        ? { ok: true, value: parsed }
        : { ok: false, diagnostic: error('fsm.behavior.value.invalid-array', 'Behavior arrays must contain only scalar JSON-safe values.') };
    } catch {
      return { ok: false, diagnostic: error('fsm.behavior.value.invalid-array-json', 'Invalid behavior array value.') };
    }
  }
  if (source === 'true') return { ok: true, value: true };
  if (source === 'false') return { ok: true, value: false };
  if (source === 'null') return { ok: true, value: null };
  const numeric = Number(source);
  if (Number.isFinite(numeric)) {
    return { ok: true, value: numeric };
  }
  return { ok: false, diagnostic: error('fsm.behavior.value.unquoted-string', 'Canonical string behavior values must be JSON-quoted.') };
}

function splitTokens(source: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inString = false;
  let escaping = false;
  let arrayDepth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\' && inString) {
      current += char;
      escaping = true;
      continue;
    }
    if (char === '"') {
      current += char;
      inString = !inString;
      continue;
    }
    if (!inString && char === '[') {
      arrayDepth += 1;
      current += char;
      continue;
    }
    if (!inString && char === ']') {
      arrayDepth -= 1;
      current += char;
      continue;
    }
    if (!inString && arrayDepth === 0 && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

export function createGuardInvocation(contractId: string, args: BehaviorArgs = {}): GuardInvocationV1 {
  return { version: FSM_BEHAVIOR_VERSION, contractId, args };
}

export function createEffectInvocation(contractId: string, args: BehaviorArgs = {}): EffectInvocationV1 {
  return { version: FSM_BEHAVIOR_VERSION, contractId, args };
}

function validateEffectInvocations(effects: readonly EffectInvocationV1[]) {
  if (effects.length > MAX_BEHAVIOR_EFFECTS) {
    return [error('fsm.behavior.effect.too-many', `A transition can persist at most ${MAX_BEHAVIOR_EFFECTS} typed effects in schema-v5.`)];
  }
  return effects.flatMap((effect) => validateEffectInvocation(effect));
}

function readEffectInvocation(value: unknown): { ok: true; value: EffectInvocationV1 } | { ok: false; diagnostic: ReturnType<typeof error> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, diagnostic: error('fsm.behavior.effect.invalid-shape', 'Typed effect must be an object.') };
  }
  const record = value as Record<string, unknown>;
  if (record.version !== FSM_BEHAVIOR_VERSION || typeof record.contractId !== 'string' || !record.args || typeof record.args !== 'object' || Array.isArray(record.args)) {
    return { ok: false, diagnostic: error('fsm.behavior.effect.invalid-envelope', 'Typed effect envelope is invalid.') };
  }
  const args: Record<string, BehaviorValue> = {};
  for (const [key, item] of Object.entries(record.args as Record<string, unknown>)) {
    if (isBehaviorScalarValue(item) || (Array.isArray(item) && item.every(isBehaviorScalarValue))) {
      args[key] = item;
    } else {
      return { ok: false, diagnostic: error('fsm.behavior.effect.invalid-arg', `Typed effect argument "${key}" is not JSON-safe.`) };
    }
  }
  return { ok: true, value: { version: FSM_BEHAVIOR_VERSION, contractId: record.contractId, args } };
}

function isSafeLegacyBackendProcessId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(value) && !['__proto__', 'constructor', 'prototype'].some((token) => value.includes(token));
}

function canonicalSerializeValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerializeValue(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalSerializeValue(item)}`).join(',')}}`;
}

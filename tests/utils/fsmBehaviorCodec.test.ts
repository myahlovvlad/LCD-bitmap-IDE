import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  EFFECTS_BACKEND_PREFIX,
  GUARD_CONDITION_PREFIX,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  createEffectInvocation,
  createGuardInvocation,
  parseBackendBehaviorStorage,
  parseGuardCondition,
  serializeEffectInvocations,
  serializeGuardInvocation
} from '../../src/fsm-behavior';

describe('FSM behavior codec hardening', () => {
  it('detects empty, opaque, typed, malformed and unsupported storage states', () => {
    expect(parseGuardCondition(null)).toEqual({ kind: 'empty' });
    expect(parseGuardCondition('button == START')).toEqual({ kind: 'opaque', source: 'button == START' });
    expect(parseGuardCondition(`${GUARD_CONDITION_PREFIX} missing.contract`).kind).toBe('invalid');

    expect(parseBackendBehaviorStorage(null)).toEqual({ kind: 'none' });
    expect(parseBackendBehaviorStorage('process-measure')).toEqual({ kind: 'legacy-backend-process', processId: 'process-measure' });
    expect(parseBackendBehaviorStorage(`${EFFECTS_BACKEND_PREFIX.replace('/v1', '/v2')} []`).kind).toBe('invalid');
    expect(parseBackendBehaviorStorage(`${EFFECTS_BACKEND_PREFIX} not-json`).kind).toBe('invalid');
  });

  it('keeps ordinary backend process IDs from being misclassified as typed effects', () => {
    expect(parseBackendBehaviorStorage('backend.process.request')).toEqual({
      kind: 'legacy-backend-process',
      processId: 'backend.process.request'
    });
    expect(parseBackendBehaviorStorage('@lcdide-effect-process').kind).toBe('opaque');
  });

  it('serializes typed effects deterministically while preserving order', () => {
    const first = createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'a' });
    const second = createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'b' });
    const encoded = serializeEffectInvocations([first, second]);
    const decoded = parseBackendBehaviorStorage(encoded);

    expect(encoded).toBe(`${EFFECTS_BACKEND_PREFIX} [{"args":{"processId":"a"},"contractId":"backend.process.request","version":1},{"args":{"processId":"b"},"contractId":"backend.process.request","version":1}]`);
    expect(decoded.kind).toBe('typed-effects');
    expect(decoded.kind === 'typed-effects' ? decoded.canonical : '').toBe(encoded);
    expect(decoded.kind === 'typed-effects' ? decoded.effects.map((effect) => effect.args.processId) : []).toEqual(['a', 'b']);
  });

  it('keeps guard argument insertion order from changing canonical bytes', () => {
    const left = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      value: 'START',
      operator: '==',
      key: 'button'
    }));
    const right = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    }));

    expect(left).toBe(right);
  });

  it('never throws on bounded malformed payloads', () => {
    const values = [
      `${GUARD_CONDITION_PREFIX}`,
      `${GUARD_CONDITION_PREFIX} runtime.context.compare key="button" operator="==" value=`,
      `${EFFECTS_BACKEND_PREFIX}`,
      `${EFFECTS_BACKEND_PREFIX} {"bad":true}`,
      `${EFFECTS_BACKEND_PREFIX} [{"version":1,"contractId":"backend.process.request","args":{"processId":{}}}]`
    ];

    expect(values.map((value) => {
      if (value.startsWith(GUARD_CONDITION_PREFIX)) {
        return parseGuardCondition(value).kind;
      }
      return parseBackendBehaviorStorage(value).kind;
    })).toEqual(['invalid', 'invalid', 'invalid', 'invalid', 'invalid']);
  });

  it('characterizes bounded decode performance without setting a production SLA', () => {
    const guard = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    }));
    const effects = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);
    const started = performance.now();
    for (let index = 0; index < 10_000; index += 1) {
      expect(parseGuardCondition(guard).kind).toBe('typed');
      expect(parseBackendBehaviorStorage(effects).kind).toBe('typed-effects');
    }
    const durationMs = Math.round((performance.now() - started) * 100) / 100;

    console.log(JSON.stringify({
      fsmBehaviorCodec: {
        decodePairs: 10_000,
        durationMs,
        averageStorageLength: Math.round((guard.length + effects.length) / 2),
        maxStorageLength: Math.max(guard.length, effects.length)
      }
    }));
  });
});

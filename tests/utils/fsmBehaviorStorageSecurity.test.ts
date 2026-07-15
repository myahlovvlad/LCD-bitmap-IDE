import { describe, expect, it } from 'vitest';
import {
  EFFECTS_BACKEND_PREFIX,
  GUARD_CONDITION_PREFIX,
  MAX_BEHAVIOR_STORAGE_LENGTH,
  parseBackendBehaviorStorage,
  parseGuardCondition
} from '../../src/fsm-behavior';

describe('FSM behavior storage security', () => {
  it('rejects oversized storage values', () => {
    const long = 'x'.repeat(MAX_BEHAVIOR_STORAGE_LENGTH + 1);
    expect(parseGuardCondition(`${GUARD_CONDITION_PREFIX} ${long}`).kind).toBe('invalid');
    expect(parseBackendBehaviorStorage(long).kind).toBe('invalid');
  });

  it('does not accept prototype-polluting legacy backend IDs', () => {
    expect(parseBackendBehaviorStorage('__proto__').kind).toBe('opaque');
    expect(parseBackendBehaviorStorage('constructor').kind).toBe('opaque');
    expect(parseBackendBehaviorStorage('prototype').kind).toBe('opaque');
  });

  it('treats expression-looking and shell-looking payloads as data or invalid storage', () => {
    expect(parseGuardCondition('$(rm -rf .)').kind).toBe('opaque');
    expect(parseBackendBehaviorStorage(`${EFFECTS_BACKEND_PREFIX} [{"version":1,"contractId":"backend.process.request","args":{"processId":"$(rm -rf .)"}}]`).kind).toBe('invalid');
  });

  it('terminates on bounded prefix bombs', () => {
    const bomb = `${EFFECTS_BACKEND_PREFIX} ${'['.repeat(200)}`;
    expect(parseBackendBehaviorStorage(bomb).kind).toBe('invalid');
  });

  it('rejects duplicate guard arguments and excessive scalar payloads', () => {
    const duplicate = `${GUARD_CONDITION_PREFIX} runtime.context.compare key="button" key="event" operator="==" value="START"`;
    const longValue = `${GUARD_CONDITION_PREFIX} runtime.context.compare key="button" operator="==" value="${'x'.repeat(161)}"`;

    expect(parseGuardCondition(duplicate).kind).toBe('invalid');
    expect(parseGuardCondition(longValue).kind).toBe('invalid');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveRuntimeTimerDelay } from '../../src/features/runtime-workspace/runtimeTimer';

describe('Runtime express timer', () => {
  it('keeps real instrument timing in normal mode and advances simulated time 60× faster in express mode', () => {
    expect(resolveRuntimeTimerDelay(900_000, 'real')).toBe(900_000);
    expect(resolveRuntimeTimerDelay(900_000, 'express')).toBe(15_000);
    expect(resolveRuntimeTimerDelay(500, 'express')).toBe(8);
  });

  it('never schedules a zero-millisecond timer', () => {
    expect(resolveRuntimeTimerDelay(1, 'express')).toBe(1);
  });
});

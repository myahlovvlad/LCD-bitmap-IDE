export type RuntimeTimerMode = 'real' | 'express';

const EXPRESS_TIMER_SCALE = 60;

/**
 * Converts an instrument timer into its wall-clock simulation delay.
 * Express mode preserves the sequence of FSM timer events while making a
 * simulated minute elapse in one real second.
 */
export function resolveRuntimeTimerDelay(timerMs: number, mode: RuntimeTimerMode): number {
  const delay = mode === 'express' ? timerMs / EXPRESS_TIMER_SCALE : timerMs;
  return Math.max(1, Math.round(delay));
}

import type { ScreenDslApplyOperation } from './transactionContract';

/**
 * Test-only injection hooks for Screen DSL Apply.
 * Provided via dependency injection in tests; never used in production callers.
 * Hooks may throw to simulate mid-transaction failures.
 */
export interface ScreenDslApplyTestHooks {
  beforeOperation?(operation: ScreenDslApplyOperation, index: number): void;
  afterOperation?(operation: ScreenDslApplyOperation, index: number): void;
  beforeCommit?(): void;
}

import type { LocalizedText } from './localization';
import type { ValueExpression } from './tag';

export type RuntimeActionType = 'cli' | 'delay' | 'setTag' | 'guard' | 'audit';

export interface RuntimeAction {
  type: RuntimeActionType;
  cliCommandId?: string;
  delayMs?: number;
  tagId?: string;
  value?: ValueExpression;
  message?: LocalizedText;
}

export interface BackendProcedure {
  id: string;
  name: LocalizedText;
  category?: string;
  services: string[];
  precondition?: ValueExpression;
  steps: RuntimeAction[];
  postcondition?: ValueExpression;
  failureTargetStateId?: string | null;
}

export interface CliRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface CliCommandDefinition {
  id: string;
  command: string;
  description?: LocalizedText;
  expectedDurationMs?: number;
  retryPolicy?: CliRetryPolicy;
}

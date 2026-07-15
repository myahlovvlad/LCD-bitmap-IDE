import type { BackendProcedure, CliCommandDefinition } from '../../domain/procedure';
import type { ITransport } from './ITransport';
import type { TagContext } from './TagContext';
import { evaluateExpression } from './TagContext';

export type ProcedureOutcome = 'success' | 'failure';

export interface AuditEntry {
  timestamp: string;
  stepIndex: number;
  type: string;
  message: string;
  ok: boolean;
}

export interface ExecutionContext {
  tags: TagContext;
  transport: ITransport;
  cliCatalog: Record<string, CliCommandDefinition>;
  onAudit: (entry: AuditEntry) => void;
}

export interface ExecutionResult {
  outcome: ProcedureOutcome;
  auditTrail: AuditEntry[];
  failureReason?: string;
}

export async function executeProcedure(
  procedure: BackendProcedure,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const auditTrail: AuditEntry[] = [];
  const audit = (stepIndex: number, type: string, message: string, ok: boolean): void => {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      stepIndex,
      type,
      message,
      ok
    };
    auditTrail.push(entry);
    ctx.onAudit(entry);
  };

  // Check precondition
  if (procedure.precondition) {
    const preconditionMet = evaluateExpression(procedure.precondition, ctx.tags);
    if (!preconditionMet) {
      audit(-1, 'precondition', `Precondition failed for procedure "${procedure.id}".`, false);
      return { outcome: 'failure', auditTrail, failureReason: 'precondition' };
    }
  }

  // Execute steps
  for (let index = 0; index < procedure.steps.length; index++) {
    const step = procedure.steps[index];

    switch (step.type) {
      case 'cli': {
        const cmdId = step.cliCommandId;
        if (!cmdId) {
          audit(index, 'cli', 'CLI step missing cliCommandId.', false);
          return { outcome: 'failure', auditTrail, failureReason: `step[${index}]:cli:missing-id` };
        }
        const def = ctx.cliCatalog[cmdId];
        const command = def?.command ?? cmdId;

        audit(index, 'cli', `Sending: ${command}`, true);
        const result = await ctx.transport.sendCommand(command);

        if (!result.ok) {
          audit(index, 'cli', `Command failed: ${result.error}`, false);
          if (!result.retriable) {
            return { outcome: 'failure', auditTrail, failureReason: `step[${index}]:cli:transport-error` };
          }
          // retriable errors: log and continue (caller may retry the whole procedure)
        } else {
          audit(index, 'cli', `Response: ${result.response}`, true);
        }
        break;
      }

      case 'delay': {
        const ms = step.delayMs ?? 0;
        if (ms > 0) {
          await delay(ms);
        }
        audit(index, 'delay', `Waited ${ms}ms.`, true);
        break;
      }

      case 'setTag': {
        if (!step.tagId || !step.value) {
          audit(index, 'setTag', 'setTag step missing tagId or value.', false);
          break;
        }
        const value = evaluateExpression(step.value, ctx.tags);
        ctx.tags.set(step.tagId, value);
        audit(index, 'setTag', `Tag "${step.tagId}" = ${JSON.stringify(value)}.`, true);
        break;
      }

      case 'guard': {
        if (!step.value) {
          audit(index, 'guard', 'Guard step missing value expression.', false);
          return { outcome: 'failure', auditTrail, failureReason: `step[${index}]:guard:missing-expr` };
        }
        const guardResult = evaluateExpression(step.value, ctx.tags);
        if (!guardResult) {
          audit(index, 'guard', `Guard at step ${index} failed.`, false);
          return { outcome: 'failure', auditTrail, failureReason: `step[${index}]:guard:false` };
        }
        audit(index, 'guard', `Guard passed.`, true);
        break;
      }

      case 'audit': {
        const message = step.message?.en ?? `Step ${index}`;
        audit(index, 'audit', message, true);
        break;
      }
    }
  }

  // Check postcondition
  if (procedure.postcondition) {
    const postconditionMet = evaluateExpression(procedure.postcondition, ctx.tags);
    if (!postconditionMet) {
      audit(procedure.steps.length, 'postcondition', `Postcondition failed for procedure "${procedure.id}".`, false);
      return { outcome: 'failure', auditTrail, failureReason: 'postcondition' };
    }
  }

  audit(procedure.steps.length, 'complete', `Procedure "${procedure.id}" completed.`, true);
  return { outcome: 'success', auditTrail };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { finalizeMutation, type ProjectCommandResult } from '../commandBus';
import { createFixedApplicationCommandContext } from '../commandContext';
import type { ProjectSession } from '../projectSession';
import { applyProjectCommandMutation } from '../projectMutations';
import type { SemanticChange } from '../semanticChange';
import { exportSessionScreenInterchange } from '../screenInterchangeFacade';
import type { ScreenDslDiagnostic } from '../../screen-dsl';
import type { ApplyScreenDslPreviewRequest, ScreenDslPreviewResult } from './contracts';
import { fingerprintScreenDslSource } from './hash';
import type { ScreenDslApplyTestHooks } from './testHooks';
import {
  buildScreenDslApplyOperations,
  buildScreenDslApplyTransaction,
  SCREEN_DSL_TRANSACTION_LIMITS,
  type ScreenDslApplyTransaction
} from './transactionContract';

const APPLY_TIMESTAMP = '2026-06-25T00:00:00.000Z';

export interface ApplyScreenDslPreviewResult {
  applied: boolean;
  result: ProjectCommandResult | null;
  diagnostics: readonly ScreenDslDiagnostic[];
  /** Preview with updated lifecycle — 'consumed' on success, 'failed' on error. */
  updatedPreview: ScreenDslPreviewResult;
  transaction: ScreenDslApplyTransaction | null;
}

export function applyScreenDslPreview(
  session: ProjectSession,
  request: ApplyScreenDslPreviewRequest,
  hooks?: ScreenDslApplyTestHooks
): ApplyScreenDslPreviewResult {
  const diagnostics: ScreenDslDiagnostic[] = [];
  const { preview } = request;

  // Consumed / lifecycle guard
  if (preview.lifecycle === 'consumed') {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_PREVIEW_CONSUMED', severity: 'error', message: 'This Preview has already been applied and cannot be applied again.', path: '$.preview' });
    return { applied: false, result: null, diagnostics, updatedPreview: preview, transaction: null };
  }
  if (preview.lifecycle === 'failed') {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_PREVIEW_FAILED', severity: 'error', message: 'This Preview is in a failed state and cannot be applied.', path: '$.preview' });
    return { applied: false, result: null, diagnostics, updatedPreview: preview, transaction: null };
  }

  if (!preview.applyAllowed || !preview.changeSet) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_NOT_ALLOWED', severity: 'error', message: 'Preview is not applyable.', path: '$.preview' });
  }
  if (preview.projectId !== session.project.meta.id) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_PROJECT_MISMATCH', severity: 'error', message: 'Preview project does not match session project.', path: '$.projectId' });
  }
  if (preview.baseRevision !== session.revision) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_STALE_REVISION', severity: 'error', message: 'Session revision changed after Preview.', path: '$.revision' });
  }
  if (fingerprintScreenDslSource(request.sourceText) !== preview.sourceFingerprint) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_STALE_SOURCE', severity: 'error', message: 'Source text changed after Preview.', path: '$.sourceText' });
  }
  const targetScreenIds = preview.parsedDocument?.screens.map((screen) => screen.id);
  if (targetScreenIds && exportSessionScreenInterchange(session, targetScreenIds).fingerprint !== preview.baseScreenFingerprint) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_STALE_SCREEN', severity: 'error', message: 'Target screen changed after Preview.', path: '$.screens' });
  }
  if (preview.destructive && !request.confirmDestructive) {
    diagnostics.push({ code: 'SCREEN_DSL_APPLY_DESTRUCTIVE_CONFIRMATION_REQUIRED', severity: 'error', message: 'Destructive Screen DSL Apply requires confirmation.', path: '$.confirmDestructive' });
  }

  if (diagnostics.length > 0 || !preview.changeSet) {
    return { applied: false, result: null, diagnostics, updatedPreview: { ...preview, lifecycle: 'failed' }, transaction: null };
  }

  // Build typed operations and transaction
  const operations = buildScreenDslApplyOperations(preview);
  const transaction = buildScreenDslApplyTransaction(preview, operations);

  // Transaction limit validation — block before any mutation
  if (operations.length > SCREEN_DSL_TRANSACTION_LIMITS.maxOperations) {
    const limitDiag: ScreenDslDiagnostic = { code: 'SCREEN_DSL_APPLY_LIMIT_OPERATIONS', severity: 'error', message: `Transaction exceeds maximum operation count (${SCREEN_DSL_TRANSACTION_LIMITS.maxOperations}).`, path: '$.operations' };
    return { applied: false, result: null, diagnostics: [limitDiag], updatedPreview: { ...preview, lifecycle: 'failed' }, transaction };
  }
  const affectedScreens = new Set(
    operations.flatMap((op) =>
      op.type === 'create-screens' ? op.screenIds as string[] :
      op.type === 'update-screen-name' ? [op.screenId] :
      op.type === 'update-screen-dimensions' ? [op.screenId] :
      op.type === 'update-screen-objects' ? [op.screenId] : []
    )
  );
  if (affectedScreens.size > SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedScreens) {
    const limitDiag: ScreenDslDiagnostic = { code: 'SCREEN_DSL_APPLY_LIMIT_SCREENS', severity: 'error', message: `Transaction exceeds maximum affected screen count (${SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedScreens}).`, path: '$.screens' };
    return { applied: false, result: null, diagnostics: [limitDiag], updatedPreview: { ...preview, lifecycle: 'failed' }, transaction };
  }
  const totalObjects = operations.reduce((sum, op) =>
    op.type === 'create-screens' ? sum + op.objectIds.length :
    op.type === 'update-screen-objects' ? sum + op.objectIds.length : sum, 0
  );
  if (totalObjects > SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedObjects) {
    const limitDiag: ScreenDslDiagnostic = { code: 'SCREEN_DSL_APPLY_LIMIT_OBJECTS', severity: 'error', message: `Transaction exceeds maximum affected object count (${SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedObjects}).`, path: '$.objects' };
    return { applied: false, result: null, diagnostics: [limitDiag], updatedPreview: { ...preview, lifecycle: 'failed' }, transaction };
  }

  // Execute with optional test hooks
  const context = createFixedApplicationCommandContext(APPLY_TIMESTAMP);
  let result: ProjectCommandResult;
  try {
    result = executeChangeSetWithHooks(session, preview, operations, context, hooks);
  } catch (error) {
    // Hooks may throw controlled errors; ensure session is NOT mutated
    const message = error instanceof Error ? error.message : String(error);
    return {
      applied: false,
      result: null,
      diagnostics: [{ code: 'SCREEN_DSL_APPLY_HOOK_ABORT', severity: 'error', message: `Apply aborted by test hook: ${message}`, path: '$.hooks' }],
      updatedPreview: { ...preview, lifecycle: 'failed' },
      transaction
    };
  }

  if (result.status !== 'applied') {
    const failDiagnostics: ScreenDslDiagnostic[] = result.diagnostics
      .filter((diagnostic) => diagnostic.severity !== 'info')
      .map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity === 'warning' ? 'warning' : 'error',
        message: diagnostic.message,
        path: '$.changeSet'
      }));
    return {
      applied: false,
      result,
      diagnostics: failDiagnostics,
      updatedPreview: { ...preview, lifecycle: 'failed' },
      transaction
    };
  }

  return {
    applied: true,
    result,
    diagnostics: [],
    updatedPreview: { ...preview, lifecycle: 'consumed' },
    transaction
  };
}

function executeChangeSetWithHooks(
  session: ProjectSession,
  preview: ScreenDslPreviewResult,
  operations: readonly ReturnType<typeof buildScreenDslApplyOperations>[number][],
  context: ReturnType<typeof createFixedApplicationCommandContext>,
  hooks?: ScreenDslApplyTestHooks
): ProjectCommandResult {
  const changeSet = preview.changeSet!;

  // Envelope validation
  if (changeSet.projectId !== session.workspace.project.meta.id) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{ severity: 'error', code: 'changeset.project-mismatch', message: `ChangeSet project does not match session.` }],
      forwardPatches: [],
      inversePatches: []
    };
  }
  if (changeSet.expectedRevision !== session.revision) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{ severity: 'error', code: 'changeset.revision-conflict', message: `ChangeSet revision ${changeSet.expectedRevision} does not match session revision ${session.revision}.` }],
      forwardPatches: [],
      inversePatches: []
    };
  }

  let workspace = session.workspace;
  const changes: SemanticChange[] = [];
  const commandIds: string[] = [];

  for (let index = 0; index < changeSet.commands.length; index++) {
    const command = changeSet.commands[index];
    const operation = operations[index];

    // Per-command envelope checks
    if (command.meta.projectId !== changeSet.projectId || command.meta.expectedRevision !== changeSet.expectedRevision) {
      return {
        status: 'rejected',
        session,
        changes: [],
        diagnostics: [{ severity: 'error', code: 'changeset.command-envelope-mismatch', message: `Command "${command.meta.commandId}" does not match ChangeSet envelope.`, commandId: command.meta.commandId }],
        forwardPatches: [],
        inversePatches: []
      };
    }
    if (session.processedCommandIds.has(command.meta.commandId) || commandIds.includes(command.meta.commandId)) {
      return {
        status: 'rejected',
        session,
        changes: [],
        diagnostics: [{ severity: 'error', code: 'changeset.duplicate-command-id', message: `Command "${command.meta.commandId}" was already processed.`, commandId: command.meta.commandId }],
        forwardPatches: [],
        inversePatches: []
      };
    }

    // Pre-operation hook (may throw to abort)
    if (hooks?.beforeOperation && operation) {
      hooks.beforeOperation(operation, index);
    }

    const mutation = applyProjectCommandMutation(workspace, command, context);
    workspace = mutation.workspace;
    changes.push(...mutation.changes);
    commandIds.push(command.meta.commandId);

    // Post-operation hook (may throw to abort)
    if (hooks?.afterOperation && operation) {
      hooks.afterOperation(operation, index);
    }
  }

  if (changes.length === 0) {
    return { status: 'noop', session, changes: [], diagnostics: [], forwardPatches: [], inversePatches: [] };
  }

  // Pre-commit hook (may throw to abort)
  if (hooks?.beforeCommit) {
    hooks.beforeCommit();
  }

  return finalizeMutation(session, workspace, changes, context, {}, {
    kind: 'changeset',
    commandIds,
    actor: changeSet.commands[0]?.meta.actor,
    reason: changeSet.reason,
    timestamp: changeSet.timestamp,
    label: changeSet.changeSetId
  });
}

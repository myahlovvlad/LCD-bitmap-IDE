import { createDefaultApplicationCommandContext, type ApplicationCommandContext } from '../commandContext';
import type { ProjectChangeSet } from '../changeSet';
import { executeProjectChangeSet } from '../changeSet';
import type { CommandMetadata } from '../commandTypes';
import type { ProjectCommandResult } from '../commandBus';
import type { ProjectSession } from '../projectSession';
import { buildUxContractIdRefs, normalizeUxContract, type ProjectUxContract } from '../../domain/uxContract';

export interface UxContractUpdatePreview {
  readonly ok: boolean;
  readonly baseRevision: number;
  readonly candidate: ProjectUxContract;
  readonly diagnostics: readonly { code: string; message: string }[];
  readonly changeSet?: ProjectChangeSet;
  readonly dryRun?: ProjectCommandResult;
}

/** Normalizes a raw contract patch against the current project's live ids and dry-runs the
 *  resulting mutation, mirroring previewFsmScriptImport's preview/apply shape. */
export function previewUxContractUpdate(
  session: ProjectSession,
  patch: unknown,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext()
): UxContractUpdatePreview {
  const refs = buildUxContractIdRefs(session.project);
  const candidate = normalizeUxContract(patch, refs);
  const changeSet = createUxContractChangeSet(session, candidate, context);
  const dryRun = executeProjectChangeSet(session, changeSet, context, { dryRun: true });
  return {
    ok: dryRun.status !== 'rejected',
    baseRevision: session.revision,
    candidate,
    diagnostics: dryRun.diagnostics.map((diagnostic) => ({ code: diagnostic.code, message: diagnostic.message })),
    changeSet,
    dryRun
  };
}

export function applyUxContractUpdate(
  session: ProjectSession,
  preview: UxContractUpdatePreview,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext()
): ProjectCommandResult {
  if (!preview.changeSet) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{ severity: 'error', code: 'ux.contract.preview-invalid', message: 'Cannot apply an invalid UX contract preview.' }],
      forwardPatches: [],
      inversePatches: []
    };
  }
  if (session.revision !== preview.baseRevision) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{ severity: 'error', code: 'ux.contract.stale-preview', message: 'UX contract preview is stale; regenerate preview before applying.' }],
      forwardPatches: [],
      inversePatches: []
    };
  }
  return executeProjectChangeSet(session, preview.changeSet, context);
}

function createUxContractChangeSet(
  session: ProjectSession,
  candidate: ProjectUxContract,
  context: ApplicationCommandContext
): ProjectChangeSet {
  const meta: CommandMetadata = {
    commandId: `ux-contract-${session.revision}-${context.now()}`,
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    actor: { id: 'ux-validation-panel', type: 'adapter', displayName: 'UX Validation' },
    reason: 'Update UX semantic contract',
    timestamp: context.now()
  };
  return {
    changeSetId: `ux-contract-${session.revision}`,
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    timestamp: meta.timestamp,
    reason: meta.reason,
    commands: [{
      type: 'ux.contract.update',
      meta,
      payload: { uxContract: candidate }
    }]
  };
}

import {
  canonicalSerializeFsmInterchange,
  diffFsmInterchange,
  fsmInterchangeFingerprint,
  parseFsmMermaid,
  parseFsmPythonDsl,
  projectToFsmInterchange,
  writeFsmMermaid,
  writeFsmPythonDsl,
  type FsmInterchangeModelV1,
  type FsmParseDiagnostic,
  type FsmScriptFormat,
  type FsmSemanticDiff
} from '../../fsm-interchange';
import { createDefaultApplicationCommandContext, type ApplicationCommandContext } from '../commandContext';
import type { ProjectChangeSet } from '../changeSet';
import { executeProjectChangeSet } from '../changeSet';
import type { CommandMetadata } from '../commandTypes';
import type { ProjectCommandResult } from '../commandBus';
import type { ProjectSession } from '../projectSession';

export interface FsmScriptPreview {
  readonly ok: boolean;
  readonly format: FsmScriptFormat;
  readonly baseRevision: number;
  readonly baseFingerprint: string;
  readonly candidateFingerprint?: string;
  readonly diagnostics: readonly FsmParseDiagnostic[];
  readonly sourceMap: readonly unknown[];
  readonly candidate?: FsmInterchangeModelV1;
  readonly diff?: FsmSemanticDiff;
  readonly changeSet?: ProjectChangeSet;
  readonly dryRun?: ProjectCommandResult;
}

export function exportFsmScript(session: ProjectSession, format: FsmScriptFormat): string {
  const model = projectToFsmInterchange(session.project);
  return format === 'mermaid' ? writeFsmMermaid(model) : writeFsmPythonDsl(model);
}

export function previewFsmScriptImport(
  session: ProjectSession,
  source: string,
  format: FsmScriptFormat,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext()
): FsmScriptPreview {
  const parsed = format === 'mermaid' ? parseFsmMermaid(source) : parseFsmPythonDsl(source);
  const baseModel = projectToFsmInterchange(session.project);
  const baseFingerprint = fsmInterchangeFingerprint(baseModel);
  if (!parsed.ok || !parsed.model) {
    return {
      ok: false,
      format,
      baseRevision: session.revision,
      baseFingerprint,
      diagnostics: parsed.diagnostics,
      sourceMap: parsed.sourceMap
    };
  }

  const diff = diffFsmInterchange(baseModel, parsed.model);
  const candidateFingerprint = fsmInterchangeFingerprint(parsed.model);
  const changeSet = createFsmRoundTripChangeSet(session, parsed.model, candidateFingerprint, context);
  const dryRun = diff.operations.length === 0
    ? undefined
    : executeProjectChangeSet(session, changeSet, context, { dryRun: true });

  return {
    ok: parsed.diagnostics.every((diagnostic) => diagnostic.severity !== 'error') && dryRun?.status !== 'rejected',
    format,
    baseRevision: session.revision,
    baseFingerprint,
    candidateFingerprint,
    diagnostics: [...parsed.diagnostics, ...(dryRun?.diagnostics.map((diagnostic) => ({
      severity: 'error' as const,
      code: diagnostic.code,
      message: diagnostic.message,
      line: 1,
      column: 1
    })) ?? [])],
    sourceMap: parsed.sourceMap,
    candidate: parsed.model,
    diff,
    changeSet,
    dryRun
  };
}

export function applyFsmScriptPreview(
  session: ProjectSession,
  preview: FsmScriptPreview,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext()
): ProjectCommandResult {
  if (!preview.changeSet || !preview.candidate) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{
        severity: 'error',
        code: 'fsm.roundtrip.preview-invalid',
        message: 'Cannot apply an invalid FSM script preview.'
      }],
      forwardPatches: [],
      inversePatches: []
    };
  }
  const currentFingerprint = fsmInterchangeFingerprint(projectToFsmInterchange(session.project));
  if (session.revision !== preview.baseRevision || currentFingerprint !== preview.baseFingerprint) {
    return {
      status: 'rejected',
      session,
      changes: [],
      diagnostics: [{
        severity: 'error',
        code: 'fsm.roundtrip.stale-preview',
        message: 'FSM script preview is stale; regenerate preview before applying.'
      }],
      forwardPatches: [],
      inversePatches: []
    };
  }
  if (preview.diff?.operations.length === 0) {
    return { status: 'noop', session, changes: [], diagnostics: [], forwardPatches: [], inversePatches: [] };
  }
  return executeProjectChangeSet(session, preview.changeSet, context);
}

export function canonicalFsmScriptModelJson(model: FsmInterchangeModelV1): string {
  return canonicalSerializeFsmInterchange(model);
}

function createFsmRoundTripChangeSet(
  session: ProjectSession,
  model: FsmInterchangeModelV1,
  candidateFingerprint: string,
  context: ApplicationCommandContext
): ProjectChangeSet {
  const meta: CommandMetadata = {
    commandId: `fsm-roundtrip-${session.revision}-${candidateFingerprint}`,
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    actor: { id: 'fsm-script-studio', type: 'adapter', displayName: 'FSM Script Studio' },
    reason: 'Apply FSM semantic round-trip import',
    timestamp: context.now()
  };
  return {
    changeSetId: `fsm-roundtrip-${candidateFingerprint}`,
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    timestamp: meta.timestamp,
    reason: meta.reason,
    commands: [{
      type: 'fsm.semanticRoundTrip.apply',
      meta,
      payload: { model }
    }]
  };
}

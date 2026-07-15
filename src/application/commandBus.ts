import { enablePatches, produceWithPatches, type Patch } from 'immer';
import { rebuildProjectBindings, type LcdBitmapProject, type ValidationIssue } from '../domain/project';
import type { ApplicationCommandContext } from './commandContext';
import { createDefaultApplicationCommandContext } from './commandContext';
import type { ProjectCommand } from './commandTypes';
import type { CommandDiagnostic } from './diagnostics';
import { applyProjectCommandMutation } from './projectMutations';
import { createSessionFromWorkspace, type ProjectSession } from './projectSession';
import type { SemanticChange } from './semanticChange';
import { appendHistoryEntry, type CommandHistoryEntry } from './commandHistory';
import type { ApplicationWorkspace } from './workspace';

enablePatches();

export type CommandResultStatus = 'applied' | 'dry-run' | 'noop' | 'rejected';

export interface ExecuteCommandOptions {
  dryRun?: boolean;
  recordHistory?: boolean;
}

export interface ProjectCommandResult {
  status: CommandResultStatus;
  session: ProjectSession;
  candidate?: ProjectSession;
  changes: SemanticChange[];
  diagnostics: CommandDiagnostic[];
  forwardPatches: Patch[];
  inversePatches: Patch[];
  historyEntry?: CommandHistoryEntry;
}

export function executeProjectCommand(
  session: ProjectSession,
  command: ProjectCommand,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext(),
  options: ExecuteCommandOptions = {}
): ProjectCommandResult {
  const preflight = validateEnvelope(session, command);
  if (preflight.length > 0) {
    return rejected(session, preflight);
  }

  const mutation = applyProjectCommandMutation(session.workspace, command, context);
  if (mutation.changes.length === 0) {
    return { status: 'noop', session, changes: [], diagnostics: [], forwardPatches: [], inversePatches: [] };
  }

  return finalizeMutation(session, mutation.workspace, mutation.changes, context, options, {
    kind: 'command',
    commandIds: [command.meta.commandId],
    actor: command.meta.actor,
    reason: command.meta.reason,
    timestamp: command.meta.timestamp,
    label: command.type
  });
}

export function finalizeMutation(
  session: ProjectSession,
  mutatedProjectOrWorkspace: LcdBitmapProject | ApplicationWorkspace,
  changes: SemanticChange[],
  context: ApplicationCommandContext,
  options: ExecuteCommandOptions = {},
  historyInput?: {
    kind: 'command' | 'changeset';
    commandIds: string[];
    actor?: ProjectCommand['meta']['actor'];
    reason?: string;
    timestamp?: string;
    label: string;
  }
): ProjectCommandResult {
  const mutatedWorkspace = isApplicationWorkspace(mutatedProjectOrWorkspace)
    ? mutatedProjectOrWorkspace
    : { ...session.workspace, project: mutatedProjectOrWorkspace };
  const candidateProject = refreshProject(mutatedWorkspace.project, context);
  const candidateWorkspace = { ...mutatedWorkspace, project: candidateProject };
  const blockingIssues = findNewBlockingIssues(session.workspace.project, candidateProject, context);
  if (blockingIssues.length > 0) {
    return rejected(session, blockingIssues.map((issue) => ({
      severity: 'error',
      code: 'validation.blocking-error',
      message: issue.message,
      issueId: issue.id
    })));
  }

  const [workspaceWithPatches, forwardPatches, inversePatches] = produceWithPatches(
    session.workspace,
    (draft) => {
      draft.project = candidateWorkspace.project;
      draft.fontGlyphs = candidateWorkspace.fontGlyphs;
      draft.loadedFonts = candidateWorkspace.loadedFonts;
      draft.savedMeasurements = candidateWorkspace.savedMeasurements;
    }
  );
  const nextRevision = session.revision + 1;
  const processedCommandIds = options.dryRun || !historyInput
    ? session.processedCommandIds
    : new Set([...session.processedCommandIds, ...historyInput.commandIds]);
  const baseCandidate = createSessionFromWorkspace(
    workspaceWithPatches,
    nextRevision,
    session.history,
    session.savepoint,
    processedCommandIds
  );
  const historyEntry = options.recordHistory === false
    ? undefined
    : createHistoryEntry(session, nextRevision, changes, forwardPatches, inversePatches, context, historyInput);
  const candidate = historyEntry
    ? createSessionFromWorkspace(
        workspaceWithPatches,
        nextRevision,
        appendHistoryEntry(session.history, historyEntry),
        session.savepoint,
        processedCommandIds
      )
    : baseCandidate;
  if (options.dryRun) {
    return { status: 'dry-run', session, candidate: baseCandidate, changes, diagnostics: [], forwardPatches, inversePatches, historyEntry };
  }
  return { status: 'applied', session: candidate, changes, diagnostics: [], forwardPatches, inversePatches, historyEntry };
}

export function refreshProject(
  project: LcdBitmapProject,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext()
): LcdBitmapProject {
  const withBindings = {
    ...project,
    bindings: rebuildProjectBindings(project)
  };
  return {
    ...withBindings,
    validation: {
      issues: context.validateProject(withBindings),
      validatedAt: context.now()
    }
  };
}

function validateEnvelope(session: ProjectSession, command: ProjectCommand): CommandDiagnostic[] {
  const diagnostics: CommandDiagnostic[] = [];
  if (command.meta.projectId !== session.workspace.project.meta.id) {
    diagnostics.push({
      severity: 'error',
      code: 'command.project-mismatch',
      message: `Command project "${command.meta.projectId}" does not match session project "${session.workspace.project.meta.id}".`,
      commandId: command.meta.commandId
    });
  }
  if (command.meta.expectedRevision !== session.revision) {
    diagnostics.push({
      severity: 'error',
      code: 'command.revision-conflict',
      message: `Command expected revision ${command.meta.expectedRevision}, current revision is ${session.revision}.`,
      commandId: command.meta.commandId
    });
  }
  if (session.processedCommandIds.has(command.meta.commandId)) {
    diagnostics.push({
      severity: 'error',
      code: 'command.duplicate-id',
      message: `Command "${command.meta.commandId}" was already processed in this session.`,
      commandId: command.meta.commandId
    });
  }
  return diagnostics;
}

function findNewBlockingIssues(
  before: LcdBitmapProject,
  after: LcdBitmapProject,
  context: ApplicationCommandContext
): ValidationIssue[] {
  const existingErrors = new Set(
    context.validateProject(before)
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.id)
  );
  return after.validation.issues.filter((issue) => issue.severity === 'error' && !existingErrors.has(issue.id));
}

function rejected(session: ProjectSession, diagnostics: CommandDiagnostic[]): ProjectCommandResult {
  return { status: 'rejected', session, changes: [], diagnostics, forwardPatches: [], inversePatches: [] };
}

function createHistoryEntry(
  session: ProjectSession,
  revisionAfter: number,
  changes: SemanticChange[],
  forwardPatches: Patch[],
  inversePatches: Patch[],
  context: ApplicationCommandContext,
  input?: {
    kind: 'command' | 'changeset';
    commandIds: string[];
    actor?: ProjectCommand['meta']['actor'];
    reason?: string;
    timestamp?: string;
    label: string;
  }
): CommandHistoryEntry {
  const commandIds = input?.commandIds ?? [];
  return {
    id: `${input?.kind ?? 'command'}-${session.revision}-${revisionAfter}-${commandIds.join('+') || 'anonymous'}`,
    kind: input?.kind ?? 'command',
    commandIds,
    actor: input?.actor ?? { id: 'unknown', type: 'system' },
    reason: input?.reason,
    committedAt: input?.timestamp ?? context.now(),
    revisionBefore: session.revision,
    revisionAfter,
    semanticChanges: changes,
    forwardPatches,
    inversePatches,
    label: input?.label ?? commandIds.join(', ')
  };
}

function isApplicationWorkspace(value: LcdBitmapProject | ApplicationWorkspace): value is ApplicationWorkspace {
  return 'project' in value && 'fontGlyphs' in value;
}

import type { ApplicationCommandContext } from './commandContext';
import { createDefaultApplicationCommandContext } from './commandContext';
import type { ProjectCommand } from './commandTypes';
import type { CommandDiagnostic } from './diagnostics';
import { finalizeMutation, type ExecuteCommandOptions, type ProjectCommandResult } from './commandBus';
import { applyProjectCommandMutation } from './projectMutations';
import type { ProjectSession } from './projectSession';
import type { SemanticChange } from './semanticChange';

export interface ProjectChangeSet {
  changeSetId: string;
  projectId: string;
  expectedRevision: number;
  commands: ProjectCommand[];
  reason?: string;
  timestamp?: string;
}

export function executeProjectChangeSet(
  session: ProjectSession,
  changeSet: ProjectChangeSet,
  context: ApplicationCommandContext = createDefaultApplicationCommandContext(),
  options: ExecuteCommandOptions = {}
): ProjectCommandResult {
  const diagnostics = validateEnvelope(session, changeSet);
  if (diagnostics.length > 0) {
    return { status: 'rejected', session, changes: [], diagnostics, forwardPatches: [], inversePatches: [] };
  }

  let workspace = session.workspace;
  const changes: SemanticChange[] = [];
  const commandIds: string[] = [];
  for (const command of changeSet.commands) {
    if (command.meta.projectId !== changeSet.projectId || command.meta.expectedRevision !== changeSet.expectedRevision) {
      return {
        status: 'rejected',
        session,
        changes: [],
        forwardPatches: [],
        inversePatches: [],
        diagnostics: [{
          severity: 'error',
          code: 'changeset.command-envelope-mismatch',
          message: `Command "${command.meta.commandId}" does not match ChangeSet project or expected revision.`,
          commandId: command.meta.commandId
        }]
      };
    }
    if (session.processedCommandIds.has(command.meta.commandId) || commandIds.includes(command.meta.commandId)) {
      return {
        status: 'rejected',
        session,
        changes: [],
        forwardPatches: [],
        inversePatches: [],
        diagnostics: [{
          severity: 'error',
          code: 'changeset.duplicate-command-id',
          message: `Command "${command.meta.commandId}" was already processed in this ChangeSet or session.`,
          commandId: command.meta.commandId
        }]
      };
    }
    const mutation = applyProjectCommandMutation(workspace, command, context);
    workspace = mutation.workspace;
    changes.push(...mutation.changes);
    commandIds.push(command.meta.commandId);
  }

  if (changes.length === 0) {
    return { status: 'noop', session, changes: [], diagnostics: [], forwardPatches: [], inversePatches: [] };
  }
  return finalizeMutation(
    session,
    workspace,
    changes,
    context,
    options,
    {
      kind: 'changeset',
      commandIds,
      actor: changeSet.commands[0]?.meta.actor,
      reason: changeSet.reason,
      timestamp: changeSet.timestamp,
      label: changeSet.changeSetId
    }
  );
}

function validateEnvelope(session: ProjectSession, changeSet: ProjectChangeSet): CommandDiagnostic[] {
  const diagnostics: CommandDiagnostic[] = [];
  if (changeSet.projectId !== session.workspace.project.meta.id) {
    diagnostics.push({
      severity: 'error',
      code: 'changeset.project-mismatch',
      message: `ChangeSet project "${changeSet.projectId}" does not match session project "${session.workspace.project.meta.id}".`
    });
  }
  if (changeSet.expectedRevision !== session.revision) {
    diagnostics.push({
      severity: 'error',
      code: 'changeset.revision-conflict',
      message: `ChangeSet expected revision ${changeSet.expectedRevision}, current revision is ${session.revision}.`
    });
  }
  return diagnostics;
}

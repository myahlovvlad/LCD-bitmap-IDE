import type { LcdBitmapProject } from '../domain/project';
import { applyPatches } from 'immer';
import { canRedo, canUndo, createCommandHistory, type CommandHistory } from './commandHistory';
import { createWorkspaceSavepoint, type WorkspaceSavepoint } from './savepoint';
import {
  createApplicationWorkspace,
  type ApplicationWorkspace,
  type ApplicationWorkspaceInput
} from './workspace';

export interface ProjectSession {
  workspace: ApplicationWorkspace;
  /**
   * Compatibility projection for Phase 1B.1 callers. New application code
   * should use `workspace.project`.
   */
  project: LcdBitmapProject;
  revision: number;
  history: CommandHistory;
  savepoint: WorkspaceSavepoint;
  processedCommandIds: ReadonlySet<string>;
}

export function createProjectSession(
  projectOrWorkspace: LcdBitmapProject | ApplicationWorkspaceInput,
  revision = 0
): ProjectSession {
  const workspace = isWorkspaceInput(projectOrWorkspace)
    ? createApplicationWorkspace(projectOrWorkspace)
    : createApplicationWorkspace({ project: projectOrWorkspace });
  return createSessionFromWorkspace(workspace, revision);
}

export function createSessionFromWorkspace(
  workspace: ApplicationWorkspace,
  revision = 0,
  history: CommandHistory = createCommandHistory(),
  savepoint: WorkspaceSavepoint = createWorkspaceSavepoint(workspace, revision),
  processedCommandIds: ReadonlySet<string> = new Set()
): ProjectSession {
  return {
    workspace,
    project: workspace.project,
    revision,
    history,
    savepoint,
    processedCommandIds
  };
}

export function undoProjectSession(session: ProjectSession): ProjectSession | null {
  if (!canUndo(session.history)) {
    return null;
  }
  const entry = session.history.entries[session.history.cursor - 1];
  const workspace = applyPatches(session.workspace, entry.inversePatches);
  return createSessionFromWorkspace(
    workspace,
    session.revision + 1,
    { ...session.history, cursor: session.history.cursor - 1 },
    session.savepoint,
    session.processedCommandIds
  );
}

export function redoProjectSession(session: ProjectSession): ProjectSession | null {
  if (!canRedo(session.history)) {
    return null;
  }
  const entry = session.history.entries[session.history.cursor];
  const workspace = applyPatches(session.workspace, entry.forwardPatches);
  return createSessionFromWorkspace(
    workspace,
    session.revision + 1,
    { ...session.history, cursor: session.history.cursor + 1 },
    session.savepoint,
    session.processedCommandIds
  );
}

function isWorkspaceInput(value: LcdBitmapProject | ApplicationWorkspaceInput): value is ApplicationWorkspaceInput {
  return 'project' in value && 'meta' in value.project;
}

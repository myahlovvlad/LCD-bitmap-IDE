import { describe, expect, it } from 'vitest';
import {
  createFixedApplicationCommandContext,
  createProjectSession,
  executeProjectChangeSet,
  executeProjectCommand,
  isWorkspaceDirty,
  redoProjectSession,
  type CommandMetadata,
  type ProjectChangeSet,
  type ProjectCommand,
  undoProjectSession
} from '../../src/application';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { FontGlyphs, LcdBitmapProject } from '../../src/domain';

const timestamp = '2026-06-24T02:00:00.000Z';

describe('application session and command history', () => {
  it('creates a workspace session with project-associated auxiliary state and clean savepoint', () => {
    const project = createProject();
    const fontGlyphs = { '1': { X: { width: 1, data: ['#'] } }, '2': {} } as FontGlyphs;
    const session = createProjectSession({ project, fontGlyphs, loadedFonts: [], savedMeasurements: [] }, 7);

    expect(session.project).toBe(project);
    expect(session.workspace.project).toBe(project);
    expect(session.workspace.fontGlyphs).toBe(fontGlyphs);
    expect(session.revision).toBe(7);
    expect(session.history.entries).toEqual([]);
    expect(session.processedCommandIds.size).toBe(0);
    expect(isWorkspaceDirty(session.workspace, session.savepoint)).toBe(false);
  });

  it('records semantic changes and reversible patches for an applied command', () => {
    const session = createProjectSession(createProject(), 0);
    const command = commandFor(session.project, 0, 'project.updateMetadata', { name: 'History Name' });

    const result = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('applied');
    expect(result.forwardPatches.length).toBeGreaterThan(0);
    expect(result.inversePatches.length).toBeGreaterThan(0);
    expect(result.historyEntry).toEqual(expect.objectContaining({
      kind: 'command',
      commandIds: [command.meta.commandId],
      revisionBefore: 0,
      revisionAfter: 1,
      label: 'project.updateMetadata'
    }));
    expect(result.session.history.entries).toHaveLength(1);
    expect(result.session.history.cursor).toBe(1);
    expect(result.session.processedCommandIds.has(command.meta.commandId)).toBe(true);
    expect(isWorkspaceDirty(result.session.workspace, result.session.savepoint)).toBe(true);
  });

  it('rejects duplicate command ids after a command is applied', () => {
    const session = createProjectSession(createProject(), 0);
    const command = commandFor(session.project, 0, 'project.updateMetadata', { name: 'First Name' });
    const applied = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp));
    const duplicate = {
      ...command,
      meta: { ...command.meta, expectedRevision: applied.session.revision }
    };

    const result = executeProjectCommand(applied.session, duplicate, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: 'command.duplicate-id' }));
  });

  it('rejects duplicate command ids after a command is applied without a history entry', () => {
    const session = createProjectSession(createProject(), 0);
    const command = commandFor(session.project, 0, 'project.updateMetadata', { name: 'No History Name' });
    const applied = executeProjectCommand(
      session,
      command,
      createFixedApplicationCommandContext(timestamp),
      { recordHistory: false }
    );
    const duplicate = {
      ...command,
      meta: { ...command.meta, expectedRevision: applied.session.revision }
    };

    const result = executeProjectCommand(applied.session, duplicate, createFixedApplicationCommandContext(timestamp));

    expect(applied.status).toBe('applied');
    expect(applied.historyEntry).toBeUndefined();
    expect(applied.session.history.entries).toHaveLength(0);
    expect(result.status).toBe('rejected');
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: 'command.duplicate-id' }));
  });

  it('undoes and redoes command history using recorded patches', () => {
    const session = createProjectSession(createProject(), 0);
    const command = commandFor(session.project, 0, 'screen.create', { name: 'Patch Screen' });

    const applied = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp));
    const createdScreenId = applied.changes.find((change) =>
      change.entityType === 'screen' && change.kind === 'created'
    )?.entityId;
    const undone = undoProjectSession(applied.session);
    const redone = undone ? redoProjectSession(undone) : null;

    expect(applied.status).toBe('applied');
    expect(createdScreenId).toBeTruthy();
    expect(undone?.project.screens[createdScreenId!]).toBeUndefined();
    expect(undone?.history.cursor).toBe(0);
    expect(redone?.project.screens[createdScreenId!]?.name).toBe('Patch Screen');
    expect(redone?.history.cursor).toBe(1);
  });

  it('records one history entry for an applied ChangeSet', () => {
    const session = createProjectSession(createProject(), 0);
    const changeSet: ProjectChangeSet = {
      changeSetId: 'metadata-screen',
      projectId: session.project.meta.id,
      expectedRevision: 0,
      timestamp,
      commands: [
        commandFor(session.project, 0, 'project.updateMetadata', { version: '2.0.0' }, 'metadata'),
        commandFor(session.project, 0, 'screen.create', { name: 'History Screen' }, 'screen')
      ]
    };

    const result = executeProjectChangeSet(session, changeSet, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('applied');
    expect(result.session.revision).toBe(1);
    expect(result.session.history.entries).toHaveLength(1);
    expect(result.session.history.entries[0]).toEqual(expect.objectContaining({
      kind: 'changeset',
      commandIds: ['metadata', 'screen'],
      label: 'metadata-screen'
    }));
  });
});

function createProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createBlankProject({ name: 'Application Session Test' })).project;
}

function commandFor<Type extends ProjectCommand['type']>(
  project: LcdBitmapProject,
  expectedRevision: number,
  type: Type,
  payload: Extract<ProjectCommand, { type: Type }>['payload'],
  commandId = type
): Extract<ProjectCommand, { type: Type }> {
  return {
    type,
    meta: meta(project, expectedRevision, commandId),
    payload
  } as Extract<ProjectCommand, { type: Type }>;
}

function meta(project: LcdBitmapProject, expectedRevision: number, commandId: string): CommandMetadata {
  return {
    commandId,
    projectId: project.meta.id,
    expectedRevision,
    actor: { id: 'test', type: 'system' },
    timestamp
  };
}

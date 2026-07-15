import { describe, expect, it } from 'vitest';
import {
  createFixedApplicationCommandContext,
  createProjectSession,
  executeProjectChangeSet,
  type CommandMetadata,
  type ProjectChangeSet,
  type ProjectCommand
} from '../../src/application';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { LcdBitmapProject } from '../../src/domain/project';

const timestamp = '2026-06-24T01:00:00.000Z';

describe('application ChangeSet execution', () => {
  it('applies multiple commands atomically with one session revision increment', () => {
    const session = createProjectSession(createProject(), 0);
    const changeSet: ProjectChangeSet = {
      changeSetId: 'changeset-create-rename',
      projectId: session.project.meta.id,
      expectedRevision: 0,
      commands: [
        commandFor(session.project, 'screen.create', { name: 'Diagnostics' }),
        commandFor(session.project, 'screen.rename', { screenId: 'diagnostics', name: 'Diagnostics Menu' })
      ]
    };

    const result = executeProjectChangeSet(session, changeSet, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('applied');
    expect(result.session.revision).toBe(1);
    expect(result.session.project.screens.diagnostics?.name).toBe('Diagnostics Menu');
    expect(result.session.project.fsm.states.diagnostics?.title).toBe('Diagnostics Menu');
    expect(result.changes.map((change) => change.kind)).toEqual(['created', 'created', 'updated']);
  });

  it('dry-runs a ChangeSet without mutating the caller session', () => {
    const session = createProjectSession(createProject(), 5);
    const changeSet: ProjectChangeSet = {
      changeSetId: 'changeset-dry-run',
      projectId: session.project.meta.id,
      expectedRevision: 5,
      commands: [
        commandFor(session.project, 'project.updateMetadata', { name: 'Dry Run Name' }, 5)
      ]
    };

    const result = executeProjectChangeSet(
      session,
      changeSet,
      createFixedApplicationCommandContext(timestamp),
      { dryRun: true }
    );

    expect(result.status).toBe('dry-run');
    expect(result.session).toBe(session);
    expect(session.project.meta.name).not.toBe('Dry Run Name');
    expect(result.candidate?.revision).toBe(6);
    expect(result.candidate?.project.meta.name).toBe('Dry Run Name');
  });

  it('rejects the full ChangeSet when the final candidate introduces a blocking validation error', () => {
    const session = createProjectSession(createProject(), 0);
    const changeSet: ProjectChangeSet = {
      changeSetId: 'changeset-delete-only-state',
      projectId: session.project.meta.id,
      expectedRevision: 0,
      commands: [
        commandFor(session.project, 'screen.delete', { screenId: session.project.screenOrder[0] })
      ]
    };

    const result = executeProjectChangeSet(session, changeSet, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('rejected');
    expect(result.session).toBe(session);
    expect(result.session.project.screenOrder).toHaveLength(1);
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: 'validation.blocking-error' }));
  });
});

function createProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createBlankProject({ name: 'ChangeSet Test' })).project;
}

function commandFor<Type extends ProjectCommand['type']>(
  project: LcdBitmapProject,
  type: Type,
  payload: Extract<ProjectCommand, { type: Type }>['payload'],
  expectedRevision = 0
): Extract<ProjectCommand, { type: Type }> {
  return {
    type,
    meta: meta(project, expectedRevision, type),
    payload
  } as Extract<ProjectCommand, { type: Type }>;
}

function meta(project: LcdBitmapProject, expectedRevision: number, type: string): CommandMetadata {
  return {
    commandId: `${type}-${expectedRevision}`,
    projectId: project.meta.id,
    expectedRevision,
    actor: { id: 'test', type: 'system' },
    timestamp
  };
}

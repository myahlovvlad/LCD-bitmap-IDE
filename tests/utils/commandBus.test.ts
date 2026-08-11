import { describe, expect, it } from 'vitest';
import {
  createFixedApplicationCommandContext,
  createProjectSession,
  executeProjectCommand,
  type CommandMetadata,
  type ProjectCommand
} from '../../src/application';
import { createBlankProject } from '../../src/entities/project/factory';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { LcdBitmapProject } from '../../src/domain/project';

const timestamp = '2026-06-24T00:00:00.000Z';

describe('application command bus', () => {
  it('applies a metadata command with a semantic change and revision increment', () => {
    const session = createProjectSession(createProject(), 0);
    const command = commandFor(session.project, 0, 'project.updateMetadata', {
      name: 'Commanded Project',
      version: '1.2.3'
    });

    const result = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('applied');
    expect(result.session.revision).toBe(1);
    expect(result.session.project.meta.name).toBe('Commanded Project');
    expect(result.session.project.meta.version).toBe('1.2.3');
    expect(result.session.project.meta.updatedAt).toBe(timestamp);
    expect(result.changes).toEqual([
      expect.objectContaining({
        kind: 'updated',
        entityType: 'project',
        entityId: session.project.meta.id,
        path: '/meta'
      })
    ]);
  });

  it('stores multiline backend process documentation through the command bus', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const processId = 'measure-process';
    project.backendProcesses[processId] = {
      id: processId,
      name: 'Measure sample',
      commands: ['measure']
    };
    const session = createProjectSession(project, 0);
    const description = 'Read sensor data.\nValidate the sample.\nPublish the result.';

    const result = executeProjectCommand(
      session,
      commandFor(project, 0, 'backendProcess.update', {
        processId,
        updates: { description }
      }),
      createFixedApplicationCommandContext(timestamp)
    );

    expect(result.status).toBe('applied');
    expect(result.session.project.backendProcesses[processId].description).toBe(description);
    expect(result.changes).toEqual([
      expect.objectContaining({ entityType: 'backend-process', entityId: processId })
    ]);
  });

  it('creates a state-local event with an explicit owner state', () => {
    const session = createProjectSession(createProject(), 0);
    const sourceStateId = session.project.fsm.stateOrder[0];

    const result = executeProjectCommand(
      session,
      commandFor(session.project, 0, 'fsm.event.add', {
        name: 'LOCAL_CONFIRM',
        scope: 'state',
        sourceStateId
      }),
      createFixedApplicationCommandContext(timestamp)
    );

    expect(result.status).toBe('applied');
    const createdEvent = result.session.project.fsm.events[result.session.project.fsm.eventOrder.at(-1)!];
    expect(createdEvent).toEqual(expect.objectContaining({
      name: 'LOCAL_CONFIRM',
      scope: 'state',
      sourceStateId
    }));
  });

  it('allocates distinct uppercase IDs for successive FSM events', () => {
    const session = createProjectSession(createProject(), 0);
    session.project.fsm.events = {
      EVENT: { id: 'EVENT', name: 'event', scope: 'global', sourceStateId: null }
    };
    session.project.fsm.eventOrder = ['EVENT'];

    const result = executeProjectCommand(
      session,
      commandFor(session.project, 0, 'fsm.event.add', { name: 'AUTO_DIAG_FILTER_DONE' }),
      createFixedApplicationCommandContext(timestamp)
    );

    expect(result.status).toBe('applied');
    expect(result.session.project.fsm.eventOrder).toEqual(['EVENT', 'EVENT-2']);
    expect(result.session.project.fsm.events['EVENT-2']).toEqual(expect.objectContaining({
      id: 'EVENT-2',
      name: 'AUTO_DIAG_FILTER_DONE'
    }));
  });

  it('dry-runs without changing the input session revision', () => {
    const session = createProjectSession(createProject(), 3);
    const command = commandFor(session.project, 3, 'screen.create', { name: 'Preview Screen' });

    const result = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp), { dryRun: true });

    expect(result.status).toBe('dry-run');
    expect(result.session).toBe(session);
    expect(session.revision).toBe(3);
    expect(result.candidate?.revision).toBe(4);
    expect(result.candidate?.project.screens['preview-screen']?.name).toBe('Preview Screen');
    expect(session.project.screens['preview-screen']).toBeUndefined();
  });

  it('rejects stale expected revisions before mutation', () => {
    const session = createProjectSession(createProject(), 2);
    const command = commandFor(session.project, 1, 'screen.create', { name: 'Stale' });

    const result = executeProjectCommand(session, command, createFixedApplicationCommandContext(timestamp));

    expect(result.status).toBe('rejected');
    expect(result.session).toBe(session);
    expect(result.diagnostics[0]).toEqual(expect.objectContaining({ code: 'command.revision-conflict' }));
  });

  it('deletes the initial screen without deleting its FSM state or introducing validation errors', () => {
    const validSession = createProjectSession(createProject(), 0);
    const deleteInitialScreen = commandFor(validSession.project, 0, 'screen.delete', {
      screenId: validSession.project.screenOrder[0]
    });

    const applied = executeProjectCommand(
      validSession,
      deleteInitialScreen,
      createFixedApplicationCommandContext(timestamp)
    );

    expect(applied.status).toBe('applied');
    expect(applied.session.project.screenOrder).toHaveLength(0);
    expect(applied.session.project.fsm.stateOrder).toHaveLength(1);
    expect(applied.session.project.fsm.states[applied.session.project.fsm.stateOrder[0]].initial).toBe(true);
    expect(applied.session.project.fsm.states[applied.session.project.fsm.stateOrder[0]].screenId).toBeNull();
  });

  it('allows existing unrelated validation debt', () => {
    const validSession = createProjectSession(createProject(), 0);
    const invalidProject = {
      ...validSession.project,
      fsm: {
        ...validSession.project.fsm,
        states: {
          ...validSession.project.fsm.states,
          [validSession.project.fsm.stateOrder[0]]: {
            ...validSession.project.fsm.states[validSession.project.fsm.stateOrder[0]],
            screenId: 'missing-screen'
          }
        }
      }
    };
    const invalidSession = createProjectSession(invalidProject, 0);
    const rename = commandFor(invalidSession.project, 0, 'project.updateMetadata', { name: 'Still Editable' });

    const accepted = executeProjectCommand(invalidSession, rename, createFixedApplicationCommandContext(timestamp));

    expect(accepted.status).toBe('applied');
    expect(accepted.session.project.meta.name).toBe('Still Editable');
  });

  it('creates a linked FSM state and screen as one semantic operation', () => {
    const session = createProjectSession(createProject(), 0);
    const add = commandFor(session.project, 0, 'fsm.state.add', {});
    const added = executeProjectCommand(session, add, createFixedApplicationCommandContext(timestamp));
    const addedStateId = added.session.project.fsm.stateOrder.at(-1)!;
    const addedScreenId = added.session.project.fsm.states[addedStateId].screenId!;

    expect(added.status).toBe('applied');
    expect(added.session.project.screens[addedScreenId]?.name).toBe('State 2');
    expect(added.changes.map((change) => change.entityType)).toEqual(['fsm-state', 'screen']);

    const remove = commandFor(added.session.project, 1, 'fsm.state.delete', { stateId: addedStateId });
    const removed = executeProjectCommand(added.session, remove, createFixedApplicationCommandContext(timestamp));

    expect(removed.status).toBe('applied');
    expect(removed.session.project.fsm.states[addedStateId]).toBeUndefined();
    expect(removed.session.project.screens[addedScreenId]).toBeUndefined();
    expect(removed.session.revision).toBe(2);
  });
});

function createProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createBlankProject({ name: 'Command Bus Test' })).project;
}

function commandFor<Type extends ProjectCommand['type']>(
  project: LcdBitmapProject,
  expectedRevision: number,
  type: Type,
  payload: Extract<ProjectCommand, { type: Type }>['payload']
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

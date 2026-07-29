import { describe, expect, it } from 'vitest';
import {
  createFixedApplicationCommandContext,
  createProjectSession,
  executeProjectCommand,
  type ProjectCommand
} from '../../src/application';
import { createDemoProject } from '../../src/entities/project/demo';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('screen clone modes', () => {
  it('clones layout without creating an FSM state', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const sourceId = project.screenOrder[0];
    const session = createProjectSession(project, 0);
    const command: ProjectCommand = {
      type: 'screen.duplicateLayout',
      meta: {
        commandId: 'clone-layout-1',
        projectId: project.meta.id,
        expectedRevision: 0
      },
      payload: { screenId: sourceId }
    };
    const result = executeProjectCommand(
      session,
      command,
      createFixedApplicationCommandContext('2026-07-29T00:00:00.000Z')
    );
    const createdId = result.changes.find((change) => change.entityType === 'screen')?.entityId;

    expect(result.status).toBe('applied');
    expect(result.session.project.screenOrder).toHaveLength(project.screenOrder.length + 1);
    expect(result.session.project.fsm.stateOrder).toHaveLength(project.fsm.stateOrder.length);
    expect(result.session.project.screens[createdId!].objects.map((object) => object.id))
      .not.toEqual(project.screens[sourceId].objects.map((object) => object.id));
  });

  it('clones layout with a new FSM state in the existing full clone mode', () => {
    const project = migrateLegacySnapshot(createBlankProject({ name: 'Clone modes' })).project;
    const session = createProjectSession(project, 0);
    const command: ProjectCommand = {
      type: 'screen.duplicate',
      meta: {
        commandId: 'clone-state-1',
        projectId: project.meta.id,
        expectedRevision: 0
      },
      payload: { screenId: project.screenOrder[0] }
    };
    const result = executeProjectCommand(
      session,
      command,
      createFixedApplicationCommandContext('2026-07-29T00:00:00.000Z')
    );

    expect(result.status).toBe('applied');
    expect(result.session.project.screenOrder).toHaveLength(project.screenOrder.length + 1);
    expect(result.session.project.fsm.stateOrder).toHaveLength(project.fsm.stateOrder.length + 1);
  });
});

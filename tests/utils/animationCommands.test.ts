import { describe, expect, it } from 'vitest';
import {
  createFixedApplicationCommandContext,
  createProjectSession,
  executeProjectCommand,
  redoProjectSession,
  undoProjectSession,
  type ProjectCommand
} from '../../src/application';
import type { AnimationFrame, AnimationResource, LcdBitmapProject } from '../../src/domain';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

const timestamp = '2026-09-14T00:00:00.000Z';
const frame: AnimationFrame = { id: 'frame-1', bytes: [0xff], durationMs: 120 };

describe('animation commands', () => {
  it('adds an animation frame as one undoable command', () => {
    const session = createProjectSession(projectWithAnimation(), 0);
    const added = executeProjectCommand(session, command(session.project, 0, 'animation.frame.add', {
      animationId: 'spin', frame
    }), context());

    expect(added.status).toBe('applied');
    expect(added.session.project.animations.resources.spin.frames).toContainEqual(frame);
    expect(undoProjectSession(added.session)?.project.animations.resources.spin.frames).toEqual([]);
    expect(redoProjectSession(undoProjectSession(added.session)!)?.project.animations.resources.spin.frames).toEqual([frame]);
  });

  it('edits, reorders and removes animation frames through commands', () => {
    const initial = projectWithAnimation({ frames: [frame, { id: 'frame-2', bytes: [0], durationMs: 80 }] });
    const session = createProjectSession(initial, 0);
    const updated = executeProjectCommand(session, command(initial, 0, 'animation.frame.update', {
      animationId: 'spin', frameId: 'frame-1', updates: { durationMs: 200 }
    }), context());
    const reordered = executeProjectCommand(updated.session, command(updated.session.project, 1, 'animation.frame.reorder', {
      animationId: 'spin', frameIds: ['frame-2', 'frame-1']
    }), context());
    const removed = executeProjectCommand(reordered.session, command(reordered.session.project, 2, 'animation.frame.remove', {
      animationId: 'spin', frameId: 'frame-2'
    }), context());

    expect(removed.session.project.animations.resources.spin.frames).toEqual([{ ...frame, durationMs: 200 }]);
  });

  it('refuses a bitmap binding whose dimensions differ without changing the workspace', () => {
    const project = projectWithAnimation({ width: 9, height: 8 });
    const screen = project.screens[project.screenOrder[0]];
    const bitmap = { id: 'bitmap', type: 'bitmap' as const, name: 'Bitmap', x: 0, y: 0, width: 8, height: 8, bytes: [0], zIndex: 0, visible: true, locked: false, source: 'user' as const };
    const session = createProjectSession({ ...project, screens: { ...project.screens, [screen.id]: { ...screen, objects: [bitmap] } } }, 0);

    const result = executeProjectCommand(session, command(session.project, 0, 'animation.binding.set', {
      screenId: screen.id, objectId: bitmap.id, animationId: 'spin'
    }), context());

    expect(result.status).toBe('noop');
    expect(result.session).toBe(session);
    expect(result.session.workspace).toBe(session.workspace);
    expect(result.session.project.screens[screen.id].objects[0]).not.toHaveProperty('animationId', 'spin');
  });

  it('refuses resizing an animation resource when a bound target would no longer fit', () => {
    const project = projectWithAnimation();
    const screen = project.screens[project.screenOrder[0]];
    const bitmap = { id: 'bitmap', type: 'bitmap' as const, name: 'Bitmap', x: 0, y: 0, width: 8, height: 8, bytes: [0], zIndex: 0, visible: true, locked: false, source: 'user' as const, animationId: 'spin' };
    const session = createProjectSession({ ...project, screens: { ...project.screens, [screen.id]: { ...screen, animationId: 'spin', objects: [bitmap] } } }, 0);

    const result = executeProjectCommand(session, command(session.project, 0, 'animation.update', {
      animationId: 'spin', updates: { width: 9 }
    }), context());

    expect(result.status).toBe('noop');
    expect(result.session).toBe(session);
    expect(result.session.workspace).toBe(session.workspace);
    expect(result.session.project.animations.resources.spin.width).toBe(8);
    expect(result.session.project.screens[screen.id].animationId).toBe('spin');
    expect(result.session.project.screens[screen.id].objects[0]).toHaveProperty('animationId', 'spin');
  });

  it('clears matching screen and bitmap bindings when deleting an animation', () => {
    const project = projectWithAnimation();
    const screen = project.screens[project.screenOrder[0]];
    const bitmap = { id: 'bitmap', type: 'bitmap' as const, name: 'Bitmap', x: 0, y: 0, width: 8, height: 8, bytes: [0], zIndex: 0, visible: true, locked: false, source: 'user' as const, animationId: 'spin' };
    const session = createProjectSession({ ...project, screens: { ...project.screens, [screen.id]: { ...screen, animationId: 'spin', objects: [bitmap] } } }, 0);

    const result = executeProjectCommand(session, command(session.project, 0, 'animation.delete', { animationId: 'spin' }), context());

    expect(result.status).toBe('applied');
    expect(result.session.project.animations.resources.spin).toBeUndefined();
    expect(result.session.project.screens[screen.id].animationId).toBeNull();
    expect(result.session.project.screens[screen.id].objects[0]).toHaveProperty('animationId', null);
  });
});

function projectWithAnimation(overrides: Partial<AnimationResource> = {}): LcdBitmapProject {
  const project = migrateLegacySnapshot(createBlankProject({ name: 'Animation commands' })).project;
  project.animations = {
    resources: {
      spin: { id: 'spin', name: 'Spin', width: 8, height: 8, loop: true, frames: [], ...overrides }
    },
    order: ['spin']
  };
  return project;
}

function command(project: LcdBitmapProject, expectedRevision: number, type: string, payload: unknown): ProjectCommand {
  return {
    type,
    meta: { commandId: `${type}-${expectedRevision}`, projectId: project.meta.id, expectedRevision },
    payload
  } as ProjectCommand;
}

function context() {
  return createFixedApplicationCommandContext(timestamp);
}

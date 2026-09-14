import { describe, expect, it } from 'vitest';
import type { AnimationCatalog, LcdBitmapProject } from '../../src/domain';
import { createBlankProject } from '../../src/entities/project/factory';
import { renderScreenAt } from '../../src/renderer/core/animationRenderer';
import { unpackBytesToFrameBuffer } from '../../src/renderer/utils/render';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('animation renderer', () => {
  it('uses the active layer frame while preserving static pixels', () => {
    const project = projectWithLayerAnimation();

    const rendered = renderScreenAt(project, 'screen', { language: 'en' }, 60);

    expect(rendered[2][2]).toBe(true);
    expect(rendered[0][0]).toBe(true);
    expect(project.screens.screen.objects[1]).toMatchObject({ bytes: [0] });
  });

  it('uses a full-screen frame instead of static content', () => {
    const project = projectWithScreenAnimation();

    expect(renderScreenAt(project, 'screen', { language: 'en' }, 0))
      .toEqual(unpackBytesToFrameBuffer([0b00000100, 0b00000001], 2, 8));
  });
});

function projectWithLayerAnimation(): LcdBitmapProject {
  return projectFor({
    layer: {
      id: 'layer', name: 'Layer', width: 1, height: 1, loop: true,
      frames: [
        { id: 'off', bytes: [0], durationMs: 50 },
        { id: 'on', bytes: [1], durationMs: 50 }
      ]
    }
  }, [
    { id: 'static', type: 'rect', x: 0, y: 0, width: 1, height: 1, filled: true, zIndex: 0, visible: true, locked: false, source: 'user' },
    { id: 'animated', type: 'bitmap', name: 'Animated', x: 2, y: 2, width: 1, height: 1, bytes: [0], animationId: 'layer', zIndex: 1, visible: true, locked: false, source: 'user' }
  ]);
}

function projectWithScreenAnimation(): LcdBitmapProject {
  const project = projectFor({
    screen: {
      id: 'screen', name: 'Screen', width: 2, height: 8, loop: true,
      frames: [{ id: 'frame-a', bytes: [0b00000100, 0b00000001], durationMs: 100 }]
    }
  }, [
    { id: 'static', type: 'rect', x: 0, y: 0, width: 2, height: 8, filled: true, zIndex: 0, visible: true, locked: false, source: 'user' }
  ]);
  project.screens.screen.width = 2;
  project.screens.screen.height = 8;
  project.screens.screen.animationId = 'screen';
  return project;
}

function projectFor(resources: AnimationCatalog['resources'], objects: LcdBitmapProject['screens'][string]['objects']): LcdBitmapProject {
  const project = migrateLegacySnapshot(createBlankProject({ name: 'Animation renderer' })).project;
  project.screens = {
    screen: {
      id: 'screen', name: 'Screen', description: '', tags: [], width: 8, height: 8,
      objects, selectedObjectIds: [], createdAt: '2026-09-14T00:00:00.000Z', updatedAt: '2026-09-14T00:00:00.000Z'
    }
  };
  project.screenOrder = ['screen'];
  project.animations = { resources, order: Object.keys(resources) };
  return project;
}

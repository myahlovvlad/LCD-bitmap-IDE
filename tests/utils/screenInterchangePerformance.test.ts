import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { fingerprintScreenInterchange, projectToScreenInterchange, validateScreenInterchange } from '../../src/screen-interchange';
import type { CanvasObject, LcdBitmapProject, LcdScreen } from '../../src/domain';

describe('screen interchange performance envelope', () => {
  it('exports and validates a large authoring package within an interactive budget', () => {
    const project = largeProject(80, 25);
    const startedAt = performance.now();
    const packageV1 = projectToScreenInterchange(project);
    const validation = validateScreenInterchange(packageV1);
    const fingerprint = fingerprintScreenInterchange(packageV1);
    const elapsedMs = performance.now() - startedAt;

    expect(validation.ok).toBe(true);
    expect(packageV1.screens).toHaveLength(80);
    expect(fingerprint).toMatch(/^simv1-[0-9a-f]{16}$/);
    expect(elapsedMs).toBeLessThan(1000);
  });
});

function largeProject(screenCount: number, objectsPerScreen: number): LcdBitmapProject {
  const project = migrateLegacySnapshot(createBlankProject({ name: 'Screen Interchange Performance' })).project;
  const screens: Record<string, LcdScreen> = {};
  const screenOrder: string[] = [];
  const states = { ...project.fsm.states };
  const stateOrder: string[] = [];
  const timestamp = '2026-06-25T00:00:00.000Z';

  for (let screenIndex = 0; screenIndex < screenCount; screenIndex += 1) {
    const id = `screen-${screenIndex}`;
    screenOrder.push(id);
    stateOrder.push(id);
    screens[id] = {
      id,
      name: `Screen ${screenIndex}`,
      description: '',
      tags: [],
      width: 128,
      height: 64,
      objects: Array.from({ length: objectsPerScreen }, (_, objectIndex) => textObject(`text-${screenIndex}-${objectIndex}`, objectIndex)),
      selectedObjectIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    states[id] = {
      id,
      runtimeId: null,
      legacyIds: [],
      title: `Screen ${screenIndex}`,
      subsystem: 'performance',
      stateType: screenIndex === 0 ? 'initial' : 'process',
      origin: 'test',
      screenId: id,
      initial: screenIndex === 0,
      terminal: false
    };
  }

  return {
    ...project,
    screens,
    screenOrder,
    fsm: {
      ...project.fsm,
      states,
      stateOrder
    },
    bindings: {
      ...project.bindings,
      statesByScreenId: Object.fromEntries(screenOrder.map((id) => [id, [id]]))
    }
  };
}

function textObject(id: string, index: number): CanvasObject {
  return {
    id,
    type: 'text',
    text: { en: `Item ${index}`, ru: `Item ${index}`, zh: `Item ${index}` },
    x: (index * 7) % 120,
    y: (index * 3) % 56,
    fontVariant: '1',
    pendingTranslation: false,
    zIndex: index,
    visible: true,
    locked: false,
    source: 'generated'
  };
}

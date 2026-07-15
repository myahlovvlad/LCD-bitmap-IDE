import { describe, expect, it } from 'vitest';
import type { CanvasObject, LcdBitmapProject, LcdScreen } from '../../src/domain';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { projectToScreenInterchange } from '../../src/screen-interchange';
import {
  parseScreenDslJson,
  screenInterchangeToDslDocument,
  validateScreenDslPixelBudget,
  writeCanonicalScreenDslJson
} from '../../src/screen-dsl';

describe('Screen DSL performance envelope', () => {
  it('serializes, parses and validates a large explicit-layout package within an interactive budget', () => {
    const project = largeProject(40, 20);
    const startedAt = performance.now();
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(project));
    const json = writeCanonicalScreenDslJson(document);
    const parsed = parseScreenDslJson(json);
    const validation = parsed.document ? validateScreenDslPixelBudget(parsed.document) : { ok: false };
    const elapsedMs = performance.now() - startedAt;

    expect(parsed.ok).toBe(true);
    expect(validation.ok).toBe(true);
    expect(parsed.document?.screens).toHaveLength(40);
    expect(elapsedMs).toBeLessThan(1500);
  });
});

function largeProject(screenCount: number, objectsPerScreen: number): LcdBitmapProject {
  const project = migrateLegacySnapshot(createBlankProject({ name: 'Screen DSL Performance' })).project;
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

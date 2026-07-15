import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { PROJECT_SCHEMA_VERSION } from '../../src/domain/project';
import { generateScreenBinary } from '../../src/renderer/utils/codegen';
import { renderCanvasObjects } from '../../src/renderer/utils/render';
import type { CanvasObject, LcdScreen } from '../../src/domain';

describe('screen authoring model characterization', () => {
  it('keeps current object order as the screen authoring order', () => {
    const screen = screenWithObjects([
      rectObject('background', 0, 0, 8, 8, 0, true),
      textObject('title', 'Menu', 2, 2, 1),
      bitmapObject('logo', 4, 4, 4, 4, [0xff, 0x00, 0xff, 0x00])
    ]);

    expect(screen.objects.map((object) => object.id)).toEqual(['background', 'title', 'logo']);
    expect(screen.selectedObjectIds).toEqual(['title']);
  });

  it('keeps visible filtering and z-index raster precedence renderer-owned', () => {
    const frame = renderCanvasObjects(
      [
        rectObject('base', 0, 0, 4, 4, 0, true),
        invertObject('invert-top', 0, 0, 2, 2, 1),
        rectObject('hidden-fill', 0, 0, 4, 4, 2, false, false)
      ],
      { language: 'en', width: 8, height: 8 }
    );

    expect(frame[0][0]).toBe(false);
    expect(frame[1][1]).toBe(false);
    expect(frame[3][3]).toBe(true);
  });

  it('keeps stable sort behavior for equal z-index objects', () => {
    const firstWins = renderCanvasObjects(
      [
        rectObject('pixel', 0, 0, 1, 1, 0, true),
        invertObject('toggle', 0, 0, 1, 1, 0)
      ],
      { language: 'en', width: 4, height: 4 }
    );
    const secondWins = renderCanvasObjects(
      [
        invertObject('toggle', 0, 0, 1, 1, 0),
        rectObject('pixel', 0, 0, 1, 1, 0, true)
      ],
      { language: 'en', width: 4, height: 4 }
    );

    expect(firstWins[0][0]).toBe(false);
    expect(secondWins[0][0]).toBe(true);
  });

  it('keeps screen dimensions as export dimensions without changing the project schema', () => {
    const bytes = generateScreenBinary([lineObject('diagonal', 0, 0, 15, 15, 0)], 'en', undefined, 16, 16);

    expect(bytes).toHaveLength(32);
    expect(Array.from(bytes.slice(0, 8))).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  });

  it('keeps bundled demo screens linked by state id and screen order', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;

    expect(project.meta.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.screenOrder).toEqual(['main-menu', 'measure', 'save-result', 'error', 'glyph-test']);
    expect(project.screenOrder.map((screenId) => project.screens[screenId]?.id)).toEqual(project.screenOrder);
    expect(project.fsm.stateOrder.map((stateId) => project.fsm.states[stateId]?.screenId)).toEqual(project.screenOrder);
  });
});

function screenWithObjects(objects: CanvasObject[]): LcdScreen {
  return {
    id: 'screen-1',
    name: 'Screen 1',
    description: 'Characterization fixture',
    tags: ['fixture'],
    width: 128,
    height: 64,
    objects,
    selectedObjectIds: ['title'],
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z'
  };
}

function rectObject(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  filled: boolean,
  visible = true
): CanvasObject {
  return {
    id,
    type: 'rect',
    x,
    y,
    width,
    height,
    filled,
    zIndex,
    visible,
    locked: false,
    source: 'user'
  };
}

function invertObject(id: string, x: number, y: number, width: number, height: number, zIndex: number): CanvasObject {
  return {
    id,
    type: 'invert',
    x,
    y,
    width,
    height,
    zIndex,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function textObject(id: string, text: string, x: number, y: number, zIndex: number): CanvasObject {
  return {
    id,
    type: 'text',
    text: { en: text, ru: text, zh: text },
    x,
    y,
    fontVariant: '1',
    pendingTranslation: false,
    zIndex,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function bitmapObject(id: string, x: number, y: number, width: number, height: number, bytes: number[]): CanvasObject {
  return {
    id,
    type: 'bitmap',
    name: id,
    x,
    y,
    width,
    height,
    bytes,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function lineObject(id: string, x0: number, y0: number, x1: number, y1: number, zIndex: number): CanvasObject {
  return {
    id,
    type: 'line',
    x0,
    y0,
    x1,
    y1,
    zIndex,
    visible: true,
    locked: false,
    source: 'user'
  };
}

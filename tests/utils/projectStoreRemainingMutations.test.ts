import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { useProjectStore } from '../../src/renderer/store/projectStore';
import type { CanvasObject, FontMetadata, LcdScreen } from '../../src/domain';

describe('project store remaining mutation behavior', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('localStorage', createMemoryStorage());
    useProjectStore.getState().loadProjectSnapshot(
      migrateLegacySnapshot(createBlankProject({ name: 'Remaining Store Mutations' }))
    );
  });

  it('clamps display updates and resizes every screen', () => {
    useProjectStore.getState().createScreen('Second');
    useProjectStore.getState().updateDisplayConfig({
      width: 999,
      height: 1,
      colorMode: 'monochrome',
      packing: 'vertical-lsb'
    });

    const state = useProjectStore.getState();

    expect(state.project?.display).toEqual({ width: 512, height: 16, colorMode: 'monochrome', packing: 'vertical-lsb' });
    expect(Object.values(state.project?.screens ?? {}).map((screen) => [screen.width, screen.height])).toEqual([
      [512, 16],
      [512, 16]
    ]);
  });

  it('updates graph positions and ensures a missing state screen', () => {
    const store = useProjectStore.getState();
    const stateId = store.project!.fsm.stateOrder[0];

    store.updateGraphPosition(stateId, { x: 321, y: 123 });
    expect(useProjectStore.getState().project?.fsm.graphLayout[stateId]).toEqual({ x: 321, y: 123 });

    useProjectStore.setState((state) => ({
      project: {
        ...state.project!,
        screens: {},
        screenOrder: [],
        fsm: {
          ...state.project!.fsm,
          states: {
            ...state.project!.fsm.states,
            [stateId]: { ...state.project!.fsm.states[stateId], screenId: null }
          }
        }
      }
    }));

    const screenId = useProjectStore.getState().ensureStateScreen(stateId);
    const next = useProjectStore.getState();

    expect(screenId).toBe('main-menu-demo');
    expect(next.selectedScreenId).toBe('main-menu-demo');
    expect(next.project?.screens['main-menu-demo']?.name).toBe('Main Menu Demo');
    expect(next.project?.fsm.states[stateId].screenId).toBe('main-menu-demo');
  });

  it('duplicates, resizes and reorders screens with linked FSM state behavior', () => {
    const store = useProjectStore.getState();
    const originalScreenId = store.project!.screenOrder[0];

    store.addCanvasObject(originalScreenId, textObject('label-1'));
    store.duplicateScreen(originalScreenId);
    useProjectStore.getState().resizeScreen('main-menu-demo-copy', 2048, 4);
    useProjectStore.getState().reorderScreens(['main-menu-demo-copy']);

    const state = useProjectStore.getState();
    const duplicated = state.project?.screens['main-menu-demo-copy'];

    expect(duplicated?.name).toBe('Main Menu Demo Copy');
    expect(duplicated?.objects[0].id).toBe('canvas-main-menu-demo-copy-text-1');
    expect(duplicated?.width).toBe(1024);
    expect(duplicated?.height).toBe(8);
    expect(state.project?.screenOrder[0]).toBe('main-menu-demo-copy');
    expect(state.project?.fsm.states['main-menu-demo-copy']?.screenId).toBe('main-menu-demo-copy');
  });

  it('creates a project screen from a local template payload', () => {
    const template: LcdScreen = {
      id: 'template-one',
      name: 'Stored Template',
      description: '',
      tags: [],
      width: 128,
      height: 64,
      objects: [textObject('template-text')],
      selectedObjectIds: ['template-text'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    localStorage.setItem('lcd-bitmap-ide.screen-templates.v1', JSON.stringify([template]));

    useProjectStore.getState().createScreenFromTemplate('template-one');
    const state = useProjectStore.getState();
    const screen = state.project?.screens['stored-template'];

    expect(screen?.name).toBe('Stored Template Copy');
    expect(screen?.selectedObjectIds).toEqual(['template-text']);
    expect(screen?.objects[0].id).toBe('canvas-stored-template-text-1');
    expect(state.project?.fsm.states['stored-template']?.title).toBe('Stored Template Copy');
  });

  it('applies control-panel element mutations with grouping and cascade delete semantics', () => {
    const store = useProjectStore.getState();

    store.addControlElement('button');
    store.addControlElement('text');
    useProjectStore.getState().updateControlElement('button', { x: 200, y: 120, label: 'Run' });
    useProjectStore.getState().groupControlElements(['button', 'text']);
    useProjectStore.getState().alignControlElements(['button', 'text'], 'left');
    useProjectStore.getState().updateControlPanelSettings({ gridSize: 20, snapToGrid: false });

    let state = useProjectStore.getState();
    const groupId = state.project!.controlPanel.elementOrder.at(-1)!;

    expect(state.project?.controlPanel.elements.button).toMatchObject({ x: 200, label: 'Run', groupId });
    expect(state.project?.controlPanel.elements.text).toMatchObject({ x: 200, groupId });
    expect(state.project?.controlPanel.elements[groupId]).toMatchObject({ type: 'group', childIds: ['button', 'text'] });
    expect(state.project?.controlPanel.gridSize).toBe(20);
    expect(state.project?.controlPanel.snapToGrid).toBe(false);

    useProjectStore.getState().ungroupControlElements([groupId]);
    state = useProjectStore.getState();
    expect(state.project?.controlPanel.elements[groupId]).toBeUndefined();
    expect(state.project?.controlPanel.elements.button.groupId).toBeUndefined();

    useProjectStore.getState().deleteControlElements(['button']);
    expect(useProjectStore.getState().project?.controlPanel.elements.button).toBeUndefined();
  });

  it('updates canvas objects, selection, bitmap layers and selected deletion', () => {
    const screenId = useProjectStore.getState().project!.screenOrder[0];
    const object = textObject('canvas-label');

    useProjectStore.getState().addCanvasObject(screenId, object);
    useProjectStore.getState().updateCanvasObject(screenId, { ...object, x: 42, y: 9 });
    useProjectStore.getState().setCanvasSelection(screenId, ['canvas-label']);
    useProjectStore.getState().addBitmapLayer(screenId, 'Imported bitmap', [1, 2, 3, 4]);

    let screen = useProjectStore.getState().project!.screens[screenId];
    const bitmap = screen.objects.find((item) => item.type === 'bitmap');

    expect(screen.objects.find((item) => item.id === 'canvas-label')).toMatchObject({ x: 42, y: 9 });
    expect(screen.selectedObjectIds).toEqual([bitmap?.id]);
    expect(bitmap).toMatchObject({ name: 'Imported bitmap', width: screen.width, height: screen.height, bytes: [1, 2, 3, 4] });

    useProjectStore.getState().setCanvasSelection(screenId, ['canvas-label']);
    useProjectStore.getState().deleteSelectedCanvasObjects(screenId);
    screen = useProjectStore.getState().project!.screens[screenId];

    expect(screen.objects.some((item) => item.id === 'canvas-label')).toBe(false);
    expect(screen.objects.some((item) => item.id === bitmap?.id)).toBe(true);
    expect(screen.selectedObjectIds).toEqual([]);
  });

  it('stores font glyph edits, imported font metadata and saved measurements as project-associated auxiliary state', () => {
    const stateId = useProjectStore.getState().project!.fsm.stateOrder[0];
    const metadata: FontMetadata = {
      id: 'font-import-1',
      name: 'Imported',
      sourceFormat: 'bdf',
      variant: '1',
      glyphCount: 1,
      createdAt: '2026-06-24T00:00:00.000Z'
    };

    useProjectStore.getState().updateGlyph('1', 'Z', { width: 3, data: ['###'] });
    useProjectStore.getState().importFontGlyphs('1', { Q: { width: 2, data: ['##'] } }, metadata, 'merge');
    useProjectStore.getState().addSavedMeasurement(stateId, 'A540', '0.123');

    let state = useProjectStore.getState();
    const measurement = state.savedMeasurements[0];

    expect(state.fontGlyphs['1'].Z).toEqual({ width: 3, data: ['###'] });
    expect(state.fontGlyphs['1'].Q).toEqual({ width: 2, data: ['##'] });
    expect(state.loadedFonts[0]).toEqual(metadata);
    expect(measurement).toMatchObject({ stateId, label: 'A540', value: '0.123', note: '' });

    useProjectStore.getState().updateSavedMeasurement({ ...measurement, label: 'A600', value: '0.456' });
    state = useProjectStore.getState();
    expect(state.savedMeasurements[0]).toMatchObject({ label: 'A600', value: '0.456' });

    useProjectStore.getState().deleteSavedMeasurement(measurement.id);
    expect(useProjectStore.getState().savedMeasurements).toEqual([]);
  });
});

function textObject(id: string): CanvasObject {
  return {
    id,
    type: 'text',
    text: { en: 'Label', ru: 'Label', zh: 'Label' },
    x: 2,
    y: 3,
    fontVariant: '1',
    pendingTranslation: false,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function createMemoryStorage(): Storage {
  let values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => {
      values = new Map();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

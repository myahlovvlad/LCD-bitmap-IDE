import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../src/renderer/store/projectStore';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { CanvasObject } from '../../src/renderer/types/domain';

describe('project store command adapter', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProjectSnapshot(
      migrateLegacySnapshot(createBlankProject({ name: 'Store Adapter Test' }))
    );
  });

  it('increments the session revision and history when metadata is updated through the command bus', () => {
    const store = useProjectStore.getState();

    store.updateProjectMetadata({ name: 'Revisioned Name' });
    const next = useProjectStore.getState();

    expect(next.revision).toBe(1);
    expect(next.project?.meta.name).toBe('Revisioned Name');
    expect(next.undoStack).toHaveLength(1);
    expect(next.canUndo).toBe(true);
  });

  it('creates a screen and linked FSM state through the command adapter', () => {
    useProjectStore.getState().createScreen('Diagnostics');
    const state = useProjectStore.getState();
    const fsmState = state.project?.fsm.states.diagnostics;

    expect(state.revision).toBe(1);
    expect(state.selectedScreenId).toBe('diagnostics');
    expect(state.project?.screens.diagnostics?.name).toBe('Diagnostics');
    expect(fsmState?.screenId).toBe('diagnostics');
    expect(state.project?.bindings.statesByScreenId.diagnostics).toEqual(['diagnostics']);
  });

  it('renames linked screen and FSM state title consistently', () => {
    useProjectStore.getState().createScreen('Diagnostics');
    useProjectStore.getState().renameScreen('diagnostics', 'Diagnostics Menu');
    const state = useProjectStore.getState();

    expect(state.revision).toBe(2);
    expect(state.project?.screens.diagnostics?.name).toBe('Diagnostics Menu');
    expect(state.project?.fsm.states.diagnostics?.title).toBe('Diagnostics Menu');
  });

  it('deletes a screen with its linked FSM state and preserves first selection', () => {
    useProjectStore.getState().createScreen('Diagnostics');
    useProjectStore.getState().deleteScreen('diagnostics');
    const state = useProjectStore.getState();

    expect(state.revision).toBe(2);
    expect(state.project?.screens.diagnostics).toBeUndefined();
    expect(state.project?.fsm.states.diagnostics).toBeUndefined();
    expect(state.selectedScreenId).toBe(state.project?.screenOrder[0]);
    expect(state.selectedStateId).toBe(state.project?.fsm.stateOrder[0]);
  });

  it('captures the first drag update as command history for undo', () => {
    const screenId = useProjectStore.getState().project!.screenOrder[0];
    const object: CanvasObject = {
      id: 'drag-object',
      type: 'rect',
      x: 1,
      y: 2,
      width: 10,
      height: 8,
      filled: false,
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user'
    };

    useProjectStore.getState().addCanvasObject(screenId, object);
    useProjectStore.getState().captureHistory();
    useProjectStore.getState().setCanvasSelection(screenId, [object.id]);
    useProjectStore.getState().updateCanvasObject(screenId, { ...object, x: 11 }, { history: false });
    useProjectStore.getState().updateCanvasObject(screenId, { ...object, x: 21 }, { history: false });

    const moved = useProjectStore.getState();
    expect(moved.pendingHistoryCapture).toBe(false);
    expect(moved.undoStack).toHaveLength(2);
    expect(moved.project?.screens[screenId]?.objects.find((item) => item.id === object.id)?.x).toBe(21);

    useProjectStore.getState().undo();
    const undone = useProjectStore.getState();
    expect(undone.project?.screens[screenId]?.objects.find((item) => item.id === object.id)?.x).toBe(1);
  });
});

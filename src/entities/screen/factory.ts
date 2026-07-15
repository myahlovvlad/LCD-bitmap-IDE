/**
 * @module entities/screen/factory
 * @description Factories for creating, duplicating and exporting LCD screens.
 * They keep Screen Manager operations deterministic and history-friendly.
 */

import { DEFAULT_DISPLAY_CONFIG, type CanvasData, type CanvasObject, type LegacyFsmState as FsmState } from '../../domain';
import { sanitizePlainText } from '../../shared/lib/security';

/** Creates a screen canvas and matching FSM state. */
export function createScreenState(index: number, name = `Screen ${index + 1}`): {
  state: FsmState;
  canvas: CanvasData;
  layout: { x: number; y: number };
} {
  const now = new Date().toISOString();
  const id = `screen-${Date.now()}-${index + 1}`;
  const title = sanitizePlainText(name, 160) || `Screen ${index + 1}`;
  return {
    state: {
      id,
      runtimeId: null,
      legacyIds: [],
      title,
      subsystem: 'lcd-project',
      stateType: 'screen',
      origin: 'user',
      sourceLcd: [],
      initial: index === 0,
      final: false
    },
    canvas: {
      stateId: id,
      width: DEFAULT_DISPLAY_CONFIG.width,
      height: DEFAULT_DISPLAY_CONFIG.height,
      objects: [],
      selectedObjectIds: [],
      updatedAt: now
    },
    layout: { x: 80 + (index % 4) * 190, y: 80 + Math.floor(index / 4) * 120 }
  };
}

/** Deep-clones a canvas object list and rewrites object IDs for a duplicated screen. */
export function cloneScreenObjects(objects: readonly CanvasObject[], newScreenId: string): CanvasObject[] {
  return objects.map((object, index) => ({
    ...JSON.parse(JSON.stringify(object)),
    id: `canvas-${newScreenId}-${object.type}-${index + 1}`,
    zIndex: index
  }) as CanvasObject);
}

import {
  CANVAS_OBJECT_DEFAULTS,
  DEFAULT_LANGUAGE,
  DEFAULT_DISPLAY_CONFIG,
  DISPLAY_CONSTRAINTS
} from '../config/constants';
import type {
  CanvasData,
  FsmState,
  FsmTransition,
  GraphPosition,
  ImportedProjectModel,
  Project,
  TextCanvasObject
} from '../types/domain';
import type { RawFsmModel, RawFsmState, RawFsmTransition } from '../types/fsmModel';

const IMPORT_USER = 'system-import';

export function importFsmModel(rawModel: RawFsmModel): ImportedProjectModel {
  const now = new Date().toISOString();
  const rawStates = rawModel.states ?? [];
  const rawTransitions = rawModel.transitions ?? [];
  const stateOrder = rawStates.map((state) => state.id);
  const transitionOrder: string[] = [];
  const states: Record<string, FsmState> = {};
  const transitions: Record<string, FsmTransition> = {};
  const canvasByStateId: Record<string, CanvasData> = {};

  for (const [index, rawState] of rawStates.entries()) {
    states[rawState.id] = mapState(rawState, index);
    canvasByStateId[rawState.id] = createCanvasData(rawState, now);
  }

  rawTransitions.forEach((rawTransition, index) => {
    const transition = mapTransition(rawTransition, index);
    transitions[transition.id] = transition;
    transitionOrder.push(transition.id);
  });

  const project: Project = {
    id: slugify(rawModel.project ?? 'spectrodesigner-project'),
    name: rawModel.project ?? 'SpectroDesigner Project',
    version: rawModel.version ?? '0.1.0',
    modelId: 'Universal-LCD-128x64',
    firmwareVersion: null,
    author: null,
    lastModified: now,
    display: DEFAULT_DISPLAY_CONFIG,
    states,
    transitions,
    canvasByStateId,
    graphLayout: normalizeLayouts(rawModel.layouts),
    auditTrail: [
      {
        id: `audit-${now}`,
        timestamp: now,
        user: IMPORT_USER,
        entityType: 'project',
        entityId: slugify(rawModel.project ?? 'spectrodesigner-project'),
        operation: 'import',
        newValue: {
          states: rawStates.length,
          transitions: rawTransitions.length,
          sourceLanguage: DEFAULT_LANGUAGE
        },
        reason: 'Initial FSM model import'
      }
    ]
  };

  return {
    project,
    stateOrder,
    transitionOrder
  };
}

function mapState(rawState: RawFsmState, index: number): FsmState {
  return {
    id: rawState.id,
    runtimeId: rawState.runtime_id ?? null,
    legacyIds: rawState.legacy ?? [],
    title: rawState.title ?? rawState.id,
    subsystem: rawState.subsystem ?? 'unknown',
    stateType: rawState.type ?? 'screen',
    origin: rawState.origin ?? 'unknown',
    sourceLcd: rawState.lcd ?? [],
    initial: index === 0,
    final: false
  };
}

function mapTransition(rawTransition: RawFsmTransition, index: number): FsmTransition {
  const from = rawTransition.frm ?? rawTransition.from ?? 'UNKNOWN';
  const trigger = rawTransition.trigger ?? 'unknown';
  const id =
    rawTransition.id ??
    `transition-${String(index + 1).padStart(3, '0')}-${slugify(from)}-${slugify(trigger)}-${slugify(rawTransition.to)}`;

  return {
    id,
    from,
    to: rawTransition.to,
    trigger,
    kind: rawTransition.kind ?? 'navigation',
    condition: rawTransition.condition ?? null,
    source: rawTransition.source ?? null,
    cliCommands: normalizeCliCommands(rawTransition)
  };
}

function createCanvasData(rawState: RawFsmState, now: string): CanvasData {
  const sourceLines = rawState.lcd ?? [];
  const objects = sourceLines
    .map((line, index) => createTextObject(rawState.id, line, index))
    .filter((object): object is TextCanvasObject => object !== null);

  return {
    stateId: rawState.id,
    width: DISPLAY_CONSTRAINTS.width,
    height: DISPLAY_CONSTRAINTS.height,
    objects,
    selectedObjectIds: [],
    updatedAt: now
  };
}

function createTextObject(
  stateId: string,
  line: string,
  lineIndex: number
): TextCanvasObject | null {
  if (line.length === 0) {
    return null;
  }

  const y = DISPLAY_CONSTRAINTS.defaultTextY + lineIndex * DISPLAY_CONSTRAINTS.textLineHeight;
  if (y > DISPLAY_CONSTRAINTS.maxY) {
    return null;
  }

  return {
    id: `canvas-${slugify(stateId)}-text-${String(lineIndex + 1).padStart(2, '0')}`,
    type: 'text',
    text: {
      en: '',
      ru: line
    },
    x: DISPLAY_CONSTRAINTS.defaultTextX,
    y,
    zIndex: lineIndex,
    visible: CANVAS_OBJECT_DEFAULTS.visible,
    locked: CANVAS_OBJECT_DEFAULTS.locked,
    source: 'fsm-lcd-import',
    fontVariant: CANVAS_OBJECT_DEFAULTS.fontVariant,
    pendingTranslation: true
  };
}

function normalizeLayouts(
  layouts: RawFsmModel['layouts']
): Record<string, GraphPosition> {
  if (!layouts) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(layouts)
      .filter(([, position]) => Number.isFinite(position.x) && Number.isFinite(position.y))
      .map(([stateId, position]) => [stateId, { x: position.x, y: position.y }])
  );
}

function normalizeCliCommands(rawTransition: RawFsmTransition): string[] {
  const value = rawTransition.cliCommands ?? rawTransition.cli_command ?? [];
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

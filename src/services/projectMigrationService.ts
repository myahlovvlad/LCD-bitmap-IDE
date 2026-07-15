import { createMutableFontGlyphs, type FontGlyphs } from '../domain/fonts';
import { readProjectPayload } from './projectInterop';
import type {
  CanvasData,
  LegacyFsmTransition as LegacyTransition,
  LanguageCode,
  LegacyProject
} from '../domain';
import {
  PROJECT_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION_LEGACY,
  rebuildProjectBindings,
  type BackendProcess,
  type ControlPanelButton,
  type ControlPanelElement,
  type ControlPanelModel,
  type FsmEvent,
  type FsmTransition,
  type LcdBitmapProject,
  type LcdScreen,
  type ProjectFileV5,
  type ProjectSnapshotV5
} from '../domain/project';
import { validateProject } from './projectValidationService';

const DEFAULT_DEVICE_TOKENS = {
  panelBackground: '#315f45',
  panelStroke: '#17251d',
  buttonFill: '#e5e7eb',
  buttonStroke: '#1f2937',
  buttonText: '#111827',
  displayBackground: '#87aa5c',
  displayPixelOn: '#202a1b',
  displayPixelOff: 'rgba(32, 42, 27, 0.08)',
  labelText: '#f3f4f6'
} as const;

export function migrateProject(input: unknown): ProjectSnapshotV5 {
  const v5 = readV5Payload(input);
  if (v5) {
    const project = normalizeV5Project(v5.project);
    return { ...v5, project };
  }

  const legacy = readProjectPayload(input);
  if (!legacy) {
    throw new Error('Unsupported or invalid project format.');
  }
  return {
    project: migrateLegacyProject(legacy.project, legacy.stateOrder, legacy.transitionOrder, legacy.loadedFonts),
    language: legacy.language,
    fontGlyphs: legacy.fontGlyphs ?? createMutableFontGlyphs(),
    loadedFonts: legacy.loadedFonts,
    savedMeasurements: legacy.savedMeasurements
  };
}

export function migrateLegacySnapshot(snapshot: {
  project: LegacyProject;
  stateOrder: string[];
  transitionOrder: string[];
  fontGlyphs?: FontGlyphs;
  loadedFonts?: ProjectSnapshotV5['loadedFonts'];
  savedMeasurements?: ProjectSnapshotV5['savedMeasurements'];
  language?: LanguageCode;
}): ProjectSnapshotV5 {
  return {
    project: migrateLegacyProject(snapshot.project, snapshot.stateOrder, snapshot.transitionOrder, snapshot.loadedFonts),
    language: snapshot.language,
    fontGlyphs: snapshot.fontGlyphs ?? createMutableFontGlyphs(),
    loadedFonts: snapshot.loadedFonts,
    savedMeasurements: snapshot.savedMeasurements
  };
}

export function createProjectFileV5(snapshot: ProjectSnapshotV5, language: LanguageCode): ProjectFileV5 {
  const project = normalizeV5Project(snapshot.project);
  return {
    kind: 'lcd-bitmap-project',
    version: PROJECT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    language,
    project,
    fontGlyphs: snapshot.fontGlyphs,
    loadedFonts: snapshot.loadedFonts,
    savedMeasurements: snapshot.savedMeasurements
  };
}

function migrateLegacyProject(
  legacy: LegacyProject,
  stateOrder: string[],
  transitionOrder: string[],
  loadedFonts: ProjectSnapshotV5['loadedFonts'] = []
): LcdBitmapProject {
  const now = legacy.lastModified || new Date().toISOString();
  const screens = Object.fromEntries(
    Object.entries(legacy.canvasByStateId).map(([stateId, canvas]) => [
      stateId,
      canvasToScreen(stateId, legacy.states[stateId]?.title ?? stateId, canvas, now)
    ])
  );
  const eventByTrigger = new Map<string, FsmEvent>();
  const backendProcesses: Record<string, BackendProcess> = {};
  const transitions: Record<string, FsmTransition> = {};

  for (const transitionId of transitionOrder) {
    const legacyTransition = legacy.transitions[transitionId];
    if (!legacyTransition) {
      continue;
    }
    const event = getOrCreateEvent(eventByTrigger, legacyTransition.trigger);
    const backendProcessId = migrateBackendProcess(legacyTransition, backendProcesses);
    transitions[transitionId] = {
      id: transitionId,
      from: legacyTransition.from,
      to: legacyTransition.to,
      sourceHandle: legacyTransition.from === legacyTransition.to ? 's-right' : 's-right',
      targetHandle: legacyTransition.from === legacyTransition.to ? 't-right' : 't-left',
      trigger: { eventId: event.id },
      kind: legacyTransition.kind,
      condition: legacyTransition.condition,
      source: legacyTransition.source,
      backendProcessId
    };
  }

  const events = Object.fromEntries(Array.from(eventByTrigger.values()).map((event) => [event.id, event]));
  const project: LcdBitmapProject = {
    meta: {
      id: legacy.id,
      name: legacy.name,
      version: legacy.version,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      modelId: legacy.modelId,
      firmwareVersion: legacy.firmwareVersion,
      author: legacy.author,
      createdAt: legacy.auditTrail[0]?.timestamp ?? now,
      updatedAt: now
    },
    display: legacy.display,
    screens,
    screenOrder: Object.keys(screens),
    fonts: Object.fromEntries((loadedFonts ?? []).map((font) => [font.id, { ...font, glyphIds: [] }])),
    glyphs: {},
    fsm: {
      states: Object.fromEntries(
        stateOrder
          .map((stateId) => legacy.states[stateId])
          .filter(Boolean)
          .map((state) => [
            state.id,
            {
              id: state.id,
              runtimeId: state.runtimeId,
              legacyIds: state.legacyIds,
              title: state.title,
              subsystem: state.subsystem,
              stateType: state.initial ? 'initial' : state.final ? 'success' : state.stateType || 'process',
              origin: state.origin,
              screenId: screens[state.id] ? state.id : null,
              initial: state.initial,
              terminal: state.final
            }
          ])
      ),
      stateOrder: stateOrder.filter((id) => Boolean(legacy.states[id])),
      transitions,
      transitionOrder: transitionOrder.filter((id) => Boolean(transitions[id])),
      events,
      eventOrder: Array.from(eventByTrigger.values()).map((event) => event.id),
      graphLayout: legacy.graphLayout
    },
    controlPanel: createDefaultControlPanel(legacy.display.width, legacy.display.height, Array.from(eventByTrigger.values())),
    backendProcesses,
    bindings: { statesByScreenId: {}, buttonsByEventId: {}, transitionsByEventId: {} },
    validation: { issues: [], validatedAt: null }
  };
  return normalizeV5Project(project);
}

export function createDefaultControlPanel(width: number, height: number, events: readonly FsmEvent[]): ControlPanelModel {
  const panelWidth = Math.max(620, width * 4 + 280);
  const panelHeight = Math.max(360, height * 4 + 80);
  const display: ControlPanelElement = {
    id: 'device-display',
    type: 'display',
    x: 42,
    y: 46,
    width: width * 3,
    height: height * 3,
    rotation: 0,
    locked: false,
    visible: true,
    screenScale: 3
  };
  const elements: Record<string, ControlPanelElement> = { [display.id]: display };
  const elementOrder = [display.id];
  const buttonStartX = display.x + display.width + 52;
  events.forEach((event, index) => {
    const button: ControlPanelButton = {
      id: `button-${event.id}`,
      type: 'button',
      label: event.name,
      shape: 'rounded-rect',
      x: buttonStartX + (index % 3) * 92,
      y: 48 + Math.floor(index / 3) * 70,
      width: 78,
      height: 48,
      rotation: 0,
      locked: false,
      visible: true,
      fsmEventId: event.id,
      pressType: 'short',
      repeatMode: false
    };
    elements[button.id] = button;
    elementOrder.push(button.id);
  });
  return {
    width: panelWidth,
    height: panelHeight,
    backgroundColor: DEFAULT_DEVICE_TOKENS.panelBackground,
    gridSize: 10,
    gridEnabled: true,
    snapToGrid: true,
    elements,
    elementOrder,
    tokens: { ...DEFAULT_DEVICE_TOKENS }
  };
}

function normalizeV5Project(project: LcdBitmapProject): LcdBitmapProject {
  const states = Object.fromEntries(Object.entries(project.fsm.states).map(([id, state]) => [
    id,
    {
      ...state,
      stateType: state.initial
        ? 'initial'
        : state.terminal && state.stateType !== 'failure'
          ? 'success'
          : state.stateType || 'process'
    }
  ]));
  const transitions = Object.fromEntries(Object.entries(project.fsm.transitions).map(([id, transition]) => [
    id,
    {
      ...transition,
      sourceHandle: transition.sourceHandle ?? (transition.from === transition.to ? 's-right' : 's-right'),
      targetHandle: transition.targetHandle ?? (transition.from === transition.to ? 't-right' : 't-left'),
      trigger: {
        mechanism: 'event' as const,
        buttonId: null,
        timerMs: null,
        fact: null,
        ...transition.trigger
      }
    }
  ]));
  const normalized: LcdBitmapProject = {
    ...project,
    meta: { ...project.meta, schemaVersion: PROJECT_SCHEMA_VERSION },
    screenOrder: project.screenOrder.filter((id) => Boolean(project.screens[id])),
    fsm: {
      ...project.fsm,
      states,
      transitions,
      stateOrder: project.fsm.stateOrder.filter((id) => Boolean(states[id])),
      transitionOrder: project.fsm.transitionOrder.filter((id) => Boolean(transitions[id])),
      eventOrder: project.fsm.eventOrder.filter((id) => Boolean(project.fsm.events[id]))
    },
    controlPanel: project.controlPanel ?? createDefaultControlPanel(project.display.width, project.display.height, Object.values(project.fsm.events)),
    backendProcesses: project.backendProcesses ?? {},
    bindings: project.bindings ?? { statesByScreenId: {}, buttonsByEventId: {}, transitionsByEventId: {} },
    validation: project.validation ?? { issues: [], validatedAt: null },
    // v6 HMI extension fields — initialize empty if absent (v5→v6 migration)
    tags: project.tags ?? {},
    dataSources: project.dataSources ?? {},
    procedures: project.procedures ?? {},
    cliCatalog: project.cliCatalog ?? {},
    alarms: project.alarms ?? {},
    trends: project.trends ?? {}
  };
  normalized.bindings = rebuildProjectBindings(normalized);
  normalized.validation = {
    issues: validateProject(normalized),
    validatedAt: new Date().toISOString()
  };
  return normalized;
}

function readV5Payload(input: unknown): ProjectSnapshotV5 | null {
  if (!isRecord(input)) {
    return null;
  }
  const isKnownVersion =
    input.version === PROJECT_SCHEMA_VERSION || input.version === PROJECT_SCHEMA_VERSION_LEGACY;
  if (input.kind === 'lcd-bitmap-project' && isKnownVersion && isV5OrV6Project(input.project)) {
    return {
      project: input.project,
      language: readLanguage(input.language),
      fontGlyphs: input.fontGlyphs,
      loadedFonts: Array.isArray(input.loadedFonts) ? input.loadedFonts as ProjectSnapshotV5['loadedFonts'] : undefined,
      savedMeasurements: Array.isArray(input.savedMeasurements) ? input.savedMeasurements : undefined
    };
  }
  if (isV5OrV6Project(input)) {
    return { project: input };
  }
  return null;
}

function isV5OrV6Project(value: unknown): value is LcdBitmapProject {
  return isRecord(value)
    && isRecord(value.meta)
    && (value.meta.schemaVersion === PROJECT_SCHEMA_VERSION
      || value.meta.schemaVersion === PROJECT_SCHEMA_VERSION_LEGACY)
    && isRecord(value.screens)
    && isRecord(value.fsm)
    && isRecord(value.controlPanel);
}

function canvasToScreen(id: string, name: string, canvas: CanvasData, fallbackDate: string): LcdScreen {
  return {
    id,
    name,
    description: '',
    tags: [],
    width: canvas.width,
    height: canvas.height,
    objects: canvas.objects,
    selectedObjectIds: [],
    createdAt: canvas.updatedAt || fallbackDate,
    updatedAt: canvas.updatedAt || fallbackDate
  };
}

function getOrCreateEvent(events: Map<string, FsmEvent>, trigger: string): FsmEvent {
  const key = trigger.trim() || 'event';
  const existing = events.get(key);
  if (existing) {
    return existing;
  }
  const baseId = slugifyEventId(key);
  let id = baseId;
  let suffix = 2;
  const usedIds = new Set(Array.from(events.values()).map((event) => event.id));
  while (usedIds.has(id)) {
    id = `${baseId}_${suffix++}`;
  }
  const event = { id, name: key, legacyTrigger: trigger };
  events.set(key, event);
  return event;
}

function migrateBackendProcess(
  transition: LegacyTransition,
  processes: Record<string, BackendProcess>
): string | null {
  if (transition.cliCommands.length === 0) {
    return null;
  }
  const id = `process-${transition.id}`;
  processes[id] = {
    id,
    name: `${transition.id} commands`,
    commands: [...transition.cliCommands],
    description: `Migrated from transition ${transition.id}`
  };
  return id;
}

function slugifyEventId(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'EVENT';
}

function readLanguage(value: unknown): LanguageCode | undefined {
  return value === 'en' || value === 'ru' || value === 'zh' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

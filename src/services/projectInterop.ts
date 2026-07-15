import { DEFAULT_DISPLAY_CONFIG, type FontGlyphs, glyphs } from '../domain';
import { lcdProjectSchema, projectFilePayloadSchema, type LcdProject } from '../entities/project/schema';
import type {
  CanvasData,
  CanvasObject,
  DisplayConfig,
  FontMetadata,
  LegacyFsmState as FsmState,
  LegacyFsmTransition as FsmTransition,
  LanguageCode,
  LegacyProject as Project,
  SavedMeasurement
} from '../domain';

export interface ProjectSnapshot {
  project: Project;
  stateOrder: string[];
  transitionOrder: string[];
  fontGlyphs?: FontGlyphs;
  loadedFonts?: FontMetadata[];
  savedMeasurements?: SavedMeasurement[];
  language?: LanguageCode;
}

export interface ProjectFilePayload extends ProjectSnapshot {
  kind: 'spectrodesigner-project';
  version: 1 | 2 | 4;
  savedAt: string;
  language: LanguageCode;
}

export interface UniversalProjectPayload {
  format: 'lcd-project';
  version: 1;
  source: 'spectrodesigner';
  exportedAt: string;
  language: LanguageCode;
  display: DisplayConfig;
  states: Array<{
    id: string;
    title: string;
    subsystem: string;
    initial: boolean;
    final: boolean;
  }>;
  screens: Array<{
    id: string;
    title: string;
    width: number;
    height: number;
    objects: CanvasObject[];
  }>;
  transitions: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    kind: string;
    condition: string | null;
  }>;
}

export type LcdProjectPayload = LcdProject;

type UnknownRecord = Record<string, unknown>;

export function createProjectPayload({
  project,
  stateOrder,
  transitionOrder,
  fontGlyphs,
  loadedFonts,
  savedMeasurements,
  language
}: {
  project: Project;
  stateOrder: string[];
  transitionOrder: string[];
  fontGlyphs: FontGlyphs;
  loadedFonts: FontMetadata[];
  savedMeasurements: SavedMeasurement[];
  language: LanguageCode;
}): ProjectFilePayload {
  return {
    kind: 'spectrodesigner-project',
    version: 4,
    savedAt: new Date().toISOString(),
    language,
    project,
    stateOrder,
    transitionOrder,
    fontGlyphs,
    loadedFonts,
    savedMeasurements
  };
}

export function createLcdProjectPayload({
  project,
  stateOrder,
  transitionOrder,
  fontGlyphs
}: {
  project: Project;
  stateOrder: string[];
  transitionOrder: string[];
  fontGlyphs: FontGlyphs;
}): LcdProjectPayload {
  return {
    projectId: project.id,
    formatVersion: '1.0',
    name: project.name,
    deviceModel: project.modelId === 'Universal-LCD-128x64' ? 'Universal LCD 128x64' : project.modelId,
    firmwareVersion: project.firmwareVersion ?? '',
    author: project.author ?? '',
    createdAt: project.auditTrail[0]?.timestamp && typeof project.auditTrail[0]?.timestamp === 'string'
      ? project.auditTrail[0].timestamp
      : project.lastModified,
    updatedAt: project.lastModified,
    screens: stateOrder.map((stateId) => {
      const canvas = project.canvasByStateId[stateId];
      const state = project.states[stateId];
      return {
        id: stateId,
        name: state?.title ?? stateId,
        description: state?.sourceLcd.join('\n') ?? '',
        tags: [state?.subsystem ?? 'screen'].filter(Boolean),
        createdAt: canvas?.updatedAt ?? project.lastModified,
        updatedAt: canvas?.updatedAt ?? project.lastModified,
        author: project.author ?? '',
        objects: canvas?.objects ?? [],
        invertedRow: { enabled: false, y: 0, h: 8 },
        transitions: transitionOrder
          .map((transitionId) => project.transitions[transitionId])
          .filter((transition): transition is FsmTransition => Boolean(transition) && transition.from === stateId)
          .map((transition) => ({ transitionId: transition.id, targetScreenId: transition.to }))
      };
    }),
    stateMachine: {
      states: stateOrder.map((stateId) => project.states[stateId]).filter((state): state is FsmState => Boolean(state)),
      transitions: transitionOrder.map((transitionId) => project.transitions[transitionId]).filter((transition): transition is FsmTransition => Boolean(transition))
    },
    fontData: fontGlyphs
  };
}

export function readProjectPayload(payload: unknown): ProjectSnapshot | null {
  if (!isRecord(payload)) {
    return null;
  }

  const lcdProject = lcdProjectSchema.safeParse(payload);
  if (lcdProject.success) {
    return convertLcdProjectPayload(lcdProject.data);
  }

  const spectroSnapshot = readSpectroDesignerPayload(payload);
  if (spectroSnapshot) {
    return spectroSnapshot;
  }

  if (payload.format === 'lcd-project' || payload.kind === 'universal-lcd-project') {
    return convertUniversalPayload(payload);
  }

  if (Array.isArray(payload.objects) || Array.isArray(payload.smStates) || isRecord(payload.invertedRow)) {
    return convertLegacyLcdEditorPayload(payload);
  }

  return null;
}

export function createUniversalProjectPayload({
  project,
  stateOrder,
  transitionOrder,
  language
}: {
  project: Project;
  stateOrder: string[];
  transitionOrder: string[];
  language: LanguageCode;
}): UniversalProjectPayload {
  return {
    format: 'lcd-project',
    version: 1,
    source: 'spectrodesigner',
    exportedAt: new Date().toISOString(),
    language,
    display: project.display,
    states: stateOrder
      .map((stateId) => project.states[stateId])
      .filter((state): state is FsmState => Boolean(state))
      .map((state) => ({
        id: state.id,
        title: state.title,
        subsystem: state.subsystem,
        initial: state.initial,
        final: state.final
      })),
    screens: stateOrder
      .map((stateId) => project.canvasByStateId[stateId])
      .filter((canvas): canvas is CanvasData => Boolean(canvas))
      .map((canvas) => ({
        id: canvas.stateId,
        title: project.states[canvas.stateId]?.title ?? canvas.stateId,
        width: canvas.width,
        height: canvas.height,
        objects: canvas.objects
      })),
    transitions: transitionOrder
      .map((transitionId) => project.transitions[transitionId])
      .filter((transition): transition is FsmTransition => Boolean(transition))
      .map((transition) => ({
        id: transition.id,
        from: transition.from,
        to: transition.to,
        label: transition.trigger,
        kind: transition.kind,
        condition: transition.condition
      }))
  };
}

function readSpectroDesignerPayload(payload: UnknownRecord): ProjectSnapshot | null {
  const parsed = projectFilePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  const value = parsed.data;

  return {
    project: value.project as Project,
    stateOrder: value.stateOrder.filter(isString),
    transitionOrder: value.transitionOrder.filter(isString),
    fontGlyphs: value.fontGlyphs as FontGlyphs | undefined,
    loadedFonts: Array.isArray(value.loadedFonts) ? value.loadedFonts as FontMetadata[] : undefined,
    savedMeasurements: Array.isArray(value.savedMeasurements) ? value.savedMeasurements as SavedMeasurement[] : undefined,
    language: readLanguage(value.language)
  };
}

function convertLcdProjectPayload(payload: LcdProject): ProjectSnapshot {
  const now = new Date().toISOString();
  const stateOrder = payload.screens.map((screen) => slugify(screen.id));
  const states = Object.fromEntries(
    payload.screens.map((screen, index) => {
      const matchingState = payload.stateMachine.states.find((state) => state.id === screen.id);
      const id = stateOrder[index];
      return [
        id,
        matchingState
          ? { ...matchingState, id }
          : createState(id, screen.name, index, { subsystem: screen.tags[0] ?? 'lcd-project' })
      ];
    })
  );
  const canvasByStateId = Object.fromEntries(
    payload.screens.map((screen, index) => {
      const stateId = stateOrder[index];
      return [
        stateId,
        {
          stateId,
          width: DEFAULT_DISPLAY_CONFIG.width,
          height: DEFAULT_DISPLAY_CONFIG.height,
          objects: normalizeCanvasObjects(screen.objects, stateId),
          selectedObjectIds: [],
          updatedAt: screen.updatedAt
        } satisfies CanvasData
      ];
    })
  );
  const transitions = Object.fromEntries(
    payload.stateMachine.transitions.map((transition, index) => {
      const from = slugify(transition.from);
      const to = slugify(transition.to);
      const id = transition.id || `transition-${index + 1}-${from}-${to}`;
      return [id, { ...transition, id, from, to }];
    })
  );
  const transitionOrder = Object.keys(transitions);
  return {
    project: createProject({
      id: payload.projectId,
      name: payload.name,
      now: payload.updatedAt || now,
      display: DEFAULT_DISPLAY_CONFIG,
      states,
      transitions,
      canvasByStateId,
      graphLayout: createGraphLayout(stateOrder, [])
    }),
    stateOrder,
    transitionOrder,
    fontGlyphs: payload.fontData as FontGlyphs || glyphs,
    language: 'ru'
  };
}

function convertUniversalPayload(payload: UnknownRecord): ProjectSnapshot | null {
  const now = new Date().toISOString();
  const display = normalizeDisplay(payload.display);
  const screens = Array.isArray(payload.screens) ? payload.screens.filter(isRecord) : [];
  const rawStates = Array.isArray(payload.states) ? payload.states.filter(isRecord) : [];
  const stateRecords = screens.length > 0 ? screens : rawStates;

  if (stateRecords.length === 0) {
    return null;
  }

  const stateOrder = stateRecords.map((record, index) => readId(record, `screen-${index + 1}`));
  const states = Object.fromEntries(
    stateRecords.map((record, index) => {
      const id = stateOrder[index];
      const matchingState = rawStates.find((state) => readId(state, '') === id);
      return [id, createState(id, readString(record.title) || readString(matchingState?.title) || id, index, matchingState ?? record)];
    })
  );

  const canvasByStateId = Object.fromEntries(
    stateOrder.map((stateId, index) => {
      const screen = screens[index] ?? { id: stateId };
      return [
        stateId,
        {
          stateId,
          width: readNumber(screen.width, display.width),
          height: readNumber(screen.height, display.height),
          objects: normalizeCanvasObjects(Array.isArray(screen.objects) ? screen.objects : [], stateId),
          selectedObjectIds: [],
          updatedAt: now
        } satisfies CanvasData
      ];
    })
  );

  const transitionRecords = Array.isArray(payload.transitions) ? payload.transitions.filter(isRecord) : [];
  const transitions = Object.fromEntries(
    transitionRecords.map((record, index) => {
      const transition = createTransition(record, index, stateOrder);
      return [transition.id, transition];
    })
  );
  const transitionOrder = Object.keys(transitions);

  return {
    project: createProject({
      id: readString(payload.id) || readString(payload.name) || 'universal-lcd-project',
      name: readString(payload.name) || 'Universal LCD project',
      now,
      display,
      states,
      transitions,
      canvasByStateId,
      graphLayout: createGraphLayout(stateOrder, rawStates)
    }),
    stateOrder,
    transitionOrder,
    language: readLanguage(payload.language)
  };
}

function convertLegacyLcdEditorPayload(payload: UnknownRecord): ProjectSnapshot {
  const now = new Date().toISOString();
  const display = DEFAULT_DISPLAY_CONFIG;
  const legacyStates = Array.isArray(payload.smStates) ? payload.smStates.filter(isRecord) : [];
  const stateOrder = legacyStates.length > 0
    ? legacyStates.map((state, index) => readId(state, `screen-${index + 1}`))
    : ['screen-1'];
  const states = Object.fromEntries(
    stateOrder.map((stateId, index) => {
      const rawState = legacyStates[index];
      return [stateId, createState(stateId, readString(rawState?.label) || readString(rawState?.title) || stateId, index, rawState)];
    })
  );

  const objects = normalizeCanvasObjects(Array.isArray(payload.objects) ? payload.objects : [], stateOrder[0]);
  const invertedRow = isRecord(payload.invertedRow) ? payload.invertedRow : null;
  if (invertedRow && invertedRow.enabled !== false) {
    objects.push({
      id: `canvas-${stateOrder[0]}-invert-${Date.now()}`,
      type: 'invert',
      x: 0,
      y: readNumber(invertedRow.y, 0),
      width: display.width,
      height: Math.max(1, readNumber(invertedRow.h, 8)),
      zIndex: objects.length,
      visible: true,
      locked: false,
      source: 'prototype'
    });
  }

  const canvasByStateId = Object.fromEntries(
    stateOrder.map((stateId, index) => [
      stateId,
      {
        stateId,
        width: display.width,
        height: display.height,
        objects: index === 0 ? objects : [],
        selectedObjectIds: [],
        updatedAt: now
      } satisfies CanvasData
    ])
  );
  const transitionRecords = Array.isArray(payload.smTransitions) ? payload.smTransitions.filter(isRecord) : [];
  const transitions = Object.fromEntries(
    transitionRecords.map((record, index) => {
      const transition = createTransition(record, index, stateOrder);
      return [transition.id, transition];
    })
  );
  const transitionOrder = Object.keys(transitions);

  return {
    project: createProject({
      id: readString(payload.smName) || 'legacy-lcd-editor',
      name: readString(payload.smName) || 'Legacy LCD editor project',
      now,
      display,
      states,
      transitions,
      canvasByStateId,
      graphLayout: createGraphLayout(stateOrder, legacyStates)
    }),
    stateOrder,
    transitionOrder,
    language: readLanguage(payload.lang)
  };
}

function normalizeCanvasObjects(objects: unknown[], stateId: string): CanvasObject[] {
  return objects
    .map((object, index) => normalizeCanvasObject(object, stateId, index))
    .filter((object): object is CanvasObject => Boolean(object));
}

function normalizeCanvasObject(object: unknown, stateId: string, index: number): CanvasObject | null {
  if (!isRecord(object) || !isString(object.type)) {
    return null;
  }

  const base = {
    id: readString(object.id) || `canvas-${stateId}-${object.type}-${index + 1}`,
    zIndex: readNumber(object.zIndex, index),
    visible: object.visible !== false,
    locked: object.locked === true,
    source: 'prototype' as const
  };

  if (object.type === 'text') {
    const text = readString(object.text);
    const localized = isRecord(object.text)
      ? {
          en: readString(object.text.en) || readString(object.text.ru) || '',
          ru: readString(object.text.ru) || readString(object.text.en) || '',
          zh: readString(object.text.zh) || undefined
        }
      : { en: text, ru: text };
    return {
      ...base,
      type: 'text',
      text: localized,
      x: readNumber(object.x, 0),
      y: readNumber(object.y, 0),
      fontVariant: readString(object.fontVariant) === '2' || readString(object.variant) === '2' ? '2' : '1',
      pendingTranslation: false
    };
  }

  if (object.type === 'line') {
    return {
      ...base,
      type: 'line',
      x0: readNumber(object.x0, 0),
      y0: readNumber(object.y0, 0),
      x1: readNumber(object.x1, 0),
      y1: readNumber(object.y1, 0)
    };
  }

  if (object.type === 'rect') {
    const hasCorners = Number.isFinite(object.x0) && Number.isFinite(object.x1);
    const x = hasCorners ? Math.min(readNumber(object.x0, 0), readNumber(object.x1, 0)) : readNumber(object.x, 0);
    const y = hasCorners ? Math.min(readNumber(object.y0, 0), readNumber(object.y1, 0)) : readNumber(object.y, 0);
    return {
      ...base,
      type: 'rect',
      x,
      y,
      width: hasCorners ? Math.max(1, Math.abs(readNumber(object.x1, x) - readNumber(object.x0, x)) + 1) : Math.max(1, readNumber(object.width, 1)),
      height: hasCorners ? Math.max(1, Math.abs(readNumber(object.y1, y) - readNumber(object.y0, y)) + 1) : Math.max(1, readNumber(object.height, 1)),
      filled: object.filled === true
    };
  }

  if (object.type === 'bitmap' && Array.isArray(object.bytes)) {
    return {
      ...base,
      type: 'bitmap',
      name: readString(object.name) || base.id,
      x: readNumber(object.x, 0),
      y: readNumber(object.y, 0),
      width: Math.max(1, readNumber(object.width, DEFAULT_DISPLAY_CONFIG.width)),
      height: Math.max(1, readNumber(object.height, DEFAULT_DISPLAY_CONFIG.height)),
      bytes: object.bytes.map((byte) => readNumber(byte, 0) & 0xff)
    };
  }

  if (object.type === 'invert') {
    return {
      ...base,
      type: 'invert',
      x: readNumber(object.x, 0),
      y: readNumber(object.y, 0),
      width: Math.max(1, readNumber(object.width, DEFAULT_DISPLAY_CONFIG.width)),
      height: Math.max(1, readNumber(object.height, 8))
    };
  }

  return null;
}

function createProject({
  id,
  name,
  now,
  display,
  states,
  transitions,
  canvasByStateId,
  graphLayout
}: {
  id: string;
  name: string;
  now: string;
  display: DisplayConfig;
  states: Record<string, FsmState>;
  transitions: Record<string, FsmTransition>;
  canvasByStateId: Record<string, CanvasData>;
  graphLayout: Record<string, { x: number; y: number }>;
}): Project {
  const projectId = slugify(id);
  return {
    id: projectId,
    name,
    version: '1.0.0',
    modelId: 'Universal-LCD-128x64',
    firmwareVersion: null,
    author: null,
    lastModified: now,
    display,
    states,
    transitions,
    canvasByStateId,
    graphLayout,
    auditTrail: [
      {
        id: `audit-${Date.now()}`,
        timestamp: now,
        user: 'interop-import',
        entityType: 'project',
        entityId: projectId,
        operation: 'import',
        reason: 'Third-party project import'
      }
    ]
  };
}

function createState(id: string, title: string, index: number, rawState?: UnknownRecord): FsmState {
  return {
    id,
    runtimeId: null,
    legacyIds: [],
    title,
    subsystem: readString(rawState?.subsystem) || 'imported',
    stateType: readString(rawState?.stateType) || 'screen',
    origin: readString(rawState?.origin) || 'third-party',
    sourceLcd: [],
    initial: rawState?.initial === true || index === 0,
    final: rawState?.final === true
  };
}

function createTransition(record: UnknownRecord, index: number, stateOrder: string[]): FsmTransition {
  const from = readString(record.from) || readString(record.frm) || stateOrder[0] || 'screen-1';
  const to = readString(record.to) || stateOrder[0] || from;
  const trigger = readString(record.trigger) || readString(record.label) || `event-${index + 1}`;
  return {
    id: readString(record.id) || `transition-${index + 1}-${slugify(from)}-${slugify(to)}`,
    from,
    to,
    trigger,
    kind: readString(record.kind) || 'navigation',
    condition: readString(record.condition) || null,
    source: readString(record.source) || 'third-party',
    cliCommands: Array.isArray(record.cliCommands) ? record.cliCommands.filter(isString) : []
  };
}

function createGraphLayout(stateOrder: string[], rawStates: UnknownRecord[]): Record<string, { x: number; y: number }> {
  return Object.fromEntries(
    stateOrder.map((stateId, index) => {
      const rawState = rawStates[index];
      return [
        stateId,
        {
          x: readNumber(rawState?.x, 80 + (index % 4) * 190),
          y: readNumber(rawState?.y, 80 + Math.floor(index / 4) * 120)
        }
      ];
    })
  );
}

function normalizeDisplay(value: unknown): DisplayConfig {
  if (!isRecord(value)) {
    return DEFAULT_DISPLAY_CONFIG;
  }

  return {
    width: Math.max(16, readNumber(value.width, DEFAULT_DISPLAY_CONFIG.width)),
    height: Math.max(16, readNumber(value.height, DEFAULT_DISPLAY_CONFIG.height)),
    colorMode: 'monochrome',
    packing: 'vertical-lsb'
  };
}

function readId(record: UnknownRecord, fallback: string): string {
  return slugify(readString(record.id) || fallback);
}

function readLanguage(value: unknown): LanguageCode | undefined {
  return value === 'en' || value === 'ru' || value === 'zh' ? value : undefined;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

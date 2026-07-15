import { create } from 'zustand';
import { DEFAULT_LANGUAGE } from '../config/constants';
import {
  createMutableFontGlyphs,
  type FontGlyphs,
  type FontVariantKey,
  type Glyph
} from '../core/fonts';
import type { FontMergeMode } from '../utils/fontImport';
import type {
  CanvasObject,
  DisplayConfig,
  FontMetadata,
  LanguageCode,
  SavedMeasurement
} from '../types/domain';
import type { HmiTag, DataSource } from '../../domain/tag';
import type { BackendProcedure, CliCommandDefinition } from '../../domain/procedure';
import type { AlarmDefinition } from '../../domain/alarm';
import {
  rebuildProjectBindings,
  type ControlPanelElement,
  type FsmEvent,
  type FsmState,
  type FsmTransition,
  type LcdBitmapProject,
  type LcdScreen,
  type ProjectSnapshotV5,
  type ValidationIssue
} from '../../domain/project';
import { createDefaultControlPanel } from '../../services/projectMigrationService';
import { validateProject } from '../../services/projectValidationService';
import {
  type CommandHistoryEntry,
  createDefaultApplicationCommandContext,
  createProjectSession,
  createSessionFromWorkspace,
  executeProjectCommand,
  applyFsmScriptPreview,
  applyScreenDslPreview as applyScreenDslPreviewFacade,
  redoProjectSession,
  type FsmScriptPreview,
  type ProjectSession,
  type CommandMetadata,
  type ProjectCommand,
  type ProjectCommandResult,
  undoProjectSession
} from '../../application';
import type { ScreenDslPreviewResult } from '../../application/screenDsl/contracts';
import type { ApplyScreenDslPreviewResult } from '../../application/screenDsl/applyPreview';

type ProjectHistorySnapshot = CommandHistoryEntry;

interface ProjectStoreState {
  language: LanguageCode;
  session: ProjectSession | null;
  project: LcdBitmapProject | null;
  revision: number;
  selectedStateId: string | null;
  selectedScreenId: string | null;
  selectedTransitionId: string | null;
  selectedControlElementIds: string[];
  fontGlyphs: FontGlyphs;
  loadedFonts: FontMetadata[];
  savedMeasurements: SavedMeasurement[];
  undoStack: ProjectHistorySnapshot[];
  redoStack: ProjectHistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pendingHistoryCapture: boolean;
  setLanguage: (language: LanguageCode) => void;
  loadProjectSnapshot: (snapshot: ProjectSnapshotV5) => void;
  selectState: (stateId: string | null) => void;
  selectScreen: (screenId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  selectControlElements: (elementIds: string[]) => void;
  validate: () => ValidationIssue[];
  updateProjectMetadata: (updates: Partial<Pick<LcdBitmapProject['meta'], 'name' | 'version' | 'author' | 'firmwareVersion' | 'modelId'>>) => void;
  updateDisplayConfig: (display: DisplayConfig) => void;
  addFsmState: () => void;
  updateFsmState: (stateId: string, updates: Partial<FsmState>) => void;
  deleteFsmState: (stateId: string) => void;
  addFsmTransition: (from: string, to: string, eventId?: string, handles?: { sourceHandle?: string | null; targetHandle?: string | null }) => void;
  updateFsmTransition: (transitionId: string, updates: Partial<FsmTransition>) => void;
  deleteFsmTransition: (transitionId: string) => void;
  addFsmEvent: (name?: string) => void;
  updateFsmEvent: (eventId: string, updates: Partial<Pick<FsmEvent, 'name' | 'description'>>) => void;
  deleteFsmEvent: (eventId: string) => void;
  updateGraphPosition: (stateId: string, position: LcdBitmapProject['fsm']['graphLayout'][string]) => void;
  updateGraphPositions: (positions: LcdBitmapProject['fsm']['graphLayout']) => void;
  applyFsmScriptPreview: (preview: FsmScriptPreview) => ProjectCommandResult | null;
  applyScreenDslPreview: (preview: ScreenDslPreviewResult, sourceText: string) => ApplyScreenDslPreviewResult | null;
  ensureStateScreen: (stateId: string) => string | null;
  createScreen: (name?: string) => void;
  duplicateScreen: (screenId: string) => void;
  renameScreen: (screenId: string, name: string) => void;
  resizeScreen: (screenId: string, width: number, height: number) => void;
  deleteScreen: (screenId: string) => void;
  reorderScreens: (screenIds: string[]) => void;
  saveScreenTemplate: (screenId: string) => void;
  createScreenFromTemplate: (templateId: string) => void;
  addControlElement: (type: ControlPanelElement['type']) => void;
  updateControlElement: (elementId: string, updates: Partial<ControlPanelElement>, options?: { history?: boolean }) => void;
  deleteControlElements: (elementIds: string[]) => void;
  groupControlElements: (elementIds: string[]) => void;
  ungroupControlElements: (elementIds: string[]) => void;
  alignControlElements: (elementIds: string[], axis: 'left' | 'top' | 'center-x' | 'center-y') => void;
  updateControlPanelSettings: (updates: Partial<Pick<LcdBitmapProject['controlPanel'], 'width' | 'height' | 'gridEnabled' | 'snapToGrid' | 'gridSize' | 'backgroundColor'>>) => void;
  undo: () => void;
  redo: () => void;
  captureHistory: () => void;
  updateCanvasObject: (screenId: string, object: CanvasObject, options?: { history?: boolean }) => void;
  setCanvasSelection: (screenId: string, objectIds: string[]) => void;
  addCanvasObject: (screenId: string, object: CanvasObject) => void;
  addBitmapLayer: (screenId: string, name: string, bytes: number[]) => void;
  updateCanvasObjects: (screenId: string, objects: CanvasObject[], options?: { history?: boolean }) => void;
  deleteSelectedCanvasObjects: (screenId: string) => void;
  updateGlyph: (variant: FontVariantKey, char: string, glyph: Glyph) => void;
  importFontGlyphs: (variant: FontVariantKey, glyphs: Record<string, Glyph>, metadata: FontMetadata, mode: FontMergeMode) => void;
  addSavedMeasurement: (stateId: string, label: string, value: string) => void;
  updateSavedMeasurement: (measurement: SavedMeasurement) => void;
  deleteSavedMeasurement: (measurementId: string) => void;
  setHmiTags: (tags: Record<string, HmiTag>, dataSources?: Record<string, DataSource>) => void;
  upsertHmiTag: (tag: HmiTag) => void;
  deleteHmiTag: (tagId: string) => void;
  upsertHmiProcedure: (procedure: BackendProcedure) => void;
  deleteHmiProcedure: (procedureId: string) => void;
  upsertCliCommand: (command: CliCommandDefinition) => void;
  deleteCliCommand: (commandId: string) => void;
  upsertAlarm: (alarm: AlarmDefinition) => void;
  deleteAlarm: (alarmId: string) => void;
}

const SCREEN_TEMPLATES_KEY = 'lcd-bitmap-ide.screen-templates.v1';
let commandSequence = 0;

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  session: null,
  project: null,
  revision: 0,
  selectedStateId: null,
  selectedScreenId: null,
  selectedTransitionId: null,
  selectedControlElementIds: [],
  fontGlyphs: createMutableFontGlyphs(),
  loadedFonts: createInitialFontMetadata(),
  savedMeasurements: [],
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  pendingHistoryCapture: false,

  setLanguage: (language) => set({ language }),
  loadProjectSnapshot: (snapshot) => {
    const project = refreshProject(snapshot.project);
    const session = createProjectSession({
      project,
      fontGlyphs: snapshot.fontGlyphs as FontGlyphs | undefined ?? createMutableFontGlyphs(),
      loadedFonts: snapshot.loadedFonts ?? createInitialFontMetadata(),
      savedMeasurements: snapshot.savedMeasurements as SavedMeasurement[] | undefined ?? []
    });
    set({
      session,
      project: session.project,
      revision: 0,
      language: snapshot.language ?? DEFAULT_LANGUAGE,
      selectedStateId: project.fsm.stateOrder[0] ?? null,
      selectedScreenId: project.screenOrder[0] ?? null,
      selectedTransitionId: null,
      selectedControlElementIds: [],
      fontGlyphs: session.workspace.fontGlyphs,
      loadedFonts: session.workspace.loadedFonts,
      savedMeasurements: session.workspace.savedMeasurements,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      pendingHistoryCapture: false
    });
  },
  selectState: (selectedStateId) => set({ selectedStateId, selectedTransitionId: null }),
  selectScreen: (selectedScreenId) => set({ selectedScreenId }),
  selectTransition: (selectedTransitionId) => set({ selectedTransitionId }),
  selectControlElements: (selectedControlElementIds) => set({ selectedControlElementIds }),
  validate: () => {
    const project = get().project;
    if (!project) {
      return [];
    }
    const issues = validateProject(project);
    const nextProject = {
      ...project,
      validation: { issues, validatedAt: new Date().toISOString() }
    };
    const currentSession = get().session;
    const nextSession = currentSession
      ? sessionFromState({ ...get(), project: nextProject, revision: currentSession.revision })
      : null;
    set({
      project: nextProject,
      session: nextSession
    });
    return issues;
  },
  updateProjectMetadata: (updates) => commitProjectCommand(set, get, (state) => ({
    type: 'project.updateMetadata',
    meta: createCommandMeta(state, 'project.updateMetadata'),
    payload: updates
  })),
  updateDisplayConfig: (display) => commitProjectCommand(set, get, (state) => ({
      type: 'project.updateDisplayConfig',
      meta: createCommandMeta(state, 'project.updateDisplayConfig'),
      payload: { display }
  })),
  addFsmState: () => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.state.add',
    meta: createCommandMeta(state, 'fsm.state.add'),
    payload: {}
  }), { selectedStateId: 'last' }),
  updateFsmState: (stateId, updates) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.state.update',
    meta: createCommandMeta(state, 'fsm.state.update'),
    payload: { stateId, updates }
  })),
  deleteFsmState: (stateId) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.state.delete',
    meta: createCommandMeta(state, 'fsm.state.delete'),
    payload: { stateId }
  }), { selectedStateId: 'first' }),
  addFsmTransition: (from, to, eventId, handles) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.transition.add',
    meta: createCommandMeta(state, 'fsm.transition.add'),
    payload: { from, to, eventId, handles }
  })),
  updateFsmTransition: (transitionId, updates) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.transition.update',
    meta: createCommandMeta(state, 'fsm.transition.update'),
    payload: { transitionId, updates }
  })),
  deleteFsmTransition: (transitionId) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.transition.delete',
    meta: createCommandMeta(state, 'fsm.transition.delete'),
    payload: { transitionId }
  }), { selectedTransitionId: null }),
  addFsmEvent: (name) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.event.add',
    meta: createCommandMeta(state, 'fsm.event.add'),
    payload: { name }
  })),
  updateFsmEvent: (eventId, updates) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.event.update',
    meta: createCommandMeta(state, 'fsm.event.update'),
    payload: { eventId, updates }
  })),
  deleteFsmEvent: (eventId) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.event.delete',
    meta: createCommandMeta(state, 'fsm.event.delete'),
    payload: { eventId }
  })),
  updateGraphPosition: (stateId, position) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.graphPosition.update',
    meta: createCommandMeta(state, 'fsm.graphPosition.update'),
    payload: { stateId, position }
  })),
  updateGraphPositions: (positions) => commitProjectCommand(set, get, (state) => ({
    type: 'fsm.graphPositions.update',
    meta: createCommandMeta(state, 'fsm.graphPositions.update'),
    payload: { positions }
  })),
  applyFsmScriptPreview: (preview) => {
    const state = get();
    if (!state.project || !state.session) {
      return null;
    }
    const result = applyFsmScriptPreview(
      sessionFromState(state),
      preview,
      createDefaultApplicationCommandContext()
    );
    if (result.status !== 'applied' && result.status !== 'noop') {
      return result;
    }
    set({
      ...projectProjection(result.session),
      selectedStateId: resolveSelection(undefined, result.session.project.fsm.stateOrder, state.selectedStateId),
      selectedScreenId: resolveSelection(undefined, result.session.project.screenOrder, state.selectedScreenId),
      selectedTransitionId: state.selectedTransitionId && result.session.project.fsm.transitions[state.selectedTransitionId]
        ? state.selectedTransitionId
        : null,
      undoStack: result.session.history.entries.slice(0, result.session.history.cursor),
      redoStack: result.session.history.entries.slice(result.session.history.cursor),
      canUndo: result.session.history.cursor > 0,
      canRedo: result.session.history.cursor < result.session.history.entries.length,
      pendingHistoryCapture: false
    });
    return result;
  },
  applyScreenDslPreview: (preview, sourceText) => {
    const state = get();
    if (!state.project || !state.session) {
      return null;
    }
    const result = applyScreenDslPreviewFacade(
      sessionFromState(state),
      { preview, sourceText }
    );
    if (!result.applied || !result.result) {
      return result;
    }
    const newSession = result.result.session;
    set({
      ...projectProjection(newSession),
      selectedStateId: resolveSelection(undefined, newSession.project.fsm.stateOrder, state.selectedStateId),
      selectedScreenId: resolveSelection(undefined, newSession.project.screenOrder, state.selectedScreenId),
      selectedTransitionId: state.selectedTransitionId && newSession.project.fsm.transitions[state.selectedTransitionId]
        ? state.selectedTransitionId
        : null,
      undoStack: newSession.history.entries.slice(0, newSession.history.cursor),
      redoStack: newSession.history.entries.slice(newSession.history.cursor),
      canUndo: newSession.history.cursor > 0,
      canRedo: newSession.history.cursor < newSession.history.entries.length,
      pendingHistoryCapture: false
    });
    return result;
  },
  ensureStateScreen: (stateId) => {
    const state = get().project?.fsm.states[stateId];
    if (!state) {
      return null;
    }
    if (state.screenId && get().project?.screens[state.screenId]) {
      set({ selectedScreenId: state.screenId });
      return state.screenId;
    }
    const result = commitProjectCommand(set, get, (current) => ({
      type: 'fsm.state.ensureScreen',
      meta: createCommandMeta(current, 'fsm.state.ensureScreen'),
      payload: { stateId }
    }));
    const screenId = result?.session.workspace.project.fsm.states[stateId]?.screenId ?? get().project?.fsm.states[stateId]?.screenId ?? null;
    if (screenId) {
      set({ selectedScreenId: screenId });
    }
    return screenId;
  },
  createScreen: (name) => commitProjectCommand(set, get, (state) => ({
    type: 'screen.create',
    meta: createCommandMeta(state, 'screen.create'),
    payload: { name }
  }), { selectedScreenId: 'last' }),
  duplicateScreen: (screenId) => {
    const current = get().project;
    const source = current?.screens[screenId];
    if (!current || !source) {
      return;
    }
    const result = commitProjectCommand(set, get, (state) => ({
      type: 'screen.duplicate',
      meta: createCommandMeta(state, 'screen.duplicate'),
      payload: { screenId }
    }));
    const duplicatedId = result?.changes.find((change) => change.entityType === 'screen' && change.kind === 'created')?.entityId;
    if (duplicatedId) {
      set({ selectedScreenId: duplicatedId });
    }
  },
  renameScreen: (screenId, name) => commitProjectCommand(set, get, (state) => ({
    type: 'screen.rename',
    meta: createCommandMeta(state, 'screen.rename'),
    payload: { screenId, name }
  })),
  resizeScreen: (screenId, width, height) => commitProjectCommand(set, get, (state) => ({
    type: 'screen.resize',
    meta: createCommandMeta(state, 'screen.resize'),
    payload: { screenId, width, height }
  })),
  deleteScreen: (screenId) => commitProjectCommand(set, get, (state) => ({
    type: 'screen.delete',
    meta: createCommandMeta(state, 'screen.delete'),
    payload: { screenId }
  }), { selectedScreenId: 'first', selectedStateId: 'first' }),
  reorderScreens: (screenIds) => commitProjectCommand(set, get, (state) => ({
    type: 'screen.reorder',
    meta: createCommandMeta(state, 'screen.reorder'),
    payload: { screenIds }
  })),
  saveScreenTemplate: (screenId) => {
    const screen = get().project?.screens[screenId];
    if (!screen) {
      return;
    }
    const templates = readTemplates();
    const template = { ...clone(screen), id: `template-${Date.now()}`, selectedObjectIds: [] };
    localStorage.setItem(SCREEN_TEMPLATES_KEY, JSON.stringify([template, ...templates].slice(0, 24)));
  },
  createScreenFromTemplate: (templateId) => {
    const template = readTemplates().find((item) => item.id === templateId);
    const project = get().project;
    if (!template || !project) {
      return;
    }
    const result = commitProjectCommand(set, get, (state) => ({
      type: 'screen.createFromTemplate',
      meta: createCommandMeta(state, 'screen.createFromTemplate'),
      payload: { template }
    }));
    const screenId = result?.changes.find((change) => change.entityType === 'screen' && change.kind === 'created')?.entityId;
    if (screenId) {
      set({ selectedScreenId: screenId });
    }
  },
  addControlElement: (type) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.element.add',
    meta: createCommandMeta(state, 'controlPanel.element.add'),
    payload: { elementType: type }
  }), { selectedControlElementIds: 'last' }),
  updateControlElement: (elementId, updates, options) => {
    commitProjectCommand(set, get, (state) => ({
      type: 'controlPanel.element.update',
      meta: createCommandMeta(state, 'controlPanel.element.update'),
      payload: { elementId, updates }
    }), {}, { recordHistory: options?.history !== false });
  },
  deleteControlElements: (elementIds) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.elements.delete',
    meta: createCommandMeta(state, 'controlPanel.elements.delete'),
    payload: { elementIds }
  }), { selectedControlElementIds: [] }),
  groupControlElements: (elementIds) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.elements.group',
    meta: createCommandMeta(state, 'controlPanel.elements.group'),
    payload: { elementIds }
  }), { selectedControlElementIds: 'last' }),
  ungroupControlElements: (elementIds) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.elements.ungroup',
    meta: createCommandMeta(state, 'controlPanel.elements.ungroup'),
    payload: { elementIds }
  }), { selectedControlElementIds: [] }),
  alignControlElements: (elementIds, axis) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.elements.align',
    meta: createCommandMeta(state, 'controlPanel.elements.align'),
    payload: { elementIds, axis }
  })),
  updateControlPanelSettings: (updates) => commitProjectCommand(set, get, (state) => ({
    type: 'controlPanel.settings.update',
    meta: createCommandMeta(state, 'controlPanel.settings.update'),
    payload: { updates }
  })),
  undo: () => set((state) => {
    if (!state.session) {
      return state;
    }
    const session = undoProjectSession(state.session);
    if (!session) {
      return state;
    }
    return {
      ...projectProjection(session),
      selectedStateId: resolveSelection(undefined, session.project.fsm.stateOrder, state.selectedStateId),
      selectedScreenId: resolveSelection(undefined, session.project.screenOrder, state.selectedScreenId),
      selectedTransitionId: state.selectedTransitionId && session.project.fsm.transitions[state.selectedTransitionId] ? state.selectedTransitionId : null,
      selectedControlElementIds: state.selectedControlElementIds.filter((id) => session.project.controlPanel.elements[id]),
      undoStack: session.history.entries.slice(0, session.history.cursor),
      redoStack: session.history.entries.slice(session.history.cursor),
      canUndo: session.history.cursor > 0,
      canRedo: session.history.cursor < session.history.entries.length,
      pendingHistoryCapture: false
    };
  }),
  redo: () => set((state) => {
    if (!state.session) {
      return state;
    }
    const session = redoProjectSession(state.session);
    if (!session) {
      return state;
    }
    return {
      ...projectProjection(session),
      selectedStateId: resolveSelection(undefined, session.project.fsm.stateOrder, state.selectedStateId),
      selectedScreenId: resolveSelection(undefined, session.project.screenOrder, state.selectedScreenId),
      selectedTransitionId: state.selectedTransitionId && session.project.fsm.transitions[state.selectedTransitionId] ? state.selectedTransitionId : null,
      selectedControlElementIds: state.selectedControlElementIds.filter((id) => session.project.controlPanel.elements[id]),
      undoStack: session.history.entries.slice(0, session.history.cursor),
      redoStack: session.history.entries.slice(session.history.cursor),
      canUndo: session.history.cursor > 0,
      canRedo: session.history.cursor < session.history.entries.length,
      pendingHistoryCapture: false
    };
  }),
  captureHistory: () => set((state) => {
    return state.project ? { pendingHistoryCapture: true } : state;
  }),
  updateCanvasObject: (screenId, object, options) => {
    commitProjectCommand(set, get, (state) => ({
      type: 'canvas.object.update',
      meta: createCommandMeta(state, 'canvas.object.update'),
      payload: { screenId, object }
    }), {}, { recordHistory: options?.history !== false });
  },
  setCanvasSelection: (screenId, objectIds) => commitProjectCommand(set, get, (state) => ({
    type: 'canvas.selection.set',
    meta: createCommandMeta(state, 'canvas.selection.set'),
    payload: { screenId, objectIds }
  }), {}, { recordHistory: false, consumeHistoryCapture: false }),
  addCanvasObject: (screenId, object) => commitProjectCommand(set, get, (state) => ({
    type: 'canvas.object.add',
    meta: createCommandMeta(state, 'canvas.object.add'),
    payload: { screenId, object }
  })),
  addBitmapLayer: (screenId, name, bytes) => {
    commitProjectCommand(set, get, (state) => ({
      type: 'canvas.bitmapLayer.add',
      meta: createCommandMeta(state, 'canvas.bitmapLayer.add'),
      payload: { screenId, name, bytes }
    }));
  },
  updateCanvasObjects: (screenId, objects, options) => {
    commitProjectCommand(set, get, (state) => ({
      type: 'canvas.objects.update',
      meta: createCommandMeta(state, 'canvas.objects.update'),
      payload: { screenId, objects }
    }), {}, { recordHistory: options?.history !== false });
  },
  deleteSelectedCanvasObjects: (screenId) => {
    const objectIds = get().project?.screens[screenId]?.selectedObjectIds ?? [];
    commitProjectCommand(set, get, (state) => ({
      type: 'canvas.objects.delete',
      meta: createCommandMeta(state, 'canvas.objects.delete'),
      payload: { screenId, objectIds }
    }));
  },
  updateGlyph: (variant, char, glyph) => commitProjectCommand(set, get, (state) => ({
    type: 'font.glyph.update',
    meta: createCommandMeta(state, 'font.glyph.update'),
    payload: { variant, char, glyph }
  })),
  importFontGlyphs: (variant, glyphs, metadata, mode) => commitProjectCommand(set, get, (state) => ({
    type: 'font.glyphs.import',
    meta: createCommandMeta(state, 'font.glyphs.import'),
    payload: { variant, glyphs, metadata, mode }
  })),
  addSavedMeasurement: (stateId, label, value) => commitProjectCommand(set, get, (state) => ({
    type: 'measurement.add',
    meta: createCommandMeta(state, 'measurement.add'),
    payload: { stateId, label, value }
  })),
  updateSavedMeasurement: (measurement) => commitProjectCommand(set, get, (state) => ({
    type: 'measurement.update',
    meta: createCommandMeta(state, 'measurement.update'),
    payload: { measurement }
  })),
  deleteSavedMeasurement: (measurementId) => commitProjectCommand(set, get, (state) => ({
    type: 'measurement.delete',
    meta: createCommandMeta(state, 'measurement.delete'),
    payload: { measurementId }
  })),
  setHmiTags: (tags, dataSources) => set((state) => {
    if (!state.project) return state;
    const project: LcdBitmapProject = { ...state.project, tags, ...(dataSources !== undefined ? { dataSources } : {}) };
    return { project };
  }),
  upsertHmiTag: (tag) => set((state) => {
    if (!state.project) return state;
    const tags = { ...(state.project.tags ?? {}), [tag.id]: tag };
    return { project: { ...state.project, tags } };
  }),
  deleteHmiTag: (tagId) => set((state) => {
    if (!state.project) return state;
    const tags = { ...(state.project.tags ?? {}) };
    delete tags[tagId];
    return { project: { ...state.project, tags } };
  }),
  upsertHmiProcedure: (procedure) => set((state) => {
    if (!state.project) return state;
    const procedures = { ...(state.project.procedures ?? {}), [procedure.id]: procedure };
    return { project: { ...state.project, procedures } };
  }),
  deleteHmiProcedure: (procedureId) => set((state) => {
    if (!state.project) return state;
    const procedures = { ...(state.project.procedures ?? {}) };
    delete procedures[procedureId];
    return { project: { ...state.project, procedures } };
  }),
  upsertCliCommand: (command) => set((state) => {
    if (!state.project) return state;
    const cliCatalog = { ...(state.project.cliCatalog ?? {}), [command.id]: command };
    return { project: { ...state.project, cliCatalog } };
  }),
  deleteCliCommand: (commandId) => set((state) => {
    if (!state.project) return state;
    const cliCatalog = { ...(state.project.cliCatalog ?? {}) };
    delete cliCatalog[commandId];
    return { project: { ...state.project, cliCatalog } };
  }),
  upsertAlarm: (alarm) => set((state) => {
    if (!state.project) return state;
    const alarms = { ...(state.project.alarms ?? {}), [alarm.id]: alarm };
    return { project: { ...state.project, alarms } };
  }),
  deleteAlarm: (alarmId) => set((state) => {
    if (!state.project) return state;
    const alarms = { ...(state.project.alarms ?? {}) };
    delete alarms[alarmId];
    return { project: { ...state.project, alarms } };
  })
}));

function commitProjectCommand(
  set: (partial: Partial<ProjectStoreState>) => void,
  get: () => ProjectStoreState,
  createCommand: (state: ProjectStoreState) => ProjectCommand,
  selection: Record<string, unknown> = {},
  options: { recordHistory?: boolean; consumeHistoryCapture?: boolean } = {}
): ProjectCommandResult | null {
  const state = get();
  if (!state.project || !state.session) {
    return null;
  }
  const session = sessionFromState(state);
  const captureAsHistory = options.recordHistory === false
    && state.pendingHistoryCapture
    && options.consumeHistoryCapture !== false;
  const clearPendingHistoryCapture = state.pendingHistoryCapture
    && (captureAsHistory || options.recordHistory !== false);
  const result = executeProjectCommand(
    session,
    createCommand(state),
    createDefaultApplicationCommandContext(),
    { recordHistory: captureAsHistory ? true : options.recordHistory }
  );
  if (result.status !== 'applied') {
    return result;
  }
  const project = result.session.project;
  const selectedStateId = resolveSelection(selection.selectedStateId, project.fsm.stateOrder, state.selectedStateId);
  const selectedScreenId = resolveSelection(selection.selectedScreenId, project.screenOrder, state.selectedScreenId);
  const selectedTransitionId = selection.selectedTransitionId === null ? null : state.selectedTransitionId;
  const selectedControlElementIds = resolveControlSelection(
    selection.selectedControlElementIds,
    project.controlPanel.elementOrder,
    state.selectedControlElementIds
  );
  set({
    ...projectProjection(result.session),
    selectedStateId,
    selectedScreenId,
    selectedTransitionId,
    selectedControlElementIds,
    undoStack: result.session.history.entries.slice(0, result.session.history.cursor),
    redoStack: result.session.history.entries.slice(result.session.history.cursor),
    canUndo: result.session.history.cursor > 0,
    canRedo: result.session.history.cursor < result.session.history.entries.length,
    pendingHistoryCapture: clearPendingHistoryCapture ? false : state.pendingHistoryCapture
  });
  return result;
}

function createCommandMeta(state: ProjectStoreState, type: ProjectCommand['type']): CommandMetadata {
  if (!state.project) {
    throw new Error('Cannot create a project command without an active project.');
  }
  commandSequence += 1;
  return {
    commandId: `${type}-${state.revision + 1}-${commandSequence}`,
    projectId: state.project.meta.id,
    expectedRevision: state.revision,
    actor: { id: 'renderer-store', type: 'adapter', displayName: 'Renderer Store' },
    timestamp: now()
  };
}

function refreshProject(project: LcdBitmapProject): LcdBitmapProject {
  const next = {
    ...project,
    bindings: rebuildProjectBindings(project)
  };
  return {
    ...next,
    validation: {
      issues: validateProject(next),
      validatedAt: now()
    }
  };
}

function projectProjection(session: ProjectSession): Partial<ProjectStoreState> {
  return {
    session,
    project: session.project,
    revision: session.revision,
    fontGlyphs: session.workspace.fontGlyphs,
    loadedFonts: session.workspace.loadedFonts,
    savedMeasurements: session.workspace.savedMeasurements
  };
}

function sessionFromState(state: ProjectStoreState): ProjectSession {
  if (!state.project || !state.session) {
    throw new Error('Cannot create an application session without an active project.');
  }
  return createSessionFromWorkspace(
    {
      project: state.project,
      fontGlyphs: state.fontGlyphs,
      loadedFonts: state.loadedFonts,
      savedMeasurements: state.savedMeasurements
    },
    state.revision,
    state.session.history,
    state.session.savepoint,
    state.session.processedCommandIds
  );
}


function readTemplates(): LcdScreen[] {
  try {
    const value = JSON.parse(localStorage.getItem(SCREEN_TEMPLATES_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function resolveSelection(
  value: unknown,
  order: string[],
  current: string | null
): string | null {
  if (typeof value === 'string' && value !== 'last' && value !== 'first' && value !== 'last-changed') {
    return value;
  }
  if (value === 'last' || value === 'last-changed') {
    return order.at(-1) ?? null;
  }
  if (value === 'first') {
    return order[0] ?? null;
  }
  return current && order.includes(current) ? current : order[0] ?? null;
}

function resolveControlSelection(value: unknown, order: string[], current: string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && order.includes(id));
  }
  if (value === 'last') {
    return order.at(-1) ? [order.at(-1)!] : [];
  }
  return current.filter((id) => order.includes(id));
}

function createInitialFontMetadata(): FontMetadata[] {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return [
    { id: 'bundled-font-1', name: 'Bundled Font 1', sourceFormat: 'bundled', variant: '1', glyphCount: 0, createdAt: timestamp },
    { id: 'bundled-font-2', name: 'Bundled Font 2', sourceFormat: 'bundled', variant: '2', glyphCount: 0, createdAt: timestamp }
  ];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return new Date().toISOString();
}

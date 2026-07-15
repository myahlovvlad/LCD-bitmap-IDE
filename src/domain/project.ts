import type { CanvasObject, DisplayConfig, GraphPosition } from './canvas';
import type { FontMetadata } from './fonts';
import type { LocalizedText } from './localization';
import type { HmiBindings, HmiTag, DataSource } from './tag';
import type { BackendProcedure, CliCommandDefinition } from './procedure';
import type { AlarmDefinition } from './alarm';
import type { TrendDefinition } from './trend';

export const PROJECT_SCHEMA_VERSION = 6 as const;
export const PROJECT_SCHEMA_VERSION_LEGACY = 5 as const;

export type WorkspaceMode =
  | 'fsm'
  | 'lcd'
  | 'control-panel'
  | 'preview'
  | 'tags'
  | 'procedures'
  | 'alarms'
  | 'runtime'
  | 'screen-dsl'
  | 'settings'
  | 'text-registry';

export type WorkspaceLocation =
  | { mode: 'fsm'; stateId?: string; transitionId?: string }
  | { mode: 'lcd'; screenId?: string }
  | { mode: 'control-panel'; elementId?: string }
  | { mode: 'preview'; stateId?: string }
  | { mode: 'tags'; tagId?: string }
  | { mode: 'procedures'; procedureId?: string }
  | { mode: 'alarms'; alarmId?: string }
  | { mode: 'runtime'; stateId?: string }
  | { mode: 'screen-dsl'; screenId?: string }
  | { mode: 'settings' }
  | { mode: 'text-registry' };

export interface ProjectMeta {
  id: string;
  name: string;
  version: string;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  modelId: string;
  firmwareVersion: string | null;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LcdScreen {
  id: string;
  name: string;
  description: string;
  tags: string[];
  width: number;
  height: number;
  objects: CanvasObject[];
  selectedObjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BitmapFont extends FontMetadata {
  glyphIds: string[];
}

export interface ProjectGlyph {
  id: string;
  char: string;
  fontId: string;
  width: number;
  data: string[];
  topOffset?: number;
  nominalHeight?: number;
}

export interface FsmEvent {
  id: string;
  name: string;
  description?: string;
  legacyTrigger?: string;
}

export interface FsmState {
  id: string;
  runtimeId: string | null;
  legacyIds: string[];
  title: string;
  subsystem: string;
  stateType: 'initial' | 'process' | 'success' | 'failure' | string;
  origin: string;
  screenId: string | null;
  initial: boolean;
  terminal: boolean;
}

export type FsmTransitionMechanism = 'event' | 'button' | 'timer' | 'fact';

export interface FsmTransitionTrigger {
  eventId: string;
  mechanism?: FsmTransitionMechanism;
  buttonId?: string | null;
  timerMs?: number | null;
  fact?: string | null;
}

export interface FsmTransition {
  id: string;
  from: string;
  to: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  trigger: FsmTransitionTrigger;
  kind: string;
  condition: string | null;
  source: string | null;
  backendProcessId: string | null;
}

export interface FsmModel {
  states: Record<string, FsmState>;
  stateOrder: string[];
  transitions: Record<string, FsmTransition>;
  transitionOrder: string[];
  events: Record<string, FsmEvent>;
  eventOrder: string[];
  graphLayout: Record<string, GraphPosition>;
}

export interface BackendProcess {
  id: string;
  name: string;
  commands: string[];
  description?: string;
}

export interface ControlElementBase {
  id: string;
  type: 'display' | 'button' | 'text' | 'group' | 'rectangle' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  groupId?: string;
}

export interface ControlPanelDisplay extends ControlElementBase {
  type: 'display';
  screenScale: number;
}

export interface ControlPanelButton extends ControlElementBase {
  type: 'button';
  label: string;
  shape: 'rect' | 'rounded-rect' | 'circle' | 'ellipse' | 'diamond' | 'custom';
  styleToken?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  keyCode?: string;
  fsmEventId?: string;
  allowedStates?: string[];
  disabledStates?: string[];
  pressType?: 'short' | 'long' | 'repeat';
  longPressAction?: string;
  repeatMode?: boolean;
  description?: string;
  bindings?: HmiBindings;
}

export interface ControlPanelText extends ControlElementBase {
  type: 'text';
  text: LocalizedText;
  color?: string;
  fontSize?: number;
}

export interface ControlPanelGroup extends ControlElementBase {
  type: 'group';
  name: string;
  childIds: string[];
}

export interface ControlPanelRectangle extends ControlElementBase {
  type: 'rectangle';
  fillColor?: string;
  strokeColor?: string;
}

export interface ControlPanelImage extends ControlElementBase {
  type: 'image';
  name: string;
  dataUrl: string;
  opacity: number;
}

export type ControlPanelElement =
  | ControlPanelDisplay
  | ControlPanelButton
  | ControlPanelText
  | ControlPanelGroup
  | ControlPanelRectangle
  | ControlPanelImage;

export interface DeviceThemeTokens {
  panelBackground: string;
  panelStroke: string;
  buttonFill: string;
  buttonStroke: string;
  buttonText: string;
  displayBackground: string;
  displayPixelOn: string;
  displayPixelOff: string;
  labelText: string;
}

export interface ControlPanelModel {
  width: number;
  height: number;
  backgroundColor: string;
  gridSize: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  elements: Record<string, ControlPanelElement>;
  elementOrder: string[];
  tokens: DeviceThemeTokens;
}

export interface ProjectBindings {
  statesByScreenId: Record<string, string[]>;
  buttonsByEventId: Record<string, string[]>;
  transitionsByEventId: Record<string, string[]>;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationDomain = 'fsm' | 'lcd' | 'control-panel' | 'runtime' | 'export';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  domain: ValidationDomain;
  message: string;
  entityType: string;
  entityId?: string;
  suggestedFix?: string;
}

export interface ValidationState {
  issues: ValidationIssue[];
  validatedAt: string | null;
}

export interface LcdBitmapProject {
  meta: ProjectMeta;
  display: DisplayConfig;
  screens: Record<string, LcdScreen>;
  screenOrder: string[];
  fonts: Record<string, BitmapFont>;
  glyphs: Record<string, ProjectGlyph>;
  fsm: FsmModel;
  controlPanel: ControlPanelModel;
  backendProcesses: Record<string, BackendProcess>;
  bindings: ProjectBindings;
  validation: ValidationState;
  // v6 HMI extensions — all optional for backward compatibility
  tags?: Record<string, HmiTag>;
  dataSources?: Record<string, DataSource>;
  procedures?: Record<string, BackendProcedure>;
  cliCatalog?: Record<string, CliCommandDefinition>;
  alarms?: Record<string, AlarmDefinition>;
  trends?: Record<string, TrendDefinition>;
}

export interface ProjectFileV5 {
  kind: 'lcd-bitmap-project';
  version: typeof PROJECT_SCHEMA_VERSION | typeof PROJECT_SCHEMA_VERSION_LEGACY;
  savedAt: string;
  language: 'en' | 'ru' | 'zh';
  project: LcdBitmapProject;
  fontGlyphs?: unknown;
  loadedFonts?: FontMetadata[];
  savedMeasurements?: unknown[];
}

// Re-export HMI extension types so consumers only need to import from 'domain/project'
export type { HmiTag, DataSource, ValueExpression, HmiBindings, HmiTagDataType, DataSourceKind } from './tag';
export type { RuntimeAction, RuntimeActionType, BackendProcedure, CliCommandDefinition, CliRetryPolicy } from './procedure';
export type { AlarmDefinition, AlarmSeverity } from './alarm';
export type { TrendDefinition } from './trend';

export interface ProjectSnapshotV5 {
  project: LcdBitmapProject;
  language?: 'en' | 'ru' | 'zh';
  fontGlyphs?: unknown;
  loadedFonts?: FontMetadata[];
  savedMeasurements?: unknown[];
}

export function rebuildProjectBindings(project: LcdBitmapProject): ProjectBindings {
  const statesByScreenId: Record<string, string[]> = {};
  const buttonsByEventId: Record<string, string[]> = {};
  const transitionsByEventId: Record<string, string[]> = {};

  for (const state of Object.values(project.fsm.states)) {
    if (state.screenId) {
      (statesByScreenId[state.screenId] ??= []).push(state.id);
    }
  }
  for (const element of Object.values(project.controlPanel.elements)) {
    if (element.type === 'button' && element.fsmEventId) {
      (buttonsByEventId[element.fsmEventId] ??= []).push(element.id);
    }
  }
  for (const transition of Object.values(project.fsm.transitions)) {
    (transitionsByEventId[transition.trigger.eventId] ??= []).push(transition.id);
  }

  return { statesByScreenId, buttonsByEventId, transitionsByEventId };
}

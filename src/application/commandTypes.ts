import type {
  CanvasObject,
  DisplayConfig,
  FontMetadata,
  FontVariantKey,
  Glyph,
  GlyphSet,
  GraphPosition,
  LanguageCode,
  SavedMeasurement
} from '../domain';
import type {
  BackendProcess,
  ControlPanelElement,
  FsmEvent,
  FsmLayer,
  FsmLayerVisibilityPreset,
  FsmState,
  FsmTransition,
  LcdBitmapProject,
  LcdScreen
} from '../domain/project';
import type { FsmInterchangeModelV1 } from '../fsm-interchange';
import type { ScreenInterchangeProjectV1 } from '../screen-interchange';
import type { HmiTag } from '../domain/tag';
import type { BackendProcedure } from '../domain/procedure';
import type { AlarmDefinition } from '../domain/alarm';

export interface ActorIdentity {
  id: string;
  type: 'user' | 'system' | 'adapter';
  displayName?: string;
}

export interface CommandMetadata {
  commandId: string;
  projectId: string;
  expectedRevision: number;
  actor?: ActorIdentity;
  reason?: string;
  timestamp?: string;
}

export interface BaseProjectCommand<Type extends string, Payload> {
  type: Type;
  meta: CommandMetadata;
  payload: Payload;
}

export type ProjectUpdateMetadataCommand = BaseProjectCommand<
  'project.updateMetadata',
  Partial<Pick<LcdBitmapProject['meta'], 'name' | 'version' | 'author' | 'firmwareVersion' | 'modelId'>>
>;
export type ProjectUpdateDisplayConfigCommand = BaseProjectCommand<
  'project.updateDisplayConfig',
  { display: DisplayConfig }
>;
export type ProjectSetAuthoringLanguageCommand = BaseProjectCommand<
  'project.setAuthoringLanguage',
  { language: LanguageCode }
>;

export type FsmStateAddCommand = BaseProjectCommand<'fsm.state.add', { title?: string }>;
export type FsmStateUpdateCommand = BaseProjectCommand<
  'fsm.state.update',
  { stateId: string; updates: Partial<FsmState> }
>;
/** One undoable operation for layer membership changes affecting many states. */
export type FsmStatesUpdateCommand = BaseProjectCommand<
  'fsm.states.update',
  { updates: Record<string, Partial<FsmState>> }
>;
export type FsmLayersUpdateCommand = BaseProjectCommand<
  'fsm.layers.update',
  { layers: Record<string, FsmLayer>; layerOrder: string[]; visibilityPresets: Record<string, FsmLayerVisibilityPreset> }
>;
export type FsmStateDeleteCommand = BaseProjectCommand<'fsm.state.delete', { stateId: string }>;
export type FsmStateEnsureScreenCommand = BaseProjectCommand<'fsm.state.ensureScreen', { stateId: string }>;

export type FsmTransitionAddCommand = BaseProjectCommand<
  'fsm.transition.add',
  {
    from: string;
    to: string;
    eventId?: string;
    handles?: { sourceHandle?: string | null; targetHandle?: string | null };
  }
>;
export type FsmTransitionUpdateCommand = BaseProjectCommand<
  'fsm.transition.update',
  { transitionId: string; updates: Partial<FsmTransition> }
>;
export type FsmTransitionDeleteCommand = BaseProjectCommand<'fsm.transition.delete', { transitionId: string }>;
export type FsmEventAddCommand = BaseProjectCommand<
  'fsm.event.add',
  { name?: string; scope?: FsmEvent['scope']; sourceStateId?: string | null }
>;
export type FsmEventUpdateCommand = BaseProjectCommand<
  'fsm.event.update',
  { eventId: string; updates: Partial<Pick<FsmEvent, 'name' | 'description' | 'scope' | 'sourceStateId'>> }
>;
export type FsmEventDeleteCommand = BaseProjectCommand<'fsm.event.delete', { eventId: string }>;
export type BackendProcessUpdateCommand = BaseProjectCommand<
  'backendProcess.update',
  { processId: string; updates: Partial<Pick<BackendProcess, 'name' | 'description' | 'commands'>> }
>;
export type FsmGraphPositionUpdateCommand = BaseProjectCommand<
  'fsm.graphPosition.update',
  { stateId: string; position: GraphPosition }
>;
export type FsmGraphPositionsUpdateCommand = BaseProjectCommand<
  'fsm.graphPositions.update',
  { positions: Record<string, GraphPosition> }
>;
export type FsmSemanticRoundTripApplyCommand = BaseProjectCommand<
  'fsm.semanticRoundTrip.apply',
  { model: FsmInterchangeModelV1 }
>;

export type ScreenCreateCommand = BaseProjectCommand<'screen.create', { name?: string }>;
export type ScreenDuplicateCommand = BaseProjectCommand<'screen.duplicate', { screenId: string }>;
export type ScreenDuplicateLayoutCommand = BaseProjectCommand<'screen.duplicateLayout', { screenId: string }>;
export type ScreenRenameCommand = BaseProjectCommand<'screen.rename', { screenId: string; name: string }>;
export type ScreenResizeCommand = BaseProjectCommand<
  'screen.resize',
  { screenId: string; width: number; height: number }
>;
export type ScreenDeleteCommand = BaseProjectCommand<'screen.delete', { screenId: string }>;
export type ScreenReorderCommand = BaseProjectCommand<'screen.reorder', { screenIds: string[] }>;
export type ScreenCreateFromTemplateCommand = BaseProjectCommand<'screen.createFromTemplate', { template: LcdScreen }>;
export type ScreenDslApplyCommand = BaseProjectCommand<
  'screen.dsl.apply',
  { package: ScreenInterchangeProjectV1; mode: 'create' | 'clone' }
>;

export type ControlPanelElementAddCommand = BaseProjectCommand<
  'controlPanel.element.add',
  { elementType: ControlPanelElement['type'] }
>;
export type ControlPanelElementUpdateCommand = BaseProjectCommand<
  'controlPanel.element.update',
  { elementId: string; updates: Partial<ControlPanelElement> }
>;
export type ControlPanelElementsUpdateCommand = BaseProjectCommand<
  'controlPanel.elements.update',
  { updates: Record<string, Partial<ControlPanelElement>> }
>;
export type ControlPanelElementsDeleteCommand = BaseProjectCommand<
  'controlPanel.elements.delete',
  { elementIds: string[] }
>;
export type ControlPanelElementsGroupCommand = BaseProjectCommand<
  'controlPanel.elements.group',
  { elementIds: string[] }
>;
export type ControlPanelElementsUngroupCommand = BaseProjectCommand<
  'controlPanel.elements.ungroup',
  { elementIds: string[] }
>;
export type ControlPanelElementsAlignCommand = BaseProjectCommand<
  'controlPanel.elements.align',
  { elementIds: string[]; axis: 'left' | 'top' | 'center-x' | 'center-y' }
>;
export type ControlPanelSettingsUpdateCommand = BaseProjectCommand<
  'controlPanel.settings.update',
  { updates: Partial<Pick<LcdBitmapProject['controlPanel'], 'width' | 'height' | 'gridEnabled' | 'snapToGrid' | 'gridSize' | 'backgroundColor'>> }
>;

export type CanvasObjectUpdateCommand = BaseProjectCommand<
  'canvas.object.update',
  { screenId: string; object: CanvasObject }
>;
export type CanvasSelectionSetCommand = BaseProjectCommand<
  'canvas.selection.set',
  { screenId: string; objectIds: string[] }
>;
export type CanvasObjectAddCommand = BaseProjectCommand<
  'canvas.object.add',
  { screenId: string; object: CanvasObject }
>;
export type CanvasBitmapLayerAddCommand = BaseProjectCommand<
  'canvas.bitmapLayer.add',
  { screenId: string; name: string; bytes: number[] }
>;
export type CanvasObjectsUpdateCommand = BaseProjectCommand<
  'canvas.objects.update',
  { screenId: string; objects: CanvasObject[] }
>;
export type CanvasObjectsDeleteCommand = BaseProjectCommand<
  'canvas.objects.delete',
  { screenId: string; objectIds: string[] }
>;

export type FontGlyphUpdateCommand = BaseProjectCommand<
  'font.glyph.update',
  { variant: FontVariantKey; char: string; glyph: Glyph }
>;
export type FontGlyphsImportCommand = BaseProjectCommand<
  'font.glyphs.import',
  { variant: FontVariantKey; glyphs: GlyphSet; metadata: FontMetadata; mode: 'merge' | 'replace' }
>;

export type MeasurementAddCommand = BaseProjectCommand<
  'measurement.add',
  { stateId: string; label: string; value: string }
>;
export type MeasurementUpdateCommand = BaseProjectCommand<
  'measurement.update',
  { measurement: SavedMeasurement }
>;
export type MeasurementDeleteCommand = BaseProjectCommand<'measurement.delete', { measurementId: string }>;

export type HmiTagUpsertCommand = BaseProjectCommand<'tag.upsert', { tag: HmiTag }>;
export type HmiTagDeleteCommand = BaseProjectCommand<'tag.delete', { tagId: string }>;
export type HmiProcedureUpsertCommand = BaseProjectCommand<'procedure.upsert', { procedure: BackendProcedure }>;
export type HmiProcedureDeleteCommand = BaseProjectCommand<'procedure.delete', { procedureId: string }>;
export type AlarmUpsertCommand = BaseProjectCommand<'alarm.upsert', { alarm: AlarmDefinition }>;
export type AlarmDeleteCommand = BaseProjectCommand<'alarm.delete', { alarmId: string }>;

export type ProjectCommand =
  | ProjectUpdateMetadataCommand
  | ProjectUpdateDisplayConfigCommand
  | ProjectSetAuthoringLanguageCommand
  | FsmStateAddCommand
  | FsmStateUpdateCommand
  | FsmStatesUpdateCommand
  | FsmLayersUpdateCommand
  | FsmStateDeleteCommand
  | FsmStateEnsureScreenCommand
  | FsmTransitionAddCommand
  | FsmTransitionUpdateCommand
  | FsmTransitionDeleteCommand
  | FsmEventAddCommand
  | FsmEventUpdateCommand
  | FsmEventDeleteCommand
  | BackendProcessUpdateCommand
  | FsmGraphPositionUpdateCommand
  | FsmGraphPositionsUpdateCommand
  | FsmSemanticRoundTripApplyCommand
  | ScreenCreateCommand
  | ScreenDuplicateCommand
  | ScreenDuplicateLayoutCommand
  | ScreenRenameCommand
  | ScreenResizeCommand
  | ScreenDeleteCommand
  | ScreenReorderCommand
  | ScreenCreateFromTemplateCommand
  | ScreenDslApplyCommand
  | ControlPanelElementAddCommand
  | ControlPanelElementUpdateCommand
  | ControlPanelElementsUpdateCommand
  | ControlPanelElementsDeleteCommand
  | ControlPanelElementsGroupCommand
  | ControlPanelElementsUngroupCommand
  | ControlPanelElementsAlignCommand
  | ControlPanelSettingsUpdateCommand
  | CanvasObjectUpdateCommand
  | CanvasSelectionSetCommand
  | CanvasObjectAddCommand
  | CanvasBitmapLayerAddCommand
  | CanvasObjectsUpdateCommand
  | CanvasObjectsDeleteCommand
  | FontGlyphUpdateCommand
  | FontGlyphsImportCommand
  | MeasurementAddCommand
  | MeasurementUpdateCommand
  | MeasurementDeleteCommand
  | HmiTagUpsertCommand
  | HmiTagDeleteCommand
  | HmiProcedureUpsertCommand
  | HmiProcedureDeleteCommand
  | AlarmUpsertCommand
  | AlarmDeleteCommand;

/** Runtime list used by automation parity tests; the type assertion below keeps it exhaustive. */
export const PROJECT_COMMAND_TYPES = [
  'project.updateMetadata', 'project.updateDisplayConfig', 'project.setAuthoringLanguage',
  'fsm.state.add', 'fsm.state.update', 'fsm.states.update', 'fsm.layers.update', 'fsm.state.delete', 'fsm.state.ensureScreen',
  'fsm.transition.add', 'fsm.transition.update', 'fsm.transition.delete',
  'fsm.event.add', 'fsm.event.update', 'fsm.event.delete', 'backendProcess.update',
  'fsm.graphPosition.update', 'fsm.graphPositions.update', 'fsm.semanticRoundTrip.apply',
  'screen.create', 'screen.duplicate', 'screen.duplicateLayout', 'screen.rename', 'screen.resize', 'screen.delete', 'screen.reorder',
  'screen.createFromTemplate', 'screen.dsl.apply',
  'controlPanel.element.add', 'controlPanel.element.update', 'controlPanel.elements.update', 'controlPanel.elements.delete',
  'controlPanel.elements.group', 'controlPanel.elements.ungroup', 'controlPanel.elements.align', 'controlPanel.settings.update',
  'canvas.object.update', 'canvas.selection.set', 'canvas.object.add', 'canvas.bitmapLayer.add', 'canvas.objects.update', 'canvas.objects.delete',
  'font.glyph.update', 'font.glyphs.import',
  'measurement.add', 'measurement.update', 'measurement.delete',
  'tag.upsert', 'tag.delete', 'procedure.upsert', 'procedure.delete', 'alarm.upsert', 'alarm.delete'
] as const satisfies readonly ProjectCommand['type'][];

type MissingProjectCommandType = Exclude<ProjectCommand['type'], (typeof PROJECT_COMMAND_TYPES)[number]>;
const projectCommandTypesAreExhaustive: MissingProjectCommandType extends never ? true : never = true;
void projectCommandTypesAreExhaustive;

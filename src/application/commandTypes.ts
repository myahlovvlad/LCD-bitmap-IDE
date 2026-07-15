import type {
  CanvasObject,
  DisplayConfig,
  FontMetadata,
  FontVariantKey,
  Glyph,
  GlyphSet,
  GraphPosition,
  SavedMeasurement
} from '../domain';
import type {
  ControlPanelElement,
  FsmEvent,
  FsmState,
  FsmTransition,
  LcdBitmapProject,
  LcdScreen
} from '../domain/project';
import type { FsmInterchangeModelV1 } from '../fsm-interchange';
import type { ScreenInterchangeProjectV1 } from '../screen-interchange';

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

export type FsmStateAddCommand = BaseProjectCommand<'fsm.state.add', Record<string, never>>;
export type FsmStateUpdateCommand = BaseProjectCommand<
  'fsm.state.update',
  { stateId: string; updates: Partial<FsmState> }
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
export type FsmEventAddCommand = BaseProjectCommand<'fsm.event.add', { name?: string }>;
export type FsmEventUpdateCommand = BaseProjectCommand<
  'fsm.event.update',
  { eventId: string; updates: Partial<Pick<FsmEvent, 'name' | 'description'>> }
>;
export type FsmEventDeleteCommand = BaseProjectCommand<'fsm.event.delete', { eventId: string }>;
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

export type ProjectCommand =
  | ProjectUpdateMetadataCommand
  | ProjectUpdateDisplayConfigCommand
  | FsmStateAddCommand
  | FsmStateUpdateCommand
  | FsmStateDeleteCommand
  | FsmStateEnsureScreenCommand
  | FsmTransitionAddCommand
  | FsmTransitionUpdateCommand
  | FsmTransitionDeleteCommand
  | FsmEventAddCommand
  | FsmEventUpdateCommand
  | FsmEventDeleteCommand
  | FsmGraphPositionUpdateCommand
  | FsmGraphPositionsUpdateCommand
  | FsmSemanticRoundTripApplyCommand
  | ScreenCreateCommand
  | ScreenDuplicateCommand
  | ScreenRenameCommand
  | ScreenResizeCommand
  | ScreenDeleteCommand
  | ScreenReorderCommand
  | ScreenCreateFromTemplateCommand
  | ScreenDslApplyCommand
  | ControlPanelElementAddCommand
  | ControlPanelElementUpdateCommand
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
  | MeasurementDeleteCommand;

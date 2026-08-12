export type SemanticChangeKind = 'created' | 'updated' | 'deleted';

export type SemanticEntityType =
  | 'project'
  | 'display'
  | 'screen'
  | 'canvas-object'
  | 'fsm-state'
  | 'fsm-transition'
  | 'fsm-event'
  | 'fsm-layer'
  | 'backend-process'
  | 'graph-position'
  | 'control-panel'
  | 'control-panel-element'
  | 'font-glyph'
  | 'font'
  | 'measurement';

export interface SemanticChange {
  kind: SemanticChangeKind;
  entityType: SemanticEntityType;
  entityId: string;
  path: string;
  before?: unknown;
  after?: unknown;
}

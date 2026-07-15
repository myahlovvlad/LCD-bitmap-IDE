export type CompilerTraceSourceType =
  | 'project'
  | 'display'
  | 'screen'
  | 'canvas-object'
  | 'fsm-state'
  | 'fsm-event'
  | 'fsm-transition'
  | 'control-panel-element'
  | 'font'
  | 'font-glyph';

export interface CompilerTraceLink {
  readonly irPath: string;
  readonly sourceType: CompilerTraceSourceType;
  readonly sourceId: string;
  readonly sourcePath: string;
}

export interface CompilerTraceabilityMap {
  readonly links: readonly CompilerTraceLink[];
}

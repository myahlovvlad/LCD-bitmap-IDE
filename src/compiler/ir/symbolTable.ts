import type { CompilerTraceSourceType } from './traceability';

export type CompilerSymbolKind =
  | 'project'
  | 'screen'
  | 'fsm-state'
  | 'fsm-event'
  | 'fsm-transition'
  | 'control-panel-element'
  | 'font'
  | 'font-glyph';

export interface CompilerSymbolEntry {
  readonly kind: CompilerSymbolKind;
  readonly sourceType: CompilerTraceSourceType;
  readonly sourceId: string;
  readonly displayName: string;
  readonly baseSymbol: string;
  readonly symbol: string;
  readonly collisionGroup?: readonly string[];
}

export interface CompilerSymbolTable {
  readonly entries: readonly CompilerSymbolEntry[];
  readonly bySourceId: Readonly<Record<string, string>>;
  readonly collisions: readonly CompilerSymbolEntry[];
}

export function sanitizeCompilerSymbol(value: string, fallback = 'symbol'): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  return normalized.length > 0 ? normalized : fallback;
}

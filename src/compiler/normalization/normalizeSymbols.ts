import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { compilerDiagnostic, type CompilerDiagnostic } from '../validation/compilerDiagnostics';
import { sanitizeCompilerSymbol, type CompilerSymbolEntry, type CompilerSymbolKind, type CompilerSymbolTable } from '../ir/symbolTable';
import type { CompilerTraceSourceType } from '../ir/traceability';

export interface NormalizedSymbolsResult {
  readonly symbols: CompilerSymbolTable;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

export function normalizeSymbols(source: CompilerSourceSnapshot): NormalizedSymbolsResult {
  const entries = collectSymbolEntries(source);
  const grouped = groupBy(entries, (entry) => entry.baseSymbol);
  const withCollisions = entries.map((entry) => {
    const collisionGroup = grouped.get(entry.baseSymbol) ?? [];
    return collisionGroup.length > 1
      ? { ...entry, collisionGroup: collisionGroup.map((item) => sourceKey(item.sourceType, item.sourceId)) }
      : entry;
  });
  const collisions = withCollisions.filter((entry) => entry.collisionGroup);
  const bySourceId = Object.fromEntries(
    withCollisions.map((entry) => [sourceKey(entry.sourceType, entry.sourceId), entry.symbol])
  );
  const diagnostics = collisions.map((entry) => compilerDiagnostic(
    'compiler.source.symbol-collision',
    'warning',
    `Compiler symbol "${entry.baseSymbol}" is shared by multiple source entities.`,
    { entityType: entry.sourceType, entityId: entry.sourceId }
  ));

  return {
    symbols: {
      entries: withCollisions,
      bySourceId,
      collisions
    },
    diagnostics
  };
}

export function symbolFor(symbols: CompilerSymbolTable, sourceType: CompilerTraceSourceType, sourceId: string): string {
  return symbols.bySourceId[sourceKey(sourceType, sourceId)] ?? sanitizeCompilerSymbol(sourceId);
}

export function sourceKey(sourceType: CompilerTraceSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function collectSymbolEntries(source: CompilerSourceSnapshot): CompilerSymbolEntry[] {
  const { project } = source;
  const entries: CompilerSymbolEntry[] = [
    entry('project', 'project', project.meta.id, project.meta.name, project.meta.name)
  ];

  project.screenOrder.forEach((screenId) => {
    const screen = project.screens[screenId];
    if (screen) {
      entries.push(entry('screen', 'screen', screen.id, screen.name, `${screen.name}_screen`));
    }
  });
  project.fsm.stateOrder.forEach((stateId) => {
    const state = project.fsm.states[stateId];
    if (state) {
      entries.push(entry('fsm-state', 'fsm-state', state.id, state.title, `${state.title}_state`));
    }
  });
  project.fsm.eventOrder.forEach((eventId) => {
    const event = project.fsm.events[eventId];
    if (event) {
      entries.push(entry('fsm-event', 'fsm-event', event.id, event.name, `${event.name}_event`));
    }
  });
  project.fsm.transitionOrder.forEach((transitionId) => {
    const transition = project.fsm.transitions[transitionId];
    if (transition) {
      entries.push(entry('fsm-transition', 'fsm-transition', transition.id, transition.id, `${transition.id}_transition`));
    }
  });
  project.controlPanel.elementOrder.forEach((elementId) => {
    const element = project.controlPanel.elements[elementId];
    if (element) {
      entries.push(entry('control-panel-element', 'control-panel-element', element.id, element.id, `${element.id}_control`));
    }
  });
  source.loadedFonts?.forEach((font) => {
    entries.push(entry('font', 'font', font.id, font.name, `${font.name}_font`));
  });
  Object.entries(source.fontGlyphs ?? {}).forEach(([variant, glyphs]) => {
    Object.keys(glyphs).sort().forEach((char) => {
      entries.push(entry('font-glyph', 'font-glyph', `${variant}:${char}`, char, `glyph_${variant}_${char}`));
    });
  });

  return entries;
}

function entry(
  kind: CompilerSymbolKind,
  sourceType: CompilerTraceSourceType,
  sourceId: string,
  displayName: string,
  symbolInput: string
): CompilerSymbolEntry {
  const baseSymbol = sanitizeCompilerSymbol(symbolInput, kind.replace(/-/g, '_'));
  return {
    kind,
    sourceType,
    sourceId,
    displayName,
    baseSymbol,
    symbol: baseSymbol
  };
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  values.forEach((value) => {
    const key = keyFor(value);
    result.set(key, [...(result.get(key) ?? []), value]);
  });
  return result;
}

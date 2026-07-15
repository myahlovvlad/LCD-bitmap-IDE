import { canonicalizeFsmInterchange } from './canonical';
import { attributeList, boolValue, nullableValue, numberValue, parseAttributes } from './encoding';
import { FSM_INTERCHANGE_VERSION, type FsmInterchangeModelV1, type FsmParseDiagnostic, type FsmParseResult, type FsmSourceMapEntry } from './types';
import { validateFsmInterchange } from './validation';

export function writeFsmMermaid(model: FsmInterchangeModelV1): string {
  const canonical = canonicalizeFsmInterchange(model);
  const lines = [
    'stateDiagram-v2',
    '  direction LR',
    `%% lcdide:machine ${attributeList({ version: canonical.version, projectId: canonical.machine.projectId, name: canonical.machine.name })}`
  ];
  for (const state of canonical.states) {
    lines.push(`%% lcdide:state ${attributeList({
      id: state.id,
      title: state.title,
      type: state.stateType,
      initial: state.initial,
      terminal: state.terminal,
      subsystem: state.subsystem,
      origin: state.origin,
      screen: state.screenId,
      runtime: state.runtimeId,
      legacy: state.legacyIds.join(','),
      order: state.order
    })}`);
    if (state.initial) {
      lines.push(`  [*] --> ${safeMermaidId(state.id)}`);
    }
    lines.push(`  state "${escapeMermaidLabel(state.title)}" as ${safeMermaidId(state.id)}`);
  }
  for (const event of canonical.events) {
    lines.push(`%% lcdide:event ${attributeList({
      id: event.id,
      name: event.name,
      description: event.description,
      legacy: event.legacyTrigger,
      order: event.order
    })}`);
  }
  for (const entry of canonical.layout) {
    lines.push(`%% lcdide:layout ${attributeList({
      state: entry.stateId,
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      order: entry.order
    })}`);
  }
  for (const transition of canonical.transitions) {
    const event = canonical.events.find((item) => item.id === transition.eventId);
    lines.push(`%% lcdide:transition ${attributeList({
      id: transition.id,
      from: transition.from,
      to: transition.to,
      event: transition.eventId,
      mechanism: transition.mechanism,
      button: transition.buttonId,
      timer: transition.timerMs ?? undefined,
      fact: transition.fact,
      sourceHandle: transition.sourceHandle,
      targetHandle: transition.targetHandle,
      kind: transition.kind,
      condition: transition.condition,
      source: transition.source,
      backend: transition.backendProcessId,
      order: transition.order
    })}`);
    lines.push(`  ${safeMermaidId(transition.from)} --> ${safeMermaidId(transition.to)} : ${escapeMermaidLabel(event?.name ?? transition.eventId)}`);
  }
  return lines.join('\n');
}

export function parseFsmMermaid(source: string): FsmParseResult {
  const diagnostics: FsmParseDiagnostic[] = [];
  const sourceMap: FsmSourceMapEntry[] = [];
  const machine = { projectId: 'imported-fsm', name: undefined as string | undefined };
  const states = new Map<string, FsmInterchangeModelV1['states'][number]>();
  const events = new Map<string, FsmInterchangeModelV1['events'][number]>();
  const transitions = new Map<string, FsmInterchangeModelV1['transitions'][number]>();
  const layout = new Map<string, FsmInterchangeModelV1['layout'][number]>();
  const initialIds = new Set<string>();
  const lines = source.split(/\r?\n/);
  let skipRenderedTransition = false;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line === 'stateDiagram-v2' || line.startsWith('direction ')) {
      return;
    }
    if (line.startsWith('%%')) {
      parseDirective(line, lineNumber, diagnostics, sourceMap, machine, states, events, transitions, layout);
      skipRenderedTransition = /^%%\s*lcdide:transition\b/.test(line);
      return;
    }
    const initial = /^\[\*\]\s+-->\s+([A-Za-z_][A-Za-z0-9_-]*)$/.exec(line);
    if (initial) {
      initialIds.add(initial[1]);
      ensureState(states, initial[1], initial[1], states.size);
      return;
    }
    const alias = /^state\s+"((?:\\"|[^"])*)"\s+as\s+([A-Za-z_][A-Za-z0-9_-]*)$/.exec(line);
    if (alias) {
      ensureState(states, alias[2], alias[1].replace(/\\"/g, '"'), states.size);
      return;
    }
    const transition = /^([A-Za-z_][A-Za-z0-9_-]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/.exec(line);
    if (transition) {
      if (skipRenderedTransition) {
        skipRenderedTransition = false;
        return;
      }
      ensureState(states, transition[1], transition[1], states.size);
      ensureState(states, transition[2], transition[2], states.size);
      const eventName = transition[3]?.trim() || 'event';
      const eventId = safeEventId(eventName);
      if (!events.has(eventId)) {
        events.set(eventId, { id: eventId, name: eventName, order: events.size });
      }
      const id = `tr_${transition[1]}_${transition[2]}_${transitions.size + 1}`;
      transitions.set(id, {
        id,
        from: transition[1],
        to: transition[2],
        eventId,
        kind: 'navigation',
        condition: null,
        source: 'mermaid',
        backendProcessId: null,
        order: transitions.size
      });
      return;
    }
    diagnostics.push({ severity: 'error', code: 'fsm.mermaid.syntax', message: `Unsupported Mermaid line: ${line}`, line: lineNumber, column: 1 });
  });

  const model = canonicalizeFsmInterchange({
    version: FSM_INTERCHANGE_VERSION,
    machine,
    states: Array.from(states.values()).map((state) => ({ ...state, initial: state.initial || initialIds.has(state.id) })),
    events: Array.from(events.values()),
    transitions: Array.from(transitions.values()),
    layout: Array.from(layout.values())
  });
  const validation = validateFsmInterchange(model);
  diagnostics.push(...validation);
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), model, diagnostics, sourceMap };
}

function parseDirective(
  line: string,
  lineNumber: number,
  diagnostics: FsmParseDiagnostic[],
  sourceMap: FsmSourceMapEntry[],
  machine: { projectId: string; name?: string },
  states: Map<string, FsmInterchangeModelV1['states'][number]>,
  events: Map<string, FsmInterchangeModelV1['events'][number]>,
  transitions: Map<string, FsmInterchangeModelV1['transitions'][number]>,
  layout: Map<string, FsmInterchangeModelV1['layout'][number]>
): void {
  const directive = /^%%\s*lcdide:([A-Za-z-]+)\s*(.*)$/.exec(line);
  if (!directive) {
    return;
  }
  const attrs = parseAttributes(directive[2]);
  if (directive[1] === 'machine') {
    machine.projectId = attrs.projectId || machine.projectId;
    machine.name = attrs.name || undefined;
    sourceMap.push({ entityType: 'machine', entityId: machine.projectId, line: lineNumber, column: 1 });
    return;
  }
  if (directive[1] === 'state') {
    const id = attrs.id;
    if (!id) {
      diagnostics.push({ severity: 'error', code: 'fsm.mermaid.state-id-missing', message: 'State directive requires id', line: lineNumber, column: 1 });
      return;
    }
    states.set(id, {
      id,
      title: attrs.title || id,
      stateType: attrs.type || 'process',
      initial: boolValue(attrs.initial),
      terminal: boolValue(attrs.terminal),
      subsystem: attrs.subsystem || 'default',
      origin: attrs.origin || 'author',
      screenId: nullableValue(attrs.screen),
      runtimeId: nullableValue(attrs.runtime),
      legacyIds: attrs.legacy ? attrs.legacy.split(',').filter(Boolean) : [],
      order: numberValue(attrs.order, states.size)
    });
    sourceMap.push({ entityType: 'state', entityId: id, line: lineNumber, column: 1 });
    return;
  }
  if (directive[1] === 'event') {
    const id = attrs.id;
    if (!id) {
      diagnostics.push({ severity: 'error', code: 'fsm.mermaid.event-id-missing', message: 'Event directive requires id', line: lineNumber, column: 1 });
      return;
    }
    events.set(id, { id, name: attrs.name || id, description: attrs.description, legacyTrigger: attrs.legacy, order: numberValue(attrs.order, events.size) });
    sourceMap.push({ entityType: 'event', entityId: id, line: lineNumber, column: 1 });
    return;
  }
  if (directive[1] === 'layout') {
    const stateId = attrs.state;
    if (!stateId) {
      diagnostics.push({ severity: 'error', code: 'fsm.mermaid.layout-state-missing', message: 'Layout directive requires state', line: lineNumber, column: 1 });
      return;
    }
    layout.set(stateId, {
      stateId,
      x: numberValue(attrs.x),
      y: numberValue(attrs.y),
      width: attrs.width ? numberValue(attrs.width) : undefined,
      height: attrs.height ? numberValue(attrs.height) : undefined,
      order: numberValue(attrs.order, layout.size)
    });
    sourceMap.push({ entityType: 'layout', entityId: stateId, line: lineNumber, column: 1 });
    return;
  }
  if (directive[1] === 'transition') {
    const id = attrs.id;
    if (!id) {
      diagnostics.push({ severity: 'error', code: 'fsm.mermaid.transition-id-missing', message: 'Transition directive requires id', line: lineNumber, column: 1 });
      return;
    }
    transitions.set(id, {
      id,
      from: attrs.from,
      to: attrs.to,
      eventId: attrs.event,
      mechanism: attrs.mechanism as never,
      buttonId: nullableValue(attrs.button),
      timerMs: attrs.timer ? numberValue(attrs.timer) : null,
      fact: nullableValue(attrs.fact),
      sourceHandle: nullableValue(attrs.sourceHandle),
      targetHandle: nullableValue(attrs.targetHandle),
      kind: attrs.kind || 'navigation',
      condition: nullableValue(attrs.condition),
      source: nullableValue(attrs.source),
      backendProcessId: nullableValue(attrs.backend),
      order: numberValue(attrs.order, transitions.size)
    });
    sourceMap.push({ entityType: 'transition', entityId: id, line: lineNumber, column: 1 });
  }
}

function ensureState(states: Map<string, FsmInterchangeModelV1['states'][number]>, id: string, title: string, order: number): void {
  if (!states.has(id)) {
    states.set(id, {
      id,
      title,
      stateType: 'process',
      initial: false,
      terminal: false,
      subsystem: 'default',
      origin: 'mermaid',
      screenId: null,
      runtimeId: null,
      legacyIds: [],
      order
    });
  }
}

function safeMermaidId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^([^A-Za-z_])/, '_$1');
}

function safeEventId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'EVENT';
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

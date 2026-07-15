import { canonicalizeFsmInterchange } from './canonical';
import { attributeList, boolValue, encodeValue, nullableValue, numberValue, parseAttributes } from './encoding';
import { FSM_INTERCHANGE_VERSION, type FsmInterchangeModelV1, type FsmParseDiagnostic, type FsmParseResult, type FsmSourceMapEntry } from './types';
import { validateFsmInterchange } from './validation';

const BLOCKED_PATTERNS = /\b(import\s+(?!FSM\b|State\b|Event\b)|exec|eval|open|compile|__import__|subprocess|os\.|sys\.|pathlib|socket|requests|while\s|for\s|class\s|def\s|lambda\b|with\s)/;

export function writeFsmPythonDsl(model: FsmInterchangeModelV1): string {
  const canonical = canonicalizeFsmInterchange(model);
  const lines = [
    `fsm = FSM(${pythonArgs({ version: canonical.version, project_id: canonical.machine.projectId, name: canonical.machine.name })})`
  ];
  for (const state of canonical.states) {
    const layout = canonical.layout.find((entry) => entry.stateId === state.id);
    lines.push(`fsm.state(${pythonArgs({
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
      order: state.order,
      x: layout?.x,
      y: layout?.y,
      width: layout?.width,
      height: layout?.height
    })})`);
  }
  for (const event of canonical.events) {
    lines.push(`fsm.event(${pythonArgs({
      id: event.id,
      name: event.name,
      description: event.description,
      legacy: event.legacyTrigger,
      order: event.order
    })})`);
  }
  for (const transition of canonical.transitions) {
    lines.push(`fsm.transition(${pythonArgs({
      id: transition.id,
      from: transition.from,
      to: transition.to,
      event: transition.eventId,
      mechanism: transition.mechanism,
      button: transition.buttonId,
      timer: transition.timerMs ?? undefined,
      fact: transition.fact,
      source_handle: transition.sourceHandle,
      target_handle: transition.targetHandle,
      kind: transition.kind,
      condition: transition.condition,
      source: transition.source,
      backend: transition.backendProcessId,
      order: transition.order
    })})`);
  }
  return lines.join('\n');
}

export function parseFsmPythonDsl(source: string): FsmParseResult {
  const diagnostics: FsmParseDiagnostic[] = [];
  const sourceMap: FsmSourceMapEntry[] = [];
  const machine = { projectId: 'imported-fsm', name: undefined as string | undefined };
  const states = new Map<string, FsmInterchangeModelV1['states'][number]>();
  const events = new Map<string, FsmInterchangeModelV1['events'][number]>();
  const transitions = new Map<string, FsmInterchangeModelV1['transitions'][number]>();
  const layout = new Map<string, FsmInterchangeModelV1['layout'][number]>();

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line === 'from lcd_bitmap_ide import FSM, State, Event') {
      return;
    }
    if (BLOCKED_PATTERNS.test(line)) {
      diagnostics.push({ severity: 'error', code: 'fsm.python.blocked-construct', message: `Executable or unsafe construct is not allowed: ${line}`, line: lineNumber, column: 1 });
      return;
    }
    const assignment = /^fsm\s*=\s*FSM\((.*)\)$/.exec(line);
    if (assignment) {
      const attrs = parseAttributes(assignment[1]);
      machine.projectId = attrs.project_id || attrs.projectId || machine.projectId;
      machine.name = attrs.name || undefined;
      sourceMap.push({ entityType: 'machine', entityId: machine.projectId, line: lineNumber, column: 1 });
      return;
    }
    const call = /^fsm\.(state|event|transition|initial)\((.*)\)$/.exec(line);
    if (!call) {
      parseLegacyPythonLine(line, lineNumber, diagnostics, sourceMap, states, events, transitions);
      return;
    }
    const attrs = parseAttributes(call[2]);
    if (call[1] === 'state') {
      const id = attrs.id;
      if (!id) {
        diagnostics.push({ severity: 'error', code: 'fsm.python.state-id-missing', message: 'fsm.state requires id', line: lineNumber, column: 1 });
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
      if (attrs.x || attrs.y) {
        layout.set(id, {
          stateId: id,
          x: numberValue(attrs.x),
          y: numberValue(attrs.y),
          width: attrs.width ? numberValue(attrs.width) : undefined,
          height: attrs.height ? numberValue(attrs.height) : undefined,
          order: numberValue(attrs.order, layout.size)
        });
      }
      sourceMap.push({ entityType: 'state', entityId: id, line: lineNumber, column: 1 });
      return;
    }
    if (call[1] === 'event') {
      const id = attrs.id;
      if (!id) {
        diagnostics.push({ severity: 'error', code: 'fsm.python.event-id-missing', message: 'fsm.event requires id', line: lineNumber, column: 1 });
        return;
      }
      events.set(id, { id, name: attrs.name || id, description: attrs.description, legacyTrigger: attrs.legacy, order: numberValue(attrs.order, events.size) });
      sourceMap.push({ entityType: 'event', entityId: id, line: lineNumber, column: 1 });
      return;
    }
    if (call[1] === 'transition') {
      const id = attrs.id;
      if (!id) {
        diagnostics.push({ severity: 'error', code: 'fsm.python.transition-id-missing', message: 'fsm.transition requires id', line: lineNumber, column: 1 });
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
        sourceHandle: nullableValue(attrs.source_handle),
        targetHandle: nullableValue(attrs.target_handle),
        kind: attrs.kind || 'navigation',
        condition: nullableValue(attrs.condition),
        source: nullableValue(attrs.source),
        backendProcessId: nullableValue(attrs.backend),
        order: numberValue(attrs.order, transitions.size)
      });
      sourceMap.push({ entityType: 'transition', entityId: id, line: lineNumber, column: 1 });
    }
  });

  const model = canonicalizeFsmInterchange({
    version: FSM_INTERCHANGE_VERSION,
    machine,
    states: Array.from(states.values()),
    events: Array.from(events.values()),
    transitions: Array.from(transitions.values()),
    layout: Array.from(layout.values())
  });
  diagnostics.push(...validateFsmInterchange(model));
  return { ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'), model, diagnostics, sourceMap };
}

function parseLegacyPythonLine(
  line: string,
  lineNumber: number,
  diagnostics: FsmParseDiagnostic[],
  sourceMap: FsmSourceMapEntry[],
  states: Map<string, FsmInterchangeModelV1['states'][number]>,
  events: Map<string, FsmInterchangeModelV1['events'][number]>,
  transitions: Map<string, FsmInterchangeModelV1['transitions'][number]>
): void {
  if (line === 'from lcd_bitmap_ide import FSM, Screen' || line === 'fsm = FSM()') {
    return;
  }
  const screen = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Screen\(\s*["']([^"']+)["'](?:\s*,\s*title\s*=\s*["']([^"']+)["'])?\s*\)$/.exec(line);
  if (screen) {
    states.set(screen[2], {
      id: screen[2],
      title: screen[3] ?? screen[2],
      stateType: 'process',
      initial: states.size === 0,
      terminal: false,
      subsystem: 'default',
      origin: 'legacy-python',
      screenId: screen[2],
      runtimeId: null,
      legacyIds: [],
      order: states.size
    });
    sourceMap.push({ entityType: 'state', entityId: screen[2], line: lineNumber, column: 1 });
    return;
  }
  const transition = /^fsm\.transition\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)(?:.*?condition\s*=\s*(.+?))?\s*\)$/.exec(line);
  if (transition) {
    const from = resolveLegacyVar(transition[1], states);
    const to = resolveLegacyVar(transition[2], states);
    const eventName = cleanLegacyCondition(transition[3] ?? 'event');
    const eventId = eventName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'EVENT';
    if (!events.has(eventId)) {
      events.set(eventId, { id: eventId, name: eventName, legacyTrigger: eventName, order: events.size });
    }
    const id = `tr_${from}_${to}_${transitions.size + 1}`;
    transitions.set(id, { id, from, to, eventId, kind: 'navigation', condition: null, source: 'legacy-python', backendProcessId: null, order: transitions.size });
    sourceMap.push({ entityType: 'transition', entityId: id, line: lineNumber, column: 1 });
    return;
  }
  if (/\.text\(/.test(line) || /^fsm\.initial\(/.test(line)) {
    return;
  }
  diagnostics.push({ severity: 'error', code: 'fsm.python.syntax', message: `Unsupported Python DSL line: ${line}`, line: lineNumber, column: 1 });
}

function resolveLegacyVar(variable: string, states: Map<string, FsmInterchangeModelV1['states'][number]>): string {
  const normalized = variable.toLowerCase();
  return Array.from(states.values()).find((state) => state.id.replace(/-/g, '_').toLowerCase() === normalized)?.id ?? variable;
}

function cleanLegacyCondition(value: string): string {
  const btn = /btn\(\s*["']([^"')]+)["']?\)?/.exec(value);
  if (btn) {
    return `BTN_${btn[1]}`;
  }
  return value.replace(/^["']|["']$/g, '').trim() || 'event';
}

function pythonArgs(attributes: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeValue(value)}`)
    .join(', ');
}

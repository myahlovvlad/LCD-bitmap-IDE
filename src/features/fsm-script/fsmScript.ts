/**
 * @module features/fsm-script/fsmScript
 * @description Offline converters for the shared FSM model, Mermaid
 * stateDiagram-v2 text and a small Python-like LCD-bitmap IDE script dialect.
 */

import type { Project } from '../../renderer/types/domain';

export interface ScriptTextCommand {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: '1' | '2';
}

export interface ScriptScreenSpec {
  readonly id: string;
  readonly title: string;
  readonly texts: readonly ScriptTextCommand[];
}

export interface ScriptTransitionSpec {
  readonly from: string;
  readonly to: string;
  readonly trigger: string;
  readonly condition: string | null;
}

export interface ScriptFsmModel {
  readonly screens: readonly ScriptScreenSpec[];
  readonly transitions: readonly ScriptTransitionSpec[];
  readonly initialStateId: string | null;
}

/**
 * Generates Mermaid stateDiagram-v2 from the current LCD-bitmap IDE FSM model.
 */
export function projectToMermaid(project: Project, stateOrder: readonly string[], transitionOrder: readonly string[]): string {
  const lines = ['stateDiagram-v2', '  direction LR'];
  const initial = stateOrder.find((stateId) => project.states[stateId]?.initial) ?? stateOrder[0];
  if (initial) {
    lines.push(`  [*] --> ${safeMermaidId(initial)}`);
  }

  for (const stateId of stateOrder) {
    const state = project.states[stateId];
    if (!state) {
      continue;
    }
    lines.push(`  state "${escapeMermaidLabel(state.title || state.id)}" as ${safeMermaidId(state.id)}`);
  }

  for (const transitionId of transitionOrder) {
    const transition = project.transitions[transitionId];
    if (!transition) {
      continue;
    }
    const label = [transition.trigger, transition.condition].filter(Boolean).join(' / ');
    lines.push(`  ${safeMermaidId(transition.from)} --> ${safeMermaidId(transition.to)}${label ? ` : ${label}` : ''}`);
  }

  return lines.join('\n');
}

/**
 * Parses a practical subset of Mermaid stateDiagram-v2 into an FSM model.
 */
export function parseMermaidStateDiagram(source: string): ScriptFsmModel {
  const screens = new Map<string, ScriptScreenSpec>();
  const transitions: ScriptTransitionSpec[] = [];
  let initialStateId: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || line === 'stateDiagram-v2' || line.startsWith('direction ')) {
      continue;
    }

    const alias = /^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_-]*)$/.exec(line);
    if (alias) {
      ensureScreen(screens, alias[2], alias[1]);
      continue;
    }

    const transition = /^(\[\*\]|[A-Za-z_][A-Za-z0-9_-]*)\s+-->\s+(\[\*\]|[A-Za-z_][A-Za-z0-9_-]*)(?:\s*:\s*(.+))?$/.exec(line);
    if (!transition) {
      continue;
    }

    const from = transition[1];
    const to = transition[2];
    const label = transition[3]?.trim() ?? 'event';

    if (from === '[*]' && to !== '[*]') {
      initialStateId = to;
      ensureScreen(screens, to, to);
      continue;
    }

    if (from !== '[*]' && to !== '[*]') {
      ensureScreen(screens, from, from);
      ensureScreen(screens, to, to);
      transitions.push({ from, to, trigger: label, condition: null });
    }
  }

  return { screens: Array.from(screens.values()), transitions, initialStateId };
}

/**
 * Generates a readable Python specification for the current FSM and screens.
 * It is intentionally deterministic so it can be reviewed in version control.
 */
export function projectToPythonSpec(project: Project, stateOrder: readonly string[], transitionOrder: readonly string[]): string {
  const lines = [
    'from lcd_bitmap_ide import FSM, Screen',
    '',
    'fsm = FSM()'
  ];

  for (const stateId of stateOrder) {
    const state = project.states[stateId];
    if (!state) {
      continue;
    }
    const varName = pythonVar(state.id);
    lines.push(`${varName} = Screen("${escapePythonString(state.id)}", title="${escapePythonString(state.title || state.id)}")`);
    const canvas = project.canvasByStateId[state.id];
    for (const object of canvas?.objects ?? []) {
      if (object.type === 'text') {
        lines.push(`${varName}.text("${escapePythonString(object.text.en || object.text.ru)}", x=${object.x}, y=${object.y}, font=${object.fontVariant})`);
      }
    }
    lines.push('');
  }

  const initial = stateOrder.find((stateId) => project.states[stateId]?.initial) ?? stateOrder[0];
  if (initial) {
    lines.push(`fsm.initial(${pythonVar(initial)})`);
  }

  for (const transitionId of transitionOrder) {
    const transition = project.transitions[transitionId];
    if (!transition) {
      continue;
    }
    lines.push(
      `fsm.transition(${pythonVar(transition.from)}, ${pythonVar(transition.to)}, condition="${escapePythonString(transition.trigger)}")`
    );
  }

  return lines.join('\n');
}

/**
 * Parses the LCD-bitmap IDE Python-like DSL. The parser is deliberately conservative:
 * it extracts declarative Screen(), .text() and fsm.transition() calls without
 * evaluating arbitrary Python code.
 */
export function parsePythonFsmScript(source: string): ScriptFsmModel {
  const variables = new Map<string, string>();
  const screens = new Map<string, ScriptScreenSpec>();
  const transitions: ScriptTransitionSpec[] = [];
  let initialStateId: string | null = null;

  const screenRegex = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Screen\(\s*["']([^"']+)["'](?:\s*,\s*title\s*=\s*["']([^"']+)["'])?/;
  const textRegex = /^([A-Za-z_][A-Za-z0-9_]*)\.text\(\s*["']([^"']*)["'](?:.*?x\s*=\s*(-?\d+))?(?:.*?y\s*=\s*(-?\d+))?(?:.*?font\s*=\s*([12]))?/;
  const initialRegex = /^fsm\.initial\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/;
  const transitionRegex = /^fsm\.transition\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)(?:.*?condition\s*=\s*(.+?))?\s*\)/;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('from ') || line.startsWith('fsm =')) {
      continue;
    }

    const screen = screenRegex.exec(line);
    if (screen) {
      variables.set(screen[1], screen[2]);
      ensureScreen(screens, screen[2], screen[3] ?? screen[2]);
      continue;
    }

    const text = textRegex.exec(line);
    if (text) {
      const screenId = variables.get(text[1]);
      if (!screenId) {
        continue;
      }
      const existing = ensureScreen(screens, screenId, screenId);
      screens.set(screenId, {
        ...existing,
        texts: [
          ...existing.texts,
          {
            text: text[2],
            x: Number.parseInt(text[3] ?? '0', 10),
            y: Number.parseInt(text[4] ?? '0', 10),
            font: text[5] === '2' ? '2' : '1'
          }
        ]
      });
      continue;
    }

    const initial = initialRegex.exec(line);
    if (initial) {
      initialStateId = variables.get(initial[1]) ?? null;
      continue;
    }

    const transition = transitionRegex.exec(line);
    if (transition) {
      const from = variables.get(transition[1]);
      const to = variables.get(transition[2]);
      if (!from || !to) {
        continue;
      }
      transitions.push({
        from,
        to,
        trigger: cleanPythonCondition(transition[3] ?? 'event'),
        condition: null
      });
    }
  }

  return { screens: Array.from(screens.values()), transitions, initialStateId };
}

function ensureScreen(screens: Map<string, ScriptScreenSpec>, id: string, title: string): ScriptScreenSpec {
  const existing = screens.get(id);
  if (existing) {
    return existing;
  }
  const created = { id, title, texts: [] };
  screens.set(id, created);
  return created;
}

function safeMermaidId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^([^A-Za-z_])/, '_$1');
}

function pythonVar(value: string): string {
  return safeMermaidId(value).replace(/-/g, '_').toLowerCase();
}

function escapeMermaidLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}

function escapePythonString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function cleanPythonCondition(value: string): string {
  const btn = /btn\(\s*["']([^"')]+)["']?\)?/.exec(value);
  if (btn) {
    return `BTN_${btn[1]}`;
  }
  const signal = /signal\(\s*["']([^"')]+)["']?\)?/.exec(value);
  if (signal) {
    return signal[1];
  }
  return value.replace(/^["']|["']$/g, '').trim() || 'event';
}

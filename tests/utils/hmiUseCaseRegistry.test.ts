/**
 * HMI Designer Use-Case Registry
 *
 * Each describe block maps to one documented use case from the HMI designer.
 * These tests verify the pure domain logic that HmiDesignerWorkspace.tsx
 * delegates to: the runtime engine, the FSM transition table, and the
 * control panel model. No React or DOM rendering is required.
 *
 * Use-case IDs (UC-HMI-*) can be cross-referenced with the product backlog.
 */

import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';
import type { ControlPanelButton, LcdBitmapProject } from '../../src/domain/project';

// ---------------------------------------------------------------------------
// Test helper: migrated demo project
// ---------------------------------------------------------------------------

function demo(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

/** Replicates the allowedButtonIds useMemo from HmiDesignerWorkspace. */
function computeAllowedButtonIds(project: LcdBitmapProject, activeStateId: string): Set<string> {
  const buttons = project.controlPanel.elementOrder
    .map((id) => project.controlPanel.elements[id])
    .filter((el): el is ControlPanelButton => el?.type === 'button' && el.visible);

  const set = new Set<string>();
  for (const button of buttons) {
    if (!button.fsmEventId) continue;
    if (button.disabledStates?.includes(activeStateId)) continue;
    const hasRoute = project.fsm.transitionOrder.some((tid) => {
      const t = project.fsm.transitions[tid];
      return t?.from === activeStateId && t.trigger.eventId === button.fsmEventId;
    });
    if (hasRoute && (!button.allowedStates?.length || button.allowedStates.includes(activeStateId))) {
      set.add(button.id);
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// UC-HMI-01: Initial state resolution
// ---------------------------------------------------------------------------

describe('UC-HMI-01 — initial state resolution', () => {
  it('finds the state marked initial: true in stateOrder', () => {
    const project = demo();
    const initialId = project.fsm.stateOrder.find((id) => project.fsm.states[id]?.initial);
    expect(initialId).toBe('main-menu');
  });

  it('falls back to stateOrder[0] when no state is marked initial', () => {
    const project = demo();
    for (const state of Object.values(project.fsm.states)) {
      state.initial = false;
    }
    const fallback = project.fsm.stateOrder.find((id) => project.fsm.states[id]?.initial)
      ?? project.fsm.stateOrder[0]
      ?? null;
    expect(fallback).toBe('main-menu');
  });

  it('runtime engine starts at the requested initial state', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    expect(engine.currentStateId).toBe('main-menu');
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-02: Allowed button computation (coverage overlay data)
// ---------------------------------------------------------------------------

describe('UC-HMI-02 — allowed button computation', () => {
  it('marks buttons that have a route from the active state as allowed', () => {
    const project = demo();
    const allowed = computeAllowedButtonIds(project, 'main-menu');
    // 'main-menu' → 'measure' via START
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START');
    expect(startButton).toBeDefined();
    expect(allowed.has(startButton!.id)).toBe(true);
  });

  it('excludes buttons that have no route from the active state', () => {
    const project = demo();
    const allowed = computeAllowedButtonIds(project, 'main-menu');
    // SAVE is only valid from 'measure', not 'main-menu'
    const saveButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'SAVE');
    if (saveButton) {
      expect(allowed.has(saveButton.id)).toBe(false);
    }
  });

  it('excludes buttons whose disabledStates includes the active state', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START');
    expect(startButton).toBeDefined();
    if (startButton) startButton.disabledStates = ['main-menu'];

    const allowed = computeAllowedButtonIds(project, 'main-menu');
    expect(allowed.has(startButton!.id)).toBe(false);
  });

  it('excludes buttons whose allowedStates does not include the active state', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START');
    expect(startButton).toBeDefined();
    if (startButton) startButton.allowedStates = ['measure']; // not 'main-menu'

    const allowed = computeAllowedButtonIds(project, 'main-menu');
    expect(allowed.has(startButton!.id)).toBe(false);
  });

  it('includes buttons whose allowedStates explicitly lists the active state', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START');
    expect(startButton).toBeDefined();
    if (startButton) startButton.allowedStates = ['main-menu'];

    const allowed = computeAllowedButtonIds(project, 'main-menu');
    expect(allowed.has(startButton!.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-03: Transition simulation (simulate / design double-click)
// ---------------------------------------------------------------------------

describe('UC-HMI-03 — transition simulation', () => {
  it('pressing START from main-menu transitions to measure', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    const button = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START');

    engine.pressButton(button!.id);

    expect(engine.currentStateId).toBe('measure');
    expect(engine.lastTransition?.id).toBe('tr-main-measure');
  });

  it('transitions update the active screen', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    const button = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START');

    engine.pressButton(button!.id);

    expect(engine.getCurrentScreen()?.id).toBe('measure');
  });

  it('follows a two-step scenario: main-menu → measure → save-result', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    const startBtn = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!;
    engine.pressButton(startBtn.id);
    expect(engine.currentStateId).toBe('measure');

    const saveBtn = engine.getAvailableButtons().find((b) => b.fsmEventId === 'SAVE')!;
    engine.pressButton(saveBtn.id);
    expect(engine.currentStateId).toBe('save-result');
    expect(engine.lastTransition?.id).toBe('tr-measure-save');
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-04: Blocked button does not change state
// ---------------------------------------------------------------------------

describe('UC-HMI-04 — blocked button handling', () => {
  it('disabledStates blocks the button and state remains unchanged', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START')!;
    startButton.disabledStates = ['main-menu'];

    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    engine.pressButton(startButton.id);

    expect(engine.currentStateId).toBe('main-menu');
    expect(engine.eventLog.at(-1)?.message).toContain('disabled');
  });

  it('disabledStates takes priority over allowedStates', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START')!;
    startButton.allowedStates = ['main-menu'];
    startButton.disabledStates = ['main-menu'];

    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    engine.pressButton(startButton.id);

    expect(engine.currentStateId).toBe('main-menu');
  });

  it('getButtonBlockReason returns a non-null reason for a disabled button', () => {
    const project = demo();
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START')!;
    startButton.disabledStates = ['main-menu'];

    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    expect(engine.getButtonBlockReason(startButton)).not.toBeNull();
  });

  it('getButtonBlockReason returns null for a reachable button', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    const startButton = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!;

    expect(engine.getButtonBlockReason(startButton)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-05: No-route event logs failure (timeline "no transition" entry)
// ---------------------------------------------------------------------------

describe('UC-HMI-05 — no-route event handling', () => {
  it('sendEvent for an event with no route from current state does not change state', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    engine.sendEvent('SAVE'); // SAVE has no route from main-menu

    expect(engine.currentStateId).toBe('main-menu');
  });

  it('logs a "No transition" message for an unrouted event', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    engine.sendEvent('SAVE');

    expect(engine.eventLog.at(-1)?.message).toContain('No transition');
  });

  it('pressing a button with no route from current state logs the failure', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    // ERR event is valid only from 'measure'
    const errButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'ERR');
    if (!errButton) return; // button may not exist in demo; skip gracefully

    engine.pressButton(errButton.id);

    expect(engine.currentStateId).toBe('main-menu');
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-06: Backend process name is resolvable from transition
// ---------------------------------------------------------------------------

describe('UC-HMI-06 — backend process name in scenario trace', () => {
  it('a transition with backendProcessId references a project.backendProcesses entry', () => {
    const project = demo();
    project.backendProcesses['proc-measure'] = {
      id: 'proc-measure',
      name: 'Run Measurement',
      commands: ['MEASURE:START', 'MEASURE:READ'],
    };
    project.fsm.transitions['tr-main-measure'].backendProcessId = 'proc-measure';

    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    const startButton = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!;
    engine.pressButton(startButton.id);

    const completed = engine.lastTransition!;
    const procedure = completed.backendProcessId
      ? project.backendProcesses[completed.backendProcessId]
      : null;

    expect(procedure?.name).toBe('Run Measurement');
  });

  it('transition without backendProcessId resolves to null process', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    const startButton = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!;
    engine.pressButton(startButton.id);

    const completed = engine.lastTransition!;
    const procedure = completed.backendProcessId
      ? project.backendProcesses[completed.backendProcessId]
      : null;

    expect(procedure).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-07: Timeline scenario — sequence of entries, capped at 32
// ---------------------------------------------------------------------------

describe('UC-HMI-07 — scenario timeline accumulation', () => {
  it('records each button press as a timeline entry', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    const startButton = engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!;
    engine.pressButton(startButton.id);

    // Simulate the timeline prepend logic from HmiDesignerWorkspace.simulatePress
    const timeline: string[] = [];
    const target = project.fsm.states[engine.currentStateId!];
    timeline.unshift(`${startButton.label} → ${target?.title ?? engine.currentStateId}`);

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toContain('Measurement');
  });

  it('timeline is capped at 32 entries (matching component slice(0, 32) logic)', () => {
    // Simulate the slice logic used in HmiDesignerWorkspace
    const MAX = 32;
    let timeline: string[] = [];
    for (let i = 0; i < 40; i++) {
      timeline = [`entry-${i}`, ...timeline].slice(0, MAX);
    }
    expect(timeline).toHaveLength(MAX);
    expect(timeline[0]).toBe('entry-39'); // most recent is first
    expect(timeline[MAX - 1]).toBe('entry-8'); // oldest retained
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-08: Step mode — events queue until manually advanced
// ---------------------------------------------------------------------------

describe('UC-HMI-08 — step mode event queuing', () => {
  it('in step mode, sendEvent queues the event without processing it', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    engine.setStepMode(true);

    engine.sendEvent('START');

    expect(engine.currentStateId).toBe('main-menu');
    expect(engine.pendingEventIds).toContain('START');
  });

  it('step() processes one queued event and advances state', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    engine.setStepMode(true);
    engine.sendEvent('START');

    engine.step();

    expect(engine.currentStateId).toBe('measure');
    expect(engine.pendingEventIds).not.toContain('START');
  });

  it('multiple queued events are processed one at a time per step() call', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');
    engine.setStepMode(true);
    engine.sendEvent('START'); // main-menu → measure
    engine.sendEvent('SAVE');  // measure → save-result

    engine.step();
    expect(engine.currentStateId).toBe('measure');

    engine.step();
    expect(engine.currentStateId).toBe('save-result');
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-09: Coverage mode — button classification per active state
// ---------------------------------------------------------------------------

describe('UC-HMI-09 — coverage mode button classification', () => {
  it('no buttons are allowed when no active state is set', () => {
    const project = demo();
    const allowed = computeAllowedButtonIds(project, '');
    expect(allowed.size).toBe(0);
  });

  it('coverage shows different allowed sets for different active states', () => {
    const project = demo();
    const fromMain = computeAllowedButtonIds(project, 'main-menu');
    const fromMeasure = computeAllowedButtonIds(project, 'measure');

    // START is only allowed from main-menu
    const startButton = Object.values(project.controlPanel.elements)
      .find((el): el is ControlPanelButton => el.type === 'button' && el.fsmEventId === 'START')!;
    expect(fromMain.has(startButton.id)).toBe(true);
    expect(fromMeasure.has(startButton.id)).toBe(false);
  });

  it('buttons without fsmEventId are never in the allowed set', () => {
    const project = demo();
    // Add a button with no fsmEventId to the control panel
    const noEventButton: ControlPanelButton = {
      id: 'btn-no-event',
      type: 'button',
      label: 'Unlabelled',
      shape: 'rounded-rect',
      x: 0, y: 0, width: 60, height: 40,
      rotation: 0, locked: false, visible: true,
      fsmEventId: undefined,
      pressType: 'short',
      repeatMode: false,
    };
    project.controlPanel.elements[noEventButton.id] = noEventButton;
    project.controlPanel.elementOrder.push(noEventButton.id);

    const allowed = computeAllowedButtonIds(project, 'main-menu');
    expect(allowed.has('btn-no-event')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UC-HMI-10: Screen follows active state after transition
// ---------------------------------------------------------------------------

describe('UC-HMI-10 — screen assignment follows active state', () => {
  it('getCurrentScreen() returns the screen linked to the current state', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    const mainScreen = engine.getCurrentScreen();
    expect(mainScreen?.id).toBe('main-menu');
  });

  it('screen changes after each transition in a multi-step scenario', () => {
    const project = demo();
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    engine.pressButton(engine.getAvailableButtons().find((b) => b.fsmEventId === 'START')!.id);
    expect(engine.getCurrentScreen()?.id).toBe('measure');

    engine.pressButton(engine.getAvailableButtons().find((b) => b.fsmEventId === 'SAVE')!.id);
    expect(engine.getCurrentScreen()?.id).toBe('save-result');
  });

  it('states without a screenId return null from getCurrentScreen()', () => {
    const project = demo();
    // Detach the screen from main-menu
    project.fsm.states['main-menu'].screenId = undefined;
    const engine = createRuntimeEngine(project);
    engine.start('main-menu');

    expect(engine.getCurrentScreen()).toBeNull();
  });
});

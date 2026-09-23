import { describe, expect, it } from 'vitest';
import { runFsmScenario } from '../../src/services/runtime/fsmScenarioRunner';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import type { ControlPanelButton } from '../../src/domain/project';
import { createEffectInvocation, serializeEffectInvocations, RUNTIME_TAG_SET_EFFECT, RUNTIME_TAG_SET_FROM_INPUT_EFFECT, createGuardInvocation, serializeGuardInvocation, RUNTIME_TAG_EQUALS_TAG_GUARD, RUNTIME_TAG_INCREMENT_EFFECT, RUNTIME_TAG_COPY_EFFECT } from '../../src/fsm-behavior';

function loadDemoProject() {
  return migrateLegacySnapshot(createDemoProject()).project;
}

function addStartButton(project: ReturnType<typeof loadDemoProject>, allowedStates: string[]): void {
  const button: ControlPanelButton = {
    id: 'btn-start',
    type: 'button',
    x: 0, y: 0, width: 40, height: 20, rotation: 0, locked: false, visible: true,
    label: 'Start',
    shape: 'rect',
    fsmEventId: 'START',
    allowedStates
  };
  project.controlPanel.elements[button.id] = button;
  project.controlPanel.elementOrder.push(button.id);
}

describe('runFsmScenario', () => {
  it('follows a real navigation transition and reports it in the trace', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(project, [{ type: 'event', eventId: 'START' }], { initialStateId: 'main-menu' });

    expect(result.initialStateId).toBe('main-menu');
    expect(result.finalStateId).toBe('measure');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      index: 0,
      stateIdBefore: 'main-menu',
      stateIdAfter: 'measure',
      transitionId: 'tr-main-measure',
      blocked: false
    });
  });

  it('reports a blocked step and leaves state unchanged when no transition matches the event', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(project, [{ type: 'event', eventId: 'SAVE' }], { initialStateId: 'main-menu' });

    expect(result.finalStateId).toBe('main-menu');
    expect(result.steps[0].blocked).toBe(true);
    expect(result.steps[0].blockReason).toContain('SAVE');
    expect(result.steps[0].stateIdBefore).toBe(result.steps[0].stateIdAfter);
  });

  it('runs a scripted multi-step scenario and reports the running total in the trace', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(
      project,
      [
        { type: 'event', eventId: 'START' }, // main-menu -> measure
        { type: 'event', eventId: 'SAVE' }    // no transition from measure either in the demo project
      ],
      { initialStateId: 'main-menu' }
    );

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].stateIdAfter).toBe('measure');
    expect(result.steps[1].stateIdBefore).toBe('measure');
    expect(result.finalStateId).toBe(result.steps[1].stateIdAfter);
  });

  it('drives a control-panel button through the same transition as its bound event', async () => {
    const project = loadDemoProject();
    addStartButton(project, ['main-menu']);
    const result = await runFsmScenario(project, [{ type: 'button', buttonId: 'btn-start' }], { initialStateId: 'main-menu' });

    expect(result.steps[0].blocked).toBe(false);
    expect(result.finalStateId).toBe('measure');
  });

  it('blocks a button press when the current state is not in the button\'s allowedStates', async () => {
    const project = loadDemoProject();
    addStartButton(project, ['measure']); // not allowed from main-menu
    const result = await runFsmScenario(project, [{ type: 'button', buttonId: 'btn-start' }], { initialStateId: 'main-menu' });

    expect(result.steps[0].blocked).toBe(true);
    expect(result.finalStateId).toBe('main-menu');
  });

  it('reports a clear reason for an unknown button id instead of throwing', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(project, [{ type: 'button', buttonId: 'does-not-exist' }], { initialStateId: 'main-menu' });

    expect(result.steps[0].blocked).toBe(true);
    expect(result.steps[0].blockReason).toContain('does-not-exist');
  });

  it('applies tag writes and reflects them in the final tag snapshot', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(
      project,
      [{ type: 'tag', tagId: 'io.usb_present', value: true }],
      { initialStateId: 'main-menu' }
    );

    expect(result.tags['io.usb_present']).toBe(true);
    expect(result.steps[0].blocked).toBe(false);
  });

  it('applies a runtime.tag.set typed effect as a transition commits, and a later transition can branch on it', async () => {
    const project = loadDemoProject();
    project.fsm.transitions['tr-main-measure'].backendProcessId = serializeEffectInvocations([
      createEffectInvocation(RUNTIME_TAG_SET_EFFECT, { tagId: 'demo.mode', value: 'measured' })
    ]);

    const result = await runFsmScenario(project, [{ type: 'event', eventId: 'START' }], { initialStateId: 'main-menu' });

    expect(result.steps[0].blocked).toBe(false);
    expect(result.finalStateId).toBe('measure');
    expect(result.tags['demo.mode']).toBe('measured');
  });

  it('applies a runtime.tag.set_from_input typed effect, capturing the keypad-typed value into a tag', async () => {
    const project = loadDemoProject();
    if (!project.fsm.events['UI.OK']) {
      project.fsm.events['UI.OK'] = { id: 'UI.OK', name: 'OK', description: 'Confirm', scope: 'global', sourceStateId: null };
      project.fsm.eventOrder.push('UI.OK');
    }
    if (!project.fsm.events['UI.K3']) {
      project.fsm.events['UI.K3'] = { id: 'UI.K3', name: '3', description: 'Digit 3', scope: 'global', sourceStateId: null };
      project.fsm.eventOrder.push('UI.K3');
    }
    project.fsm.states['count-entry'] = {
      id: 'count-entry', runtimeId: null, legacyIds: [], title: 'Count entry', subsystem: 'demo',
      stateType: 'process', origin: 'user', screenId: null,
      input: { mode: 'numeric', maxLength: 1 }, initial: false, terminal: false,
    };
    project.fsm.stateOrder.push('count-entry');
    const digitButton: ControlPanelButton = {
      id: 'btn-digit-3', type: 'button', x: 0, y: 0, width: 20, height: 20, rotation: 0, locked: false, visible: true,
      label: '3', shape: 'rect', fsmEventId: 'UI.K3', allowedStates: [],
    };
    const okButton: ControlPanelButton = {
      id: 'btn-count-ok', type: 'button', x: 0, y: 0, width: 20, height: 20, rotation: 0, locked: false, visible: true,
      label: 'OK', shape: 'rect', fsmEventId: 'UI.OK', allowedStates: [],
    };
    project.controlPanel.elements[digitButton.id] = digitButton;
    project.controlPanel.elementOrder.push(digitButton.id);
    project.controlPanel.elements[okButton.id] = okButton;
    project.controlPanel.elementOrder.push(okButton.id);
    project.fsm.transitions['tr-count-entry-confirm'] = {
      id: 'tr-count-entry-confirm', from: 'count-entry', to: 'measure',
      sourceHandle: null, targetHandle: null,
      trigger: { mechanism: 'button', buttonId: 'btn-count-ok', timerMs: null, fact: null, eventId: 'UI.OK' },
      kind: 'navigation', condition: null, source: 'user',
      backendProcessId: serializeEffectInvocations([createEffectInvocation(RUNTIME_TAG_SET_FROM_INPUT_EFFECT, { tagId: 'demo.count' })]),
      // (contract id itself is 'runtime.tag.set-from-input' — no underscores, per the fsm-behavior safety regex)
      labelMode: null,
    };
    project.fsm.transitionOrder.push('tr-count-entry-confirm');

    const result = await runFsmScenario(
      project,
      [
        { type: 'button', buttonId: 'btn-digit-3' },
        { type: 'button', buttonId: 'btn-count-ok' },
      ],
      { initialStateId: 'count-entry' }
    );

    expect(result.steps.map((s) => s.blocked)).toEqual([false, false]);
    expect(result.finalStateId).toBe('measure');
    expect(result.tags['demo.count']).toBe(3);
  });

  it('applies the typed effect of the condition-satisfying sibling, not the first transition sharing (from, eventId)', async () => {
    // Regression test: OrchestratedRuntimeEngine.resolveEventTarget() used to pick
    // the first transitionOrder match for (from, eventId) regardless of `condition`,
    // so when a conditioned transition carrying a typed effect had a same-event
    // sibling with a different condition, the effect could silently be read off the
    // wrong (non-matching) sibling instead of the one whose guard actually holds.
    const project = loadDemoProject();
    if (!project.fsm.events['UI.OK']) {
      project.fsm.events['UI.OK'] = { id: 'UI.OK', name: 'OK', description: 'Confirm', scope: 'global', sourceStateId: null };
      project.fsm.eventOrder.push('UI.OK');
    }
    project.fsm.states['branch-entry'] = {
      id: 'branch-entry', runtimeId: null, legacyIds: [], title: 'Branch entry', subsystem: 'demo',
      stateType: 'process', origin: 'user', screenId: null,
      initial: false, terminal: false,
    };
    project.fsm.stateOrder.push('branch-entry');
    const okButton: ControlPanelButton = {
      id: 'btn-branch-ok', type: 'button', x: 0, y: 0, width: 20, height: 20, rotation: 0, locked: false, visible: true,
      label: 'OK', shape: 'rect', fsmEventId: 'UI.OK', allowedStates: [],
    };
    project.controlPanel.elements[okButton.id] = okButton;
    project.controlPanel.elementOrder.push(okButton.id);

    // True-branch sibling added FIRST in transitionOrder, carries no effect.
    project.fsm.transitions['tr-branch-true'] = {
      id: 'tr-branch-true', from: 'branch-entry', to: 'measure',
      sourceHandle: null, targetHandle: null,
      trigger: { mechanism: 'button', buttonId: 'btn-branch-ok', timerMs: null, fact: null, eventId: 'UI.OK' },
      kind: 'navigation', condition: 'io.usb_present==true', source: 'user',
      backendProcessId: null, labelMode: null,
    };
    project.fsm.transitionOrder.push('tr-branch-true');
    // False-branch sibling added SECOND, carries the typed effect under test.
    project.fsm.transitions['tr-branch-false'] = {
      id: 'tr-branch-false', from: 'branch-entry', to: 'measure',
      sourceHandle: null, targetHandle: null,
      trigger: { mechanism: 'button', buttonId: 'btn-branch-ok', timerMs: null, fact: null, eventId: 'UI.OK' },
      kind: 'navigation', condition: 'io.usb_present==false', source: 'user',
      backendProcessId: serializeEffectInvocations([createEffectInvocation(RUNTIME_TAG_SET_EFFECT, { tagId: 'demo.branch', value: 'false-path' })]),
      labelMode: null,
    };
    project.fsm.transitionOrder.push('tr-branch-false');

    const result = await runFsmScenario(
      project,
      [
        { type: 'tag', tagId: 'io.usb_present', value: false },
        { type: 'button', buttonId: 'btn-branch-ok' },
      ],
      { initialStateId: 'branch-entry' }
    );

    expect(result.steps.map((s) => s.blocked)).toEqual([false, false]);
    expect(result.finalStateId).toBe('measure');
    expect(result.tags['demo.branch']).toBe('false-path');
  });

  it('routes on a runtime.tag.equals-tag guard, comparing two tags rather than a tag against a literal', async () => {
    // Regression/capability test: guards previously could only compare a tag
    // against a fixed literal (e.g. io.usb_present==false). Verifying an
    // entered value (e.g. a keypad-typed PIN) against an admin-editable
    // stored value requires comparing two tags at runtime, which is what this
    // contract adds.
    const project = loadDemoProject();
    if (!project.fsm.events['UI.OK']) {
      project.fsm.events['UI.OK'] = { id: 'UI.OK', name: 'OK', description: 'Confirm', scope: 'global', sourceStateId: null };
      project.fsm.eventOrder.push('UI.OK');
    }
    project.fsm.states['pin-check'] = {
      id: 'pin-check', runtimeId: null, legacyIds: [], title: 'Pin check', subsystem: 'demo',
      stateType: 'process', origin: 'user', screenId: null, initial: false, terminal: false,
    };
    project.fsm.stateOrder.push('pin-check');
    const okButton: ControlPanelButton = {
      id: 'btn-pin-ok', type: 'button', x: 0, y: 0, width: 20, height: 20, rotation: 0, locked: false, visible: true,
      label: 'OK', shape: 'rect', fsmEventId: 'UI.OK', allowedStates: [],
    };
    project.controlPanel.elements[okButton.id] = okButton;
    project.controlPanel.elementOrder.push(okButton.id);

    // Match branch tried first: guarded by the new tag-vs-tag contract.
    project.fsm.transitions['tr-pin-match'] = {
      id: 'tr-pin-match', from: 'pin-check', to: 'measure',
      sourceHandle: null, targetHandle: null,
      trigger: { mechanism: 'button', buttonId: 'btn-pin-ok', timerMs: null, fact: null, eventId: 'UI.OK' },
      kind: 'navigation', source: 'user', backendProcessId: null, labelMode: null,
      condition: serializeGuardInvocation(createGuardInvocation(RUNTIME_TAG_EQUALS_TAG_GUARD, { tagId: 'auth.entered_pin', compareTagId: 'auth.stored_pin' })),
    };
    project.fsm.transitionOrder.push('tr-pin-match');
    // Fallback: unconditioned, only reached when the guarded branch above doesn't match.
    project.fsm.transitions['tr-pin-mismatch'] = {
      id: 'tr-pin-mismatch', from: 'pin-check', to: 'main-menu',
      sourceHandle: null, targetHandle: null,
      trigger: { mechanism: 'button', buttonId: 'btn-pin-ok', timerMs: null, fact: null, eventId: 'UI.OK' },
      kind: 'navigation', condition: null, source: 'user', backendProcessId: null, labelMode: null,
    };
    project.fsm.transitionOrder.push('tr-pin-mismatch');

    const matching = await runFsmScenario(project, [
      { type: 'tag', tagId: 'auth.stored_pin', value: '1234' },
      { type: 'tag', tagId: 'auth.entered_pin', value: '1234' },
      { type: 'button', buttonId: 'btn-pin-ok' },
    ], { initialStateId: 'pin-check' });
    expect(matching.finalStateId).toBe('measure');

    const mismatching = await runFsmScenario(project, [
      { type: 'tag', tagId: 'auth.stored_pin', value: '1234' },
      { type: 'tag', tagId: 'auth.entered_pin', value: '9999' },
      { type: 'button', buttonId: 'btn-pin-ok' },
    ], { initialStateId: 'pin-check' });
    expect(mismatching.finalStateId).toBe('main-menu');
  });

  it('applies a runtime.tag.increment effect, incrementing from an unset (zero) base and again from an existing value', async () => {
    const project = loadDemoProject();
    project.fsm.transitions['tr-main-measure'].backendProcessId = serializeEffectInvocations([
      createEffectInvocation(RUNTIME_TAG_INCREMENT_EFFECT, { tagId: 'demo.attempts' })
    ]);
    const first = await runFsmScenario(project, [{ type: 'event', eventId: 'START' }], { initialStateId: 'main-menu' });
    expect(first.tags['demo.attempts']).toBe(1);

    const second = await runFsmScenario(project, [
      { type: 'tag', tagId: 'demo.attempts', value: 4 },
      { type: 'event', eventId: 'START' },
    ], { initialStateId: 'main-menu' });
    expect(second.tags['demo.attempts']).toBe(5);
  });

  it('applies a runtime.tag.copy effect, copying one tag\'s current value into another', async () => {
    const project = loadDemoProject();
    project.fsm.transitions['tr-main-measure'].backendProcessId = serializeEffectInvocations([
      createEffectInvocation(RUNTIME_TAG_COPY_EFFECT, { tagId: 'demo.saved_by', fromTagId: 'demo.current_user' })
    ]);
    const result = await runFsmScenario(project, [
      { type: 'tag', tagId: 'demo.current_user', value: 'Bob' },
      { type: 'event', eventId: 'START' },
    ], { initialStateId: 'main-menu' });
    expect(result.tags['demo.saved_by']).toBe('Bob');
  });

  it('starts at the FSM initial state when no initialStateId is given', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(project, []);
    expect(result.initialStateId).toBe(result.finalStateId);
    expect(result.steps).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { runFsmScenario } from '../../src/services/runtime/fsmScenarioRunner';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import type { ControlPanelButton } from '../../src/domain/project';

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

  it('starts at the FSM initial state when no initialStateId is given', async () => {
    const project = loadDemoProject();
    const result = await runFsmScenario(project, []);
    expect(result.initialStateId).toBe(result.finalStateId);
    expect(result.steps).toHaveLength(0);
  });
});

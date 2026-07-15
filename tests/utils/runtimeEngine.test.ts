import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';

describe('runtime engine', () => {
  it('performs a transition from a control-panel button', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    const button = runtime.getAvailableButtons().find((candidate) => candidate.fsmEventId === 'START');

    runtime.pressButton(button!.id);

    expect(runtime.currentStateId).toBe('measure');
    expect(runtime.lastTransition?.id).toBe('tr-main-measure');
    expect(runtime.getCurrentScreen()?.id).toBe('measure');
  });

  it('logs a missing transition without changing state', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');

    runtime.sendEvent('SAVE');

    expect(runtime.currentStateId).toBe('main-menu');
    expect(runtime.eventLog.at(-1)?.message).toContain('No transition');
  });

  it('queues events in step mode', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    runtime.setStepMode(true);

    runtime.sendEvent('START');
    expect(runtime.currentStateId).toBe('main-menu');
    expect(runtime.pendingEventIds).toEqual(['START']);

    runtime.step();
    expect(runtime.currentStateId).toBe('measure');
  });

  it('gives disabledStates priority over allowedStates', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = Object.values(project.controlPanel.elements)
      .find((element) => element.type === 'button' && element.fsmEventId === 'START');
    expect(button?.type).toBe('button');
    if (button?.type === 'button') {
      button.allowedStates = ['main-menu'];
      button.disabledStates = ['main-menu'];
    }
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');

    runtime.pressButton(button!.id);

    expect(runtime.currentStateId).toBe('main-menu');
    expect(runtime.eventLog.at(-1)?.message).toContain('disabled');
  });

  it('branches by transition conditions for the same event', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.transitions['tr-main-measure'].condition = 'button == OTHER';
    project.fsm.transitions['tr-main-settings'] = {
      ...project.fsm.transitions['tr-main-measure'],
      id: 'tr-main-settings',
      to: 'settings',
      condition: 'button == START'
    };
    project.fsm.transitionOrder.push('tr-main-settings');
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    const button = runtime.getAvailableButtons().find((candidate) => candidate.fsmEventId === 'START');

    runtime.pressButton(button!.id);

    expect(runtime.currentStateId).toBe('settings');
    expect(runtime.lastTransition?.id).toBe('tr-main-settings');
  });
});

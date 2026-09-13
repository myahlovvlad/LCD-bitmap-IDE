import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createRuntimeEngine, resolveRuntimeButtonAvailability } from '../../src/services/runtimeEngine';

describe('runtime button availability', () => {
  it('classifies missing event and missing transition separately', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('START button missing');

    button.fsmEventId = undefined;
    expect(resolveRuntimeButtonAvailability(project, 'main-menu', button).code).toBe('missing-event');
    button.fsmEventId = 'SAVE';
    expect(resolveRuntimeButtonAvailability(project, 'main-menu', button).code).toBe('missing-transition');
  });

  it('blocks a button when every transition guard rejects the press', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('START button missing');
    project.fsm.transitions['tr-main-measure'].condition = 'button == OTHER';

    expect(resolveRuntimeButtonAvailability(project, 'main-menu', button).code).toBe('guard-rejected');

    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    expect(runtime.isButtonAllowed(button)).toBe(false);
    expect(runtime.getButtonBlockReason(button)).toContain('guard');
  });

  it('keeps phone keypad input available in an input state without an explicit transition', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.states['main-menu'].input = { mode: 'numeric' };
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('START button missing');
    button.fsmEventId = 'UI.K1';

    expect(resolveRuntimeButtonAvailability(project, 'main-menu', button).code).toBe('available');
  });
});

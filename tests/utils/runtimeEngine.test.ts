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

describe('runtime hardware notifications (engine integration)', () => {
  function projectWithUsbMapping() {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.hardwareNotifications = {
      usb: { tagId: 'io.usb_present', presentScreenId: 'measure', absentScreenId: 'error' },
      printer: { tagId: 'io.printer_present', presentScreenId: 'save-result', absentScreenId: null }
    };
    return project;
  }

  it('opens a notification for the interrupted state without changing currentStateId', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = {};
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    expect(runtime.hardwareNotification).toBeNull();

    tagValues = { 'io.usb_present': true };
    runtime.refreshHardwareNotification();

    expect(runtime.hardwareNotification).toMatchObject({ equipment: 'usb', present: true, screenId: 'measure', returnStateId: 'main-menu' });
    expect(runtime.currentStateId).toBe('main-menu');
  });

  it('acknowledging clears the overlay and does not reopen while the tag is unchanged', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = { 'io.usb_present': true };
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    runtime.refreshHardwareNotification();
    expect(runtime.hardwareNotification).not.toBeNull();

    runtime.acknowledgeHardwareNotification();
    expect(runtime.hardwareNotification).toBeNull();

    runtime.refreshHardwareNotification();
    expect(runtime.hardwareNotification).toBeNull();
  });

  it('replaces an open notification with a new one without losing the original return state', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = { 'io.usb_present': true };
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    runtime.refreshHardwareNotification();
    expect(runtime.hardwareNotification?.equipment).toBe('usb');

    tagValues = { 'io.usb_present': false };
    runtime.refreshHardwareNotification();

    expect(runtime.hardwareNotification).toMatchObject({ equipment: 'usb', present: false, screenId: 'error', returnStateId: 'main-menu' });
  });

  it('reopens after acknowledgement once the underlying tag genuinely changes again', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = { 'io.usb_present': true };
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    runtime.refreshHardwareNotification();
    runtime.acknowledgeHardwareNotification();

    tagValues = { 'io.usb_present': false };
    runtime.refreshHardwareNotification();

    expect(runtime.hardwareNotification).toMatchObject({ equipment: 'usb', present: false });
  });

  it('clears the notification on start/reset', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = { 'io.usb_present': true };
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    runtime.refreshHardwareNotification();
    expect(runtime.hardwareNotification).not.toBeNull();

    runtime.reset();

    expect(runtime.hardwareNotification).toBeNull();
  });

  it('does not emit an FSM transition or touch the event-driven navigation state', () => {
    const project = projectWithUsbMapping();
    let tagValues: Record<string, boolean> = {};
    const runtime = createRuntimeEngine(project, { getGuardValues: () => tagValues });
    runtime.start('main-menu');
    const logLengthBefore = runtime.eventLog.length;

    tagValues = { 'io.usb_present': true };
    runtime.refreshHardwareNotification();

    expect(runtime.lastTransition).toBeNull();
    expect(runtime.currentStateId).toBe('main-menu');
    expect(runtime.eventLog.length).toBeGreaterThan(logLengthBefore);
  });
});

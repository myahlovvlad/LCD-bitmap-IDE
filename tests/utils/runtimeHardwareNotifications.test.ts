import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { MutableTagContext } from '../../src/services/runtime/TagContext';
import { hardwareNotificationKey, resolveHardwareNotification } from '../../src/services/runtimeHardwareNotifications';
import type { LcdBitmapProject } from '../../src/domain/project';

function projectWithHardwareMapping(): LcdBitmapProject {
  const project = migrateLegacySnapshot(createDemoProject()).project;
  project.hardwareNotifications = {
    usb: { tagId: 'io.usb_present', presentScreenId: 'measure', absentScreenId: 'error' },
    printer: { tagId: 'io.printer_present', presentScreenId: 'save-result', absentScreenId: null },
    pc: { tagId: 'io.pc_present', presentScreenId: 'main-menu', absentScreenId: 'error' }
  };
  return project;
}

/** A project with only one equipment kind mapped, so priority order cannot mask the result under test. */
function projectWithSingleMapping(equipment: 'usb' | 'printer' | 'pc'): LcdBitmapProject {
  const project = migrateLegacySnapshot(createDemoProject()).project;
  project.hardwareNotifications = { [equipment]: projectWithHardwareMapping().hardwareNotifications![equipment] };
  return project;
}

describe('resolveHardwareNotification', () => {
  it('maps all six presence/absence cases to their configured screens', () => {
    const cases: Array<{ tagId: string; value: boolean; equipment: 'usb' | 'printer' | 'pc'; screenId: string }> = [
      { tagId: 'io.usb_present', value: true, equipment: 'usb', screenId: 'measure' },
      { tagId: 'io.usb_present', value: false, equipment: 'usb', screenId: 'error' },
      { tagId: 'io.printer_present', value: true, equipment: 'printer', screenId: 'save-result' },
      { tagId: 'io.pc_present', value: true, equipment: 'pc', screenId: 'main-menu' },
      { tagId: 'io.pc_present', value: false, equipment: 'pc', screenId: 'error' }
    ];
    for (const testCase of cases) {
      const project = projectWithSingleMapping(testCase.equipment);
      const tags = new MutableTagContext({ [testCase.tagId]: testCase.value });
      const notification = resolveHardwareNotification(project, tags.snapshot(), 'measure');
      expect(notification).not.toBeNull();
      expect(notification?.equipment).toBe(testCase.equipment);
      expect(notification?.present).toBe(testCase.value);
      expect(notification?.screenId).toBe(testCase.screenId);
      expect(notification?.returnStateId).toBe('measure');
    }
  });

  it('returns null for the printer-absent case because no absent screen is configured', () => {
    const project = projectWithSingleMapping('printer');
    const tags = new MutableTagContext({ 'io.printer_present': false });
    expect(resolveHardwareNotification(project, tags.snapshot(), 'measure')).toBeNull();
  });

  it('returns null when no equipment tag is present/true and no mapping applies', () => {
    const project = projectWithHardwareMapping();
    const tags = new MutableTagContext({});
    // All three default to false; usb/pc have absent screens, so the first
    // one in priority order (usb) still resolves.
    const notification = resolveHardwareNotification(project, tags.snapshot(), 'measure');
    expect(notification?.equipment).toBe('usb');
  });

  it('returns null when the project has no hardware notification config', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const tags = new MutableTagContext({ 'io.usb_present': true });
    expect(resolveHardwareNotification(project, tags.snapshot(), 'measure')).toBeNull();
  });

  it('returns null for an unknown/unmapped tag id regardless of value', () => {
    const project = projectWithHardwareMapping();
    const tags = new MutableTagContext({ 'io.unknown_present': true });
    // None of the configured tags are set, so usb (default false) resolves via its absent screen.
    expect(resolveHardwareNotification(project, tags.snapshot(), 'measure')?.equipment).toBe('usb');
  });

  it('returns null with no active FSM state', () => {
    const project = projectWithHardwareMapping();
    const tags = new MutableTagContext({ 'io.usb_present': true });
    expect(resolveHardwareNotification(project, tags.snapshot(), null)).toBeNull();
  });

  it('ignores a mapping whose configured screen no longer exists in the project', () => {
    const project = projectWithHardwareMapping();
    project.hardwareNotifications!.usb!.presentScreenId = 'does-not-exist';
    const tags = new MutableTagContext({ 'io.usb_present': true });
    // usb no longer resolves, falls through to printer (present screen unset -> false path skipped), then pc (default false -> error).
    expect(resolveHardwareNotification(project, tags.snapshot(), 'measure')?.equipment).toBe('pc');
  });

  it('prioritizes usb over printer and pc when multiple signals are simultaneously active', () => {
    const project = projectWithHardwareMapping();
    const tags = new MutableTagContext({ 'io.usb_present': true, 'io.printer_present': true, 'io.pc_present': true });
    expect(resolveHardwareNotification(project, tags.snapshot(), 'measure')?.equipment).toBe('usb');
  });
});

describe('hardwareNotificationKey', () => {
  it('is null for a null notification and stable for identical notifications', () => {
    expect(hardwareNotificationKey(null)).toBeNull();
    const a = { equipment: 'usb' as const, present: true, screenId: 'measure', returnStateId: 'measure', openedAt: 1 };
    const b = { ...a, openedAt: 999 };
    expect(hardwareNotificationKey(a)).toBe(hardwareNotificationKey(b));
  });

  it('differs when equipment or presence differs', () => {
    const usbOn = { equipment: 'usb' as const, present: true, screenId: 'measure', returnStateId: 'measure', openedAt: 1 };
    const usbOff = { ...usbOn, present: false };
    const printerOn = { ...usbOn, equipment: 'printer' as const };
    expect(hardwareNotificationKey(usbOn)).not.toBe(hardwareNotificationKey(usbOff));
    expect(hardwareNotificationKey(usbOn)).not.toBe(hardwareNotificationKey(printerOn));
  });
});

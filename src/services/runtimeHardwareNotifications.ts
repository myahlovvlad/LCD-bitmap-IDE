import type { LcdBitmapProject } from '../domain/project';
import { HARDWARE_EQUIPMENT_KINDS, type HardwareEquipmentKind } from '../domain/hardwareNotification';
import type { TagValue } from './runtime/TagContext';

export type TagSnapshot = Readonly<Record<string, TagValue>>;

export interface HardwareNotification {
  equipment: HardwareEquipmentKind;
  present: boolean;
  screenId: string;
  returnStateId: string;
  openedAt: number;
}

/**
 * Pure, stateless mapping from the current tag snapshot to the hardware
 * notification that should be visible right now, if any. Equipment kinds are
 * checked in a fixed priority order (usb, printer, pc) so that two
 * simultaneously "active" signals resolve deterministically to one overlay.
 *
 * Never touches `currentStateId` — the caller is expected to pass the FSM
 * state the operator was on, which the overlay returns to after acknowledge.
 */
export function resolveHardwareNotification(
  project: LcdBitmapProject,
  tags: TagSnapshot,
  currentStateId: string | null
): HardwareNotification | null {
  if (!currentStateId) return null;
  const config = project.hardwareNotifications;
  if (!config) return null;

  for (const equipment of HARDWARE_EQUIPMENT_KINDS) {
    const mapping = config[equipment];
    if (!mapping) continue;
    const present = tags[mapping.tagId] === true;
    const screenId = present ? mapping.presentScreenId : mapping.absentScreenId;
    if (!screenId || !project.screens[screenId]) continue;
    return { equipment, present, screenId, returnStateId: currentStateId, openedAt: Date.now() };
  }
  return null;
}

/** Stable identity for a resolved notification, used to detect a genuine transition. */
export function hardwareNotificationKey(notification: HardwareNotification | null): string | null {
  return notification ? `${notification.equipment}:${notification.present}` : null;
}

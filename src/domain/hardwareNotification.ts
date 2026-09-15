export type HardwareEquipmentKind = 'usb' | 'printer' | 'pc';

export const HARDWARE_EQUIPMENT_KINDS: readonly HardwareEquipmentKind[] = ['usb', 'printer', 'pc'];

/** Default tag IDs monitored for each equipment kind; projects may override tagId per kind. */
export const DEFAULT_HARDWARE_TAG_IDS: Record<HardwareEquipmentKind, string> = {
  usb: 'io.usb_present',
  printer: 'io.printer_present',
  pc: 'io.pc_present'
};

/**
 * Maps one monitored boolean tag to the LCD screens shown while it is true
 * (present) and false (absent). Either side may be omitted when the device
 * has no dedicated screen for that transition.
 */
export interface HardwareNotificationMapping {
  tagId: string;
  presentScreenId?: string | null;
  absentScreenId?: string | null;
}

export type HardwareNotificationConfig = Partial<Record<HardwareEquipmentKind, HardwareNotificationMapping>>;

export function normalizeHardwareNotificationConfig(
  config: HardwareNotificationConfig | null | undefined,
  screens: Record<string, unknown>
): HardwareNotificationConfig {
  if (!config) return {};
  const normalized: HardwareNotificationConfig = {};
  for (const kind of HARDWARE_EQUIPMENT_KINDS) {
    const entry = config[kind];
    if (!entry || typeof entry.tagId !== 'string' || !entry.tagId.trim()) continue;
    const presentScreenId = entry.presentScreenId && screens[entry.presentScreenId] ? entry.presentScreenId : null;
    const absentScreenId = entry.absentScreenId && screens[entry.absentScreenId] ? entry.absentScreenId : null;
    normalized[kind] = { tagId: entry.tagId, presentScreenId, absentScreenId };
  }
  return normalized;
}

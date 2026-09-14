import type { CompilerTargetProfile } from './targetProfile';
import { DEFAULT_DISPLAY_CONFIG } from '../../domain/display';
import type { DisplayProfile } from '../../domain/displayProfile';
import { calculateEncodedByteLength } from '../encoding/displayEncoder';

export function createCompilerTargetProfile(display: DisplayProfile): CompilerTargetProfile {
  const byteLength = calculateEncodedByteLength(display);
  const isLegacy = display.fingerprint === DEFAULT_DISPLAY_CONFIG.fingerprint;
  return {
    id: isLegacy ? 'legacy-lcd-vertical-lsb' : `display-profile:${display.id}:${display.fingerprint}`,
    version: 1,
    display: { ...display, byteLength },
    codegen: {
      cArrayBytesPerRow: 16,
      allScreensTableByteLength: byteLength,
      includeHeaderGuardSuffix: 'LCD_SCREENS_H',
      structName: 'lcd_screen_entry_t'
    },
    symbolPrefix: 'lcd'
  };
}

export const LEGACY_MONOCHROME_128X64_TARGET_PROFILE: CompilerTargetProfile = createCompilerTargetProfile(DEFAULT_DISPLAY_CONFIG);

export const LEGACY_LCD_TARGET_PROFILE = LEGACY_MONOCHROME_128X64_TARGET_PROFILE;

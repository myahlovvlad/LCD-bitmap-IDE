import type { CompilerTargetProfile } from './targetProfile';

export const LEGACY_MONOCHROME_128X64_TARGET_PROFILE: CompilerTargetProfile = {
  id: 'legacy-lcd-vertical-lsb',
  version: 1,
  display: {
    colorMode: 'monochrome',
    packing: 'vertical-lsb',
    width: 128,
    height: 64,
    byteLength: 1024
  },
  codegen: {
    cArrayBytesPerRow: 16,
    allScreensTableByteLength: 1024,
    includeHeaderGuardSuffix: 'LCD_SCREENS_H',
    structName: 'lcd_screen_entry_t'
  },
  symbolPrefix: 'lcd'
};

export const LEGACY_LCD_TARGET_PROFILE = LEGACY_MONOCHROME_128X64_TARGET_PROFILE;

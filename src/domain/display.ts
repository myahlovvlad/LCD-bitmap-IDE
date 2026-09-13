import { SCREEN_H, SCREEN_W } from '../shared/constants/display';
import type { DisplayConfig } from './canvas';
import { createDisplayProfile, type DisplayProfile } from './displayProfile';
import type { LanguageCode, SupportedModelId } from './localization';

export const DISPLAY_CONSTRAINTS = {
  width: SCREEN_W,
  height: SCREEN_H,
  colorMode: 'monochrome',
  minX: 0,
  minY: 0,
  maxX: SCREEN_W - 1,
  maxY: SCREEN_H - 1,
  defaultTextX: 2,
  defaultTextY: 0,
  textLineHeight: 8
} as const;

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = createDisplayProfile({
  id: 'legacy-lcd-128x64-vertical-lsb',
  schemaVersion: 1,
  name: '128x64 LCD (legacy vertical LSB)',
  controller: 'generic-page-lcd',
  width: DISPLAY_CONSTRAINTS.width,
  height: DISPLAY_CONSTRAINTS.height,
  pixelFormat: 'mono1',
  bitsPerPixel: 1,
  packing: 'vertical-pages',
  bitOrder: 'lsb-first',
  byteOrder: 'little-endian',
  pageHeight: 8,
  alignment: 1,
  rotation: 0,
  mirrorX: false,
  mirrorY: false,
  inverted: false
});

export type NamedDisplayProfile = DisplayProfile & { label: string };

function named(label: string, overrides: Partial<DisplayProfile>): NamedDisplayProfile {
  return { ...createDisplayProfile({ ...DEFAULT_DISPLAY_CONFIG, ...overrides, schemaVersion: 1 }), label };
}

export const DISPLAY_PROFILES: readonly NamedDisplayProfile[] = [
  { ...DEFAULT_DISPLAY_CONFIG, label: '128x64 LCD · mono1 vertical LSB' },
  named('128x32 LCD · mono1 vertical LSB', { id: 'lcd-128x32', name: '128x32 LCD', width: 128, height: 32 }),
  named('96x64 OLED · mono1 vertical LSB', { id: 'oled-96x64', name: '96x64 OLED', width: 96, height: 64 }),
  named('72x40 OLED · mono1 vertical LSB', { id: 'oled-72x40', name: '72x40 OLED', width: 72, height: 40 }),
  named('128x64 · 2-bit grayscale', {
    id: 'gray2-128x64', name: '128x64 2-bit grayscale', controller: 'generic-gray',
    pixelFormat: 'gray2', bitsPerPixel: 2, packing: 'horizontal-row-major', pageHeight: undefined
  }),
  named('128x64 · 4-bit grayscale', {
    id: 'gray4-128x64', name: '128x64 4-bit grayscale', controller: 'generic-gray',
    pixelFormat: 'gray4', bitsPerPixel: 4, packing: 'horizontal-row-major', pageHeight: undefined
  }),
  named('160x128 · RGB565', {
    id: 'rgb565-160x128', name: '160x128 RGB565', controller: 'generic-tft', width: 160, height: 128,
    pixelFormat: 'rgb565', bitsPerPixel: 16, packing: 'interleaved', bitOrder: 'msb-first', pageHeight: undefined
  })
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['en', 'ru', 'zh'];

export const SUPPORTED_MODELS: readonly SupportedModelId[] = [
  'Universal-LCD-128x64'
];

export const CANVAS_OBJECT_DEFAULTS = {
  visible: true,
  locked: false,
  fontVariant: '1',
  foreground: true
} as const;

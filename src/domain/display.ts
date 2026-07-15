import { SCREEN_H, SCREEN_W } from '../shared/constants/display';
import type { DisplayConfig } from './canvas';
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

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  width: DISPLAY_CONSTRAINTS.width,
  height: DISPLAY_CONSTRAINTS.height,
  colorMode: 'monochrome',
  packing: 'vertical-lsb'
};

export const DISPLAY_PROFILES: readonly (DisplayConfig & { id: string; label: string })[] = [
  { id: 'lcd-128x64', label: '128x64 LCD', width: 128, height: 64, colorMode: 'monochrome', packing: 'vertical-lsb' },
  { id: 'lcd-128x32', label: '128x32 LCD', width: 128, height: 32, colorMode: 'monochrome', packing: 'vertical-lsb' },
  { id: 'oled-96x64', label: '96x64 OLED', width: 96, height: 64, colorMode: 'monochrome', packing: 'vertical-lsb' },
  { id: 'oled-72x40', label: '72x40 OLED', width: 72, height: 40, colorMode: 'monochrome', packing: 'vertical-lsb' },
  { id: 'lcd-160x128', label: '160x128 LCD', width: 160, height: 128, colorMode: 'monochrome', packing: 'vertical-lsb' }
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

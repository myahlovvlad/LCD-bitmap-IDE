import {
  CANVAS_OBJECT_DEFAULTS,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_LANGUAGE,
  DISPLAY_CONSTRAINTS,
  DISPLAY_PROFILES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_MODELS
} from '../../domain';

export {
  CANVAS_OBJECT_DEFAULTS,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_LANGUAGE,
  DISPLAY_CONSTRAINTS,
  DISPLAY_PROFILES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_MODELS
};

export const PRODUCT_IDENTITY = {
  id: 'lcd-bitmap-ide',
  name: 'LCD-bitmap IDE',
  documentationHeader: 'LCD, glyph and FSM interface workbench',
  description:
    'Universal offline workbench for monochrome LCD screen states, bitmap glyphs, FSM flows and firmware exports.'
} as const;

export function normalizeAppSoftwareVersion(value: unknown): string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.trim())
    ? value.trim()
    : 'dev';
}

export const APP_SOFTWARE_VERSION = normalizeAppSoftwareVersion(
  typeof __APP_SOFTWARE_VERSION__ === 'undefined' ? undefined : __APP_SOFTWARE_VERSION__
);

export const DOMAIN_GLOSSARY = {
  referenceSolution: {
    preferred: 'Reference Solution',
    ru: 'раствор сравнения',
    prohibited: ['Reference', 'Standard']
  },
  file: {
    preferred: 'File',
    ru: 'Файл',
    prohibited: ['Cuvette', 'Slot']
  },
  parameters: {
    preferred: 'Parameters',
    ru: 'Параметры',
    prohibited: ['Mode']
  }
} as const;

export const SOURCE_FILES = {
  fsmModel: 'examples/universal-lcd-demo.lcdproj',
  lcdEditor: 'src/features/lcd',
  cliAnalysis: 'docs/API_MCP_CONNECTORS.md',
  primaryLatencyLog: 'runtime simulation transport'
} as const;

export type { NamedDisplayProfile as DisplayProfile } from '../../domain/display';

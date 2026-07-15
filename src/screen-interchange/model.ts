import type {
  BitmapFont,
  CanvasObject,
  CanvasObjectType,
  DisplayConfig,
  FontVariant,
  Glyph,
  LcdBitmapProject,
  LocalizedText,
  ProjectGlyph,
  SpecialElementKind
} from '../domain';

export const SCREEN_INTERCHANGE_KIND = 'lcd-bitmap-screen-interchange' as const;
export const SCREEN_INTERCHANGE_VERSION = 1 as const;

export type ScreenInterchangeKind = typeof SCREEN_INTERCHANGE_KIND;
export type ScreenInterchangeVersion = typeof SCREEN_INTERCHANGE_VERSION;

export interface ScreenInterchangeProjectV1 {
  kind: ScreenInterchangeKind;
  version: ScreenInterchangeVersion;
  project: ScreenInterchangeProjectMetaV1;
  screens: readonly ScreenInterchangeScreenV1[];
  resources: ScreenInterchangeResourcesV1;
  traceability: ScreenInterchangeTraceabilityV1;
}

export interface ScreenInterchangeProjectMetaV1 {
  id: string;
  name: string;
  schemaVersion: LcdBitmapProject['meta']['schemaVersion'];
  display: DisplayConfig;
  screenOrder: readonly string[];
}

export interface ScreenInterchangeScreenV1 {
  id: string;
  name: string;
  description: string;
  tags: readonly string[];
  display: DisplayConfig;
  objectOrder: readonly string[];
  objects: readonly ScreenInterchangeObjectV1[];
  linkedStateIds: readonly string[];
  meta: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface ScreenInterchangeResourcesV1 {
  fonts: Record<string, ScreenInterchangeFontResourceV1>;
  glyphs: Record<string, ScreenInterchangeGlyphResourceV1>;
  bitmaps: Record<string, ScreenInterchangeBitmapResourceV1>;
}

export interface ScreenInterchangeFontResourceV1 extends BitmapFont {
  id: string;
}

export interface ScreenInterchangeGlyphResourceV1 extends ProjectGlyph {
  id: string;
}

export interface ScreenInterchangeBitmapResourceV1 {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: readonly number[];
  sourceObjectId: string;
}

export interface ScreenInterchangeTraceabilityV1 {
  projectId: string;
  screens: Record<string, ScreenInterchangeScreenTraceV1>;
  objects: Record<string, ScreenInterchangeObjectTraceV1>;
  resources: Record<string, ScreenInterchangeResourceTraceV1>;
}

export interface ScreenInterchangeScreenTraceV1 {
  sourceScreenId: string;
  linkedStateIds: readonly string[];
  selectedObjectIds: readonly string[];
}

export interface ScreenInterchangeObjectTraceV1 {
  sourceScreenId: string;
  sourceObjectId: string;
  objectType: CanvasObjectType;
  resourceRefs: readonly string[];
}

export interface ScreenInterchangeResourceTraceV1 {
  sourceScreenId?: string;
  sourceObjectId?: string;
  resourceType: 'font' | 'glyph' | 'bitmap';
}

export type ScreenInterchangeObjectSource = CanvasObject['source'];

interface ScreenInterchangeObjectBaseV1 {
  id: string;
  type: CanvasObjectType;
  order: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  source: ScreenInterchangeObjectSource;
  resourceRefs: readonly string[];
}

export interface ScreenInterchangeTextObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'text';
  text: LocalizedText;
  x: number;
  y: number;
  fontVariant: FontVariant;
  pendingTranslation: boolean;
}

export interface ScreenInterchangeLineObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'line';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ScreenInterchangeRectObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  filled: boolean;
}

export interface ScreenInterchangeIconObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'icon';
  iconId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenInterchangeBitmapObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'bitmap';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bitmapRef: string;
}

export interface ScreenInterchangeSpecialObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'special';
  kind: SpecialElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  checked: boolean;
  value: number;
  fontVariant?: FontVariant;
  glyphChar?: string;
  glyphOverrideRef?: string;
}

export interface ScreenInterchangeInvertObjectV1 extends ScreenInterchangeObjectBaseV1 {
  type: 'invert';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ScreenInterchangeObjectV1 =
  | ScreenInterchangeTextObjectV1
  | ScreenInterchangeLineObjectV1
  | ScreenInterchangeRectObjectV1
  | ScreenInterchangeIconObjectV1
  | ScreenInterchangeBitmapObjectV1
  | ScreenInterchangeSpecialObjectV1
  | ScreenInterchangeInvertObjectV1;

export interface ScreenInterchangeValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface ScreenInterchangeValidationResult {
  ok: boolean;
  issues: readonly ScreenInterchangeValidationIssue[];
}

export type ReconstructedScreenObject = CanvasObject;
export type GlyphOverrideResource = Glyph;

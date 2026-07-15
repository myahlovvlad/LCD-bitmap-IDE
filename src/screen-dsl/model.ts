import type {
  ScreenInterchangeBitmapObjectV1,
  ScreenInterchangeIconObjectV1,
  ScreenInterchangeInvertObjectV1,
  ScreenInterchangeLineObjectV1,
  ScreenInterchangeObjectV1,
  ScreenInterchangeProjectMetaV1,
  ScreenInterchangeRectObjectV1,
  ScreenInterchangeResourcesV1,
  ScreenInterchangeScreenV1,
  ScreenInterchangeSpecialObjectV1,
  ScreenInterchangeTextObjectV1
} from '../screen-interchange';

export const SCREEN_DSL_FORMAT = 'lcd-bitmap-ide/screen' as const;
export const SCREEN_DSL_VERSION = 1 as const;
export const SCREEN_DSL_LAYOUT_MODE = 'explicit' as const;

export type ScreenDslFormat = typeof SCREEN_DSL_FORMAT;
export type ScreenDslVersion = typeof SCREEN_DSL_VERSION;
export type ScreenDslLayoutMode = typeof SCREEN_DSL_LAYOUT_MODE;
export type ScreenDslSeverity = 'error' | 'warning';

export interface ScreenDslDocumentV1 {
  format: ScreenDslFormat;
  version: ScreenDslVersion;
  layoutMode: ScreenDslLayoutMode;
  project: ScreenInterchangeProjectMetaV1;
  screens: readonly ScreenDslScreenV1[];
  resources: ScreenInterchangeResourcesV1;
}

export type ScreenDslScreenV1 = Omit<ScreenInterchangeScreenV1, 'objects'> & {
  objects: readonly ScreenDslObjectV1[];
};

export type ScreenDslObjectV1 =
  | ScreenDslObjectFromInterchange<ScreenInterchangeTextObjectV1, 'text'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeLineObjectV1, 'line'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeRectObjectV1, 'rect'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeIconObjectV1, 'icon'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeBitmapObjectV1, 'bitmap'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeSpecialObjectV1, 'special'>
  | ScreenDslObjectFromInterchange<ScreenInterchangeInvertObjectV1, 'invert'>;

type ScreenDslObjectFromInterchange<T extends ScreenInterchangeObjectV1, Kind extends ScreenInterchangeObjectV1['type']> =
  Omit<T, 'type'> & { kind: Kind };

export interface ScreenDslDiagnostic {
  code: string;
  severity: ScreenDslSeverity;
  message: string;
  path: string;
  line?: number;
  column?: number;
}

export interface ScreenDslParseResult {
  ok: boolean;
  document: ScreenDslDocumentV1 | null;
  diagnostics: readonly ScreenDslDiagnostic[];
}

export interface ScreenDslValidationResult {
  ok: boolean;
  diagnostics: readonly ScreenDslDiagnostic[];
}

export type ScreenDslImportMode = 'create' | 'update' | 'clone';

export interface ScreenDslSemanticDiff {
  operations: readonly ScreenDslSemanticOperation[];
}

export interface ScreenDslSemanticOperation {
  type: 'screen.create' | 'screen.update' | 'screen.delete' | 'object.create' | 'object.update' | 'object.delete' | 'object.reorder';
  id: string;
  path: string;
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

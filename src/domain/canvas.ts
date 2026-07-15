import type { FontVariant } from './fonts';
import type { LocalizedText } from './localization';
import type { HmiBindings } from './tag';

export interface DisplayConfig {
  width: number;
  height: number;
  colorMode: 'monochrome';
  packing: 'vertical-lsb';
}

export type CanvasObjectType = 'text' | 'line' | 'rect' | 'icon' | 'bitmap' | 'special' | 'invert';

export type SpecialElementKind =
  | 'checkbox'
  | 'radio'
  | 'progress'
  | 'battery'
  | 'signal'
  | 'scrollbar';

interface CanvasObjectBase {
  id: string;
  type: CanvasObjectType;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  source: 'fsm-lcd-import' | 'user' | 'prototype' | 'generated';
  bindings?: HmiBindings;
}

export interface TextCanvasObject extends CanvasObjectBase {
  type: 'text';
  text: LocalizedText;
  x: number;
  y: number;
  fontVariant: FontVariant;
  pendingTranslation: boolean;
}

export interface LineCanvasObject extends CanvasObjectBase {
  type: 'line';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RectCanvasObject extends CanvasObjectBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  filled: boolean;
}

export interface IconCanvasObject extends CanvasObjectBase {
  type: 'icon';
  iconId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BitmapCanvasObject extends CanvasObjectBase {
  type: 'bitmap';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: number[];
}

export interface SpecialCanvasObject extends CanvasObjectBase {
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
  glyphOverride?: {
    width: number;
    data: string[];
    topOffset?: number;
    nominalHeight?: number;
  };
}

export interface InvertCanvasObject extends CanvasObjectBase {
  type: 'invert';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type { HmiBindings } from './tag';

export type CanvasObject =
  | TextCanvasObject
  | LineCanvasObject
  | RectCanvasObject
  | IconCanvasObject
  | BitmapCanvasObject
  | SpecialCanvasObject
  | InvertCanvasObject;

export interface CanvasData {
  stateId: string;
  width: number;
  height: number;
  objects: CanvasObject[];
  selectedObjectIds: string[];
  updatedAt: string;
}

export interface GraphPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

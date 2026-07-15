import type { FontVariant, Glyph, LocalizedText, SpecialElementKind } from '../../domain';

export type NormalizedCanvasObjectIr =
  | NormalizedTextObjectIr
  | NormalizedLineObjectIr
  | NormalizedRectObjectIr
  | NormalizedIconObjectIr
  | NormalizedBitmapObjectIr
  | NormalizedSpecialObjectIr
  | NormalizedInvertObjectIr;

export interface NormalizedCanvasObjectBaseIr {
  readonly id: string;
  readonly type: string;
  readonly order: number;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly source: string;
  readonly sourcePath: string;
}

export interface NormalizedTextObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'text';
  readonly text: LocalizedText;
  readonly x: number;
  readonly y: number;
  readonly fontVariant: FontVariant;
  readonly pendingTranslation: boolean;
}

export interface NormalizedLineObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'line';
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface NormalizedRectObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly filled: boolean;
}

export interface NormalizedIconObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'icon';
  readonly iconId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NormalizedBitmapObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'bitmap';
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly bytes: readonly number[];
}

export interface NormalizedSpecialObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'special';
  readonly kind: SpecialElementKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly checked: boolean;
  readonly value: number;
  readonly fontVariant?: FontVariant;
  readonly glyphChar?: string;
  readonly glyphOverride?: Glyph;
}

export interface NormalizedInvertObjectIr extends NormalizedCanvasObjectBaseIr {
  readonly type: 'invert';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NormalizedScreenIr {
  readonly id: string;
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly symbol: string;
  readonly objects: readonly NormalizedCanvasObjectIr[];
  readonly sourcePath: string;
}

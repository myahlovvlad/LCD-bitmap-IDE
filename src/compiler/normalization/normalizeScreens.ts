import type { CanvasObject } from '../../domain';
import type { NormalizedCanvasObjectIr, NormalizedScreenIr } from '../ir/screenIr';
import type { CompilerSymbolTable } from '../ir/symbolTable';
import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { symbolFor } from './normalizeSymbols';

export function normalizeScreens(source: CompilerSourceSnapshot, symbols: CompilerSymbolTable): readonly NormalizedScreenIr[] {
  return source.project.screenOrder
    .map((id) => source.project.screens[id])
    .filter((screen): screen is NonNullable<typeof screen> => Boolean(screen))
    .map((screen, order) => ({
      id: screen.id,
      order,
      name: screen.name,
      description: screen.description,
      tags: [...screen.tags],
      width: screen.width,
      height: screen.height,
      symbol: symbolFor(symbols, 'screen', screen.id),
      objects: screen.objects
        .map((object, objectOrder) => normalizeObject(screen.id, object, objectOrder))
        .sort((left, right) => left.zIndex - right.zIndex || left.order - right.order),
      sourcePath: `/screens/${screen.id}`
    }));
}

function normalizeObject(screenId: string, object: CanvasObject, order: number): NormalizedCanvasObjectIr {
  const base = {
    id: object.id,
    order,
    zIndex: object.zIndex,
    visible: object.visible,
    locked: object.locked,
    source: object.source,
    sourcePath: `/screens/${screenId}/objects/${object.id}`
  };
  if (object.type === 'text') {
    return { ...base, type: 'text', text: { ...object.text }, x: object.x, y: object.y, fontVariant: object.fontVariant, pendingTranslation: object.pendingTranslation };
  }
  if (object.type === 'line') {
    return { ...base, type: 'line', x0: object.x0, y0: object.y0, x1: object.x1, y1: object.y1 };
  }
  if (object.type === 'rect') {
    return { ...base, type: 'rect', x: object.x, y: object.y, width: object.width, height: object.height, filled: object.filled };
  }
  if (object.type === 'icon') {
    return { ...base, type: 'icon', iconId: object.iconId, x: object.x, y: object.y, width: object.width, height: object.height };
  }
  if (object.type === 'bitmap') {
    return { ...base, type: 'bitmap', name: object.name, x: object.x, y: object.y, width: object.width, height: object.height, byteLength: object.bytes.length, bytes: [...object.bytes] };
  }
  if (object.type === 'special') {
    return {
      ...base,
      type: 'special',
      kind: object.kind,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      checked: object.checked,
      value: object.value,
      fontVariant: object.fontVariant,
      glyphChar: object.glyphChar,
      glyphOverride: object.glyphOverride ? { ...object.glyphOverride, data: [...object.glyphOverride.data] } : undefined
    };
  }
  return { ...base, type: 'invert', x: object.x, y: object.y, width: object.width, height: object.height };
}

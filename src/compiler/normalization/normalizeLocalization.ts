import type { NormalizedLocalizationEntryIr, NormalizedLocalizationIr, NormalizedResourceIr } from '../ir/localizationIr';
import type { CompilerSymbolTable } from '../ir/symbolTable';
import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { symbolFor } from './normalizeSymbols';

export function normalizeLocalization(source: CompilerSourceSnapshot): NormalizedLocalizationIr {
  const entries: NormalizedLocalizationEntryIr[] = [];
  source.project.screenOrder.forEach((screenId) => {
    const screen = source.project.screens[screenId];
    screen?.objects.forEach((object) => {
      if (object.type === 'text') {
        entries.push({
          id: `${screenId}:${object.id}:text`,
          ownerType: 'canvas-object',
          ownerId: object.id,
          text: { ...object.text },
          sourcePath: `/screens/${screenId}/objects/${object.id}/text`
        });
      }
    });
  });
  source.project.controlPanel.elementOrder.forEach((elementId) => {
    const element = source.project.controlPanel.elements[elementId];
    if (element?.type === 'text') {
      entries.push({
        id: `${elementId}:text`,
        ownerType: 'control-panel-element',
        ownerId: elementId,
        text: { ...element.text },
        sourcePath: `/controlPanel/elements/${elementId}/text`
      });
    }
  });

  return {
    requestedLocales: source.requestedLocales ? [...source.requestedLocales] : ['en', 'ru', 'zh'],
    entries
  };
}

export function normalizeResources(source: CompilerSourceSnapshot, symbols: CompilerSymbolTable): NormalizedResourceIr {
  const fontGlyphs = Object.entries(source.fontGlyphs ?? {})
    .flatMap(([variant, glyphs]) => Object.keys(glyphs).sort().map((char) => {
      const glyph = glyphs[char];
      return {
        id: `${variant}:${char}`,
        variant,
        char,
        width: glyph.width,
        data: [...glyph.data],
        topOffset: glyph.topOffset,
        nominalHeight: glyph.nominalHeight,
        symbol: symbolFor(symbols, 'font-glyph', `${variant}:${char}`)
      };
    }));

  return {
    loadedFonts: [...(source.loadedFonts ?? [])],
    fontGlyphs,
    savedMeasurements: [...(source.savedMeasurements ?? [])],
    sourceFontGlyphs: source.fontGlyphs
  };
}

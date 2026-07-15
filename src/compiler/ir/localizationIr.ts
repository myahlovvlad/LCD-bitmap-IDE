import type { FontGlyphs, FontMetadata, LanguageCode, LocalizedText, SavedMeasurement } from '../../domain';

export interface NormalizedLocalizationEntryIr {
  readonly id: string;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly text: LocalizedText;
  readonly sourcePath: string;
}

export interface NormalizedLocalizationIr {
  readonly requestedLocales: readonly LanguageCode[];
  readonly entries: readonly NormalizedLocalizationEntryIr[];
}

export interface NormalizedFontGlyphIr {
  readonly id: string;
  readonly variant: string;
  readonly char: string;
  readonly width: number;
  readonly data: readonly string[];
  readonly topOffset?: number;
  readonly nominalHeight?: number;
  readonly symbol: string;
}

export interface NormalizedResourceIr {
  readonly loadedFonts: readonly FontMetadata[];
  readonly fontGlyphs: readonly NormalizedFontGlyphIr[];
  readonly savedMeasurements: readonly SavedMeasurement[];
  readonly sourceFontGlyphs?: Readonly<FontGlyphs>;
}

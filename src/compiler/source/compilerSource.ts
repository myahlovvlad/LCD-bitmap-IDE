import type { FontGlyphs, FontMetadata } from '../../domain/fonts';
import type { SavedMeasurement } from '../../domain/legacyProject';
import type { LanguageCode } from '../../domain/localization';
import type { LcdBitmapProject } from '../../domain/project';

export interface CompilerSourceSnapshot {
  readonly project: Readonly<LcdBitmapProject>;
  readonly fontGlyphs?: Readonly<FontGlyphs>;
  readonly loadedFonts?: readonly FontMetadata[];
  readonly savedMeasurements?: readonly SavedMeasurement[];
  readonly requestedLocales?: readonly LanguageCode[];
  readonly sourceFingerprint?: string;
}

export interface CompilerSourceInput {
  readonly project: LcdBitmapProject;
  readonly fontGlyphs?: FontGlyphs;
  readonly loadedFonts?: readonly FontMetadata[];
  readonly savedMeasurements?: readonly SavedMeasurement[];
  readonly requestedLocales?: readonly LanguageCode[];
}

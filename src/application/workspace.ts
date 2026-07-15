import { createMutableFontGlyphs, type FontGlyphs } from '../domain/fonts';
import type { FontMetadata, SavedMeasurement } from '../domain';
import type { LcdBitmapProject } from '../domain/project';

export interface ApplicationWorkspace {
  project: LcdBitmapProject;
  fontGlyphs: FontGlyphs;
  loadedFonts: FontMetadata[];
  savedMeasurements: SavedMeasurement[];
}

export interface ApplicationWorkspaceInput {
  project: LcdBitmapProject;
  fontGlyphs?: FontGlyphs;
  loadedFonts?: FontMetadata[];
  savedMeasurements?: SavedMeasurement[];
}

export function createApplicationWorkspace(input: ApplicationWorkspaceInput): ApplicationWorkspace {
  return {
    project: input.project,
    fontGlyphs: input.fontGlyphs ?? createMutableFontGlyphs(),
    loadedFonts: input.loadedFonts ?? createInitialFontMetadata(),
    savedMeasurements: input.savedMeasurements ?? []
  };
}

function createInitialFontMetadata(): FontMetadata[] {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return [
    { id: 'bundled-font-1', name: 'Bundled Font 1', sourceFormat: 'bundled', variant: '1', glyphCount: 0, createdAt: timestamp },
    { id: 'bundled-font-2', name: 'Bundled Font 2', sourceFormat: 'bundled', variant: '2', glyphCount: 0, createdAt: timestamp }
  ];
}

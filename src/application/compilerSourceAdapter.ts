import {
  createCompilerSourceSnapshot,
  type CompilerSourceSnapshot
} from '../compiler';
import type { LanguageCode } from '../domain';
import type { ApplicationWorkspace } from './workspace';

export interface ApplicationCompilerSourceOptions {
  readonly requestedLocales?: readonly LanguageCode[];
}

export function createCompilerSourceFromWorkspace(
  workspace: ApplicationWorkspace,
  options: ApplicationCompilerSourceOptions = {}
): CompilerSourceSnapshot {
  return createCompilerSourceSnapshot({
    project: workspace.project,
    fontGlyphs: workspace.fontGlyphs,
    loadedFonts: workspace.loadedFonts,
    savedMeasurements: workspace.savedMeasurements,
    requestedLocales: options.requestedLocales
  });
}

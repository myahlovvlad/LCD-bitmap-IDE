import {
  applyFsmScriptPreview,
  createFixedApplicationCommandContext,
  createProjectSession,
  exportFsmScript,
  previewFsmScriptImport,
  type FsmScriptFormat,
  type ProjectSession
} from '../../src/application';
import { createDemoProject } from '../../src/entities/project/demo';
import {
  canonicalSerializeFsmInterchange,
  projectToFsmInterchange
} from '../../src/fsm-interchange';
import type { LcdBitmapProject } from '../../src/domain/project';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

export const ROUND_TRIP_TIMESTAMP = '2026-06-24T03:30:00.000Z';

export function demoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

export function demoSession(revision = 0): ProjectSession {
  return createProjectSession(demoProject(), revision);
}

export function previewScript(
  session: ProjectSession,
  source: string,
  format: FsmScriptFormat
) {
  return previewFsmScriptImport(
    session,
    source,
    format,
    createFixedApplicationCommandContext(ROUND_TRIP_TIMESTAMP)
  );
}

export function applyPreview(session: ProjectSession, preview: ReturnType<typeof previewScript>) {
  return applyFsmScriptPreview(
    session,
    preview,
    createFixedApplicationCommandContext(ROUND_TRIP_TIMESTAMP)
  );
}

export function exportScript(session: ProjectSession, format: FsmScriptFormat): string {
  return exportFsmScript(session, format);
}

export function canonicalFsm(project: LcdBitmapProject): string {
  return canonicalSerializeFsmInterchange(projectToFsmInterchange(project));
}

export function cloneSessionWithProject(
  session: ProjectSession,
  project: LcdBitmapProject,
  revision = session.revision
): ProjectSession {
  return createProjectSession({
    project,
    fontGlyphs: session.workspace.fontGlyphs,
    loadedFonts: session.workspace.loadedFonts,
    savedMeasurements: session.workspace.savedMeasurements
  }, revision);
}

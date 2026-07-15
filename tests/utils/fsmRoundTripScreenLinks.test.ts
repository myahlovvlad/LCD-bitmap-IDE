import { describe, expect, it } from 'vitest';
import { createProjectFileV5, migrateProject } from '../../src/services/projectMigrationService';
import { PROJECT_SCHEMA_VERSION } from '../../src/domain/project';
import {
  applyPreview,
  canonicalFsm,
  demoSession,
  exportScript,
  previewScript
} from './fsmRoundTripTestHelpers';

describe('FSM round-trip persistence and screen-link integration', () => {
  it('preserves screen links across Apply and schema-v5 save/reopen', () => {
    const session = demoSession();
    const source = exportScript(session, 'python').replace('title="Measurement"', 'title="Measurement Saved"');
    const preview = previewScript(session, source, 'python');

    const applied = applyPreview(session, preview);
    expect(applied.status).toBe('applied');
    expect(applied.session.project.fsm.states.measure.screenId).toBe('measure');
    expect(applied.session.project.screens.measure).toBeDefined();
    expect(applied.session.project.fsm.states['main-menu'].screenId).toBe('main-menu');

    const payload = createProjectFileV5({
      project: applied.session.project,
      language: 'en',
      fontGlyphs: applied.session.workspace.fontGlyphs,
      loadedFonts: applied.session.workspace.loadedFonts,
      savedMeasurements: applied.session.workspace.savedMeasurements
    }, 'en');
    const reopened = migrateProject(JSON.parse(JSON.stringify(payload)));

    expect(reopened.project.meta.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(canonicalFsm(reopened.project)).toBe(canonicalFsm(applied.session.project));
    expect(reopened.project.fsm.states.measure.screenId).toBe('measure');
    expect(reopened.project.screens.measure).toBeDefined();
  });
});

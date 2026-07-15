import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl
} from '../../src/application';
import { SCREEN_DSL_TRANSACTION_LIMITS } from '../../src/application/screenDsl/transactionContract';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { ScreenDslDocumentV1 } from '../../src/screen-dsl';

const actor = { id: 'security-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

describe('Screen DSL transaction security', () => {
  it('transaction limits are defined and positive', () => {
    expect(SCREEN_DSL_TRANSACTION_LIMITS.maxOperations).toBeGreaterThan(0);
    expect(SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedScreens).toBeGreaterThan(0);
    expect(SCREEN_DSL_TRANSACTION_LIMITS.maxAffectedObjects).toBeGreaterThan(0);
    expect(SCREEN_DSL_TRANSACTION_LIMITS.maxCreatedResources).toBeGreaterThan(0);
  });

  it('consumed preview cannot be applied again', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const first = applyScreenDslPreview(session, { preview, sourceText: source });
    const second = applyScreenDslPreview(session, { preview: first.updatedPreview, sourceText: source });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.diagnostics.some((d) => d.code === 'SCREEN_DSL_APPLY_PREVIEW_CONSUMED')).toBe(true);
  });

  it('project mismatch is rejected without mutation', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const wrongPreview = { ...preview, projectId: 'other-project' };
    const result = applyScreenDslPreview(session, { preview: wrongPreview, sourceText: source });

    expect(result.applied).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'SCREEN_DSL_APPLY_PROJECT_MISMATCH')).toBe(true);
    expect(session.revision).toBe(0);
  });

  it('stale source text is rejected without mutation', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: 'tampered\n' });

    expect(result.applied).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'SCREEN_DSL_APPLY_STALE_SOURCE')).toBe(true);
    expect(session.revision).toBe(0);
  });

  it('stale revision is rejected without mutation', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    // Simulate session advanced to revision 1
    const advancedSession = { ...session, revision: 1 };
    const result = applyScreenDslPreview(advancedSession, { preview, sourceText: source });

    expect(result.applied).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'SCREEN_DSL_APPLY_STALE_REVISION')).toBe(true);
  });

  it('resource conflict is caught at preview stage, not apply stage', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
    doc.project = { ...doc.project, screenOrder: ['new-screen'] };
    doc.screens = [{ ...doc.screens[0], id: 'new-screen', name: 'New', linkedStateIds: [], objectOrder: ['obj-1'], objects: [{ ...doc.screens[0].objects[0], id: 'obj-1', order: 0 }] }];
    const firstFontKey = Object.keys(doc.resources.fonts)[0];
    if (firstFontKey) {
      doc.resources.fonts[firstFontKey] = { ...doc.resources.fonts[firstFontKey], name: 'DIFFERENT NAME' };
    }
    const source = JSON.stringify(doc) + '\n';
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });

    expect(preview.applyAllowed).toBe(false);
    expect(preview.diagnostics.some((d) => d.code === 'SCREEN_DSL_RESOURCE_ID_CONFLICT')).toBe(true);
    expect(session.revision).toBe(0);
  });

  it('transaction fingerprint does not expose absolute paths', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    const fingerprint = result.transaction?.fingerprint ?? '';
    expect(fingerprint).not.toContain(':\\');
    expect(fingerprint).not.toContain('/Users/');
    expect(fingerprint).not.toContain('/home/');
  });

  it('transaction fingerprint does not vary by apply time', () => {
    const session1 = demoSession();
    const session2 = demoSession();
    const sid = session1.project.screenOrder[0];
    const source = exportScreenDsl(session1, 'json', [sid]);
    const preview1 = createScreenDslPreview(session1, { projectId: session1.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const preview2 = createScreenDslPreview(session2, { projectId: session2.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const r1 = applyScreenDslPreview(session1, { preview: preview1, sourceText: source });
    const r2 = applyScreenDslPreview(session2, { preview: preview2, sourceText: source });

    expect(r1.transaction?.fingerprint).toBe(r2.transaction?.fingerprint);
  });

  it('failed Apply does not create history entry', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const historyBefore = session.history.entries.length;
    applyScreenDslPreview(session, { preview, sourceText: 'wrong-source\n' });

    expect(session.history.entries.length).toBe(historyBefore);
  });

  it('failed Apply leaves revision unchanged', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    applyScreenDslPreview(session, { preview, sourceText: 'wrong-source\n' });

    expect(session.revision).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl,
  undoProjectSession,
  redoProjectSession
} from '../../src/application';
import type { ScreenDslApplyTestHooks } from '../../src/application/screenDsl/testHooks';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

const actor = { id: 'clone-atomicity-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

describe('Screen DSL clone mode atomicity', () => {
  it('creates clone with deterministic screen ID distinct from original', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const cloneId = preview.identityPlan?.screens[sid];

    expect(result.applied).toBe(true);
    expect(cloneId).toBeDefined();
    expect(cloneId).not.toBe(sid);
    expect(result.result?.session.project.screens[cloneId!]).toBeDefined();
  });

  it('clone screen ID is deterministic across two identical Previews', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const first = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const second = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });

    expect(first.identityPlan?.screens[sid]).toBe(second.identityPlan?.screens[sid]);
  });

  it('original screen is unchanged after clone', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const originalScreen = session.project.screens[sid];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.project.screens[sid]).toEqual(originalScreen);
  });

  it('clone object IDs are deterministic and do not reuse original IDs', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const originalObjectIds = session.project.screens[sid]!.objects.map((o) => o.id);
    const cloneObjectIds = result.result?.session.project.screens[cloneId]?.objects.map((o) => o.id) ?? [];

    expect(cloneObjectIds.length).toBeGreaterThan(0);
    for (const cloneObjId of cloneObjectIds) {
      expect(originalObjectIds).not.toContain(cloneObjId);
    }
  });

  it('Undo removes only the clone, not the original', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const undone = result.result ? undoProjectSession(result.result.session) : null;

    expect(undone?.project.screens[sid]).toEqual(session.project.screens[sid]);
    expect(undone?.project.screens[cloneId]).toBeUndefined();
  });

  it('Redo restores clone with same IDs', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const cloneObjectIds = result.result?.session.project.screens[cloneId]?.objects.map((o) => o.id) ?? [];
    const undone = result.result ? undoProjectSession(result.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(redone?.project.screens[cloneId]).toBeDefined();
    expect(redone?.project.screens[cloneId]?.objects.map((o) => o.id)).toEqual(cloneObjectIds);
  });

  it('failure before first operation leaves no clone entities', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const hooks: ScreenDslApplyTestHooks = { beforeOperation: () => { throw new Error('injected'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens[cloneId]).toBeUndefined();
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('failure before commit leaves no clone and no history entry', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const hooks: ScreenDslApplyTestHooks = { beforeCommit: () => { throw new Error('injected'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens[cloneId]).toBeUndefined();
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('consumed clone Preview is rejected on second attempt', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const first = applyScreenDslPreview(session, { preview, sourceText: source });
    const second = applyScreenDslPreview(session, { preview: first.updatedPreview, sourceText: source });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.diagnostics.map((d) => d.code)).toContain('SCREEN_DSL_APPLY_PREVIEW_CONSUMED');
  });

  it('increments revision exactly once', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.result?.session.revision).toBe(session.revision + 1);
  });
});

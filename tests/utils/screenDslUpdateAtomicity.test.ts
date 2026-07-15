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
import type { ScreenDslDocumentV1 } from '../../src/screen-dsl';

const actor = { id: 'update-atomicity-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

function targetScreenId(session: ReturnType<typeof demoSession>): string {
  return session.project.screenOrder[0];
}

function renamedSource(session: ReturnType<typeof demoSession>, name: string): string {
  const sid = targetScreenId(session);
  const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
  doc.screens[0] = { ...doc.screens[0], name };
  return JSON.stringify(doc) + '\n';
}

function textUpdatedSource(session: ReturnType<typeof demoSession>, text: string): string {
  const sid = targetScreenId(session);
  const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
  const obj = doc.screens[0].objects[0];
  if (obj.kind === 'text') {
    doc.screens[0] = { ...doc.screens[0], objects: [{ ...obj, text: { ...obj.text, en: text } }, ...doc.screens[0].objects.slice(1)] };
  }
  return JSON.stringify(doc) + '\n';
}

function resizedSource(session: ReturnType<typeof demoSession>, width: number, height: number): string {
  const sid = targetScreenId(session);
  const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
  doc.screens[0] = { ...doc.screens[0], display: { ...doc.screens[0].display, width, height } };
  return JSON.stringify(doc) + '\n';
}

describe('Screen DSL update mode atomicity', () => {
  it('applies screen rename atomically', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'Updated Name');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.project.screens[sid]?.name).toBe('Updated Name');
  });

  it('Undo restores previous screen name', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const originalName = session.project.screens[sid]!.name;
    const source = renamedSource(session, 'Updated Name');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = result.result ? undoProjectSession(result.result.session) : null;

    expect(undone?.project.screens[sid]?.name).toBe(originalName);
  });

  it('Redo restores updated screen name', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'Updated Name');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = result.result ? undoProjectSession(result.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(redone?.project.screens[sid]?.name).toBe('Updated Name');
  });

  it('applies text object update atomically', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = textUpdatedSource(session, 'NEW TEXT');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    const obj = result.result?.session.project.screens[sid]?.objects[0];
    expect(obj?.type === 'text' && obj.text.en).toBe('NEW TEXT');
  });

  it('does not change screens outside the update target', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const otherIds = session.project.screenOrder.filter((id) => id !== sid);
    const source = renamedSource(session, 'Changed');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    for (const id of otherIds) {
      expect(result.result?.session.project.screens[id]).toEqual(session.project.screens[id]);
    }
  });

  it('creates exactly one history entry', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'One Entry');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.result?.session.history.entries).toHaveLength(session.history.entries.length + 1);
  });

  it('failure before first command leaves project unchanged', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'Will Not Apply');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const hooks: ScreenDslApplyTestHooks = { beforeOperation: () => { throw new Error('injected'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens[sid]?.name).not.toBe('Will Not Apply');
    expect(session.revision).toBe(0);
  });

  it('failure before commit leaves project unchanged', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const originalName = session.project.screens[sid]!.name;
    const source = renamedSource(session, 'Will Not Apply');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const hooks: ScreenDslApplyTestHooks = { beforeCommit: () => { throw new Error('injected'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens[sid]?.name).toBe(originalName);
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('applying consumed preview to the advanced session is rejected', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'Stale');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });

    // Apply to original session → success, returns new session at revision 1
    const first = applyScreenDslPreview(session, { preview, sourceText: source });
    const advancedSession = first.result!.session;

    // Try applying same preview (still lifecycle='current') to the new session at revision 1
    // Should fail: baseRevision=0 !== advancedSession.revision=1
    const second = applyScreenDslPreview(advancedSession, { preview, sourceText: source });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.diagnostics.map((d) => d.code)).toContain('SCREEN_DSL_APPLY_STALE_REVISION');
  });

  it('apply result has consumed lifecycle', () => {
    const session = demoSession();
    const sid = targetScreenId(session);
    const source = renamedSource(session, 'Consumed');
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'update', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.updatedPreview.lifecycle).toBe('consumed');
  });
});

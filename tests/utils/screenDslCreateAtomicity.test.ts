import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl,
  redoProjectSession,
  undoProjectSession
} from '../../src/application';
import type { ScreenDslApplyTestHooks } from '../../src/application/screenDsl/testHooks';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { ScreenDslDocumentV1 } from '../../src/screen-dsl';

const actor = { id: 'atomicity-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

function newScreenSource(sessionSnapshot = demoSession()): string {
  const document = JSON.parse(exportScreenDsl(sessionSnapshot, 'json', [sessionSnapshot.project.screenOrder[0]])) as ScreenDslDocumentV1;
  document.project = { ...document.project, screenOrder: ['atomicity-screen'] };
  document.screens = [{
    ...document.screens[0],
    id: 'atomicity-screen',
    name: 'Atomicity Test',
    linkedStateIds: [],
    objectOrder: ['atomicity-obj-1'],
    objects: [{ ...document.screens[0].objects[0], id: 'atomicity-obj-1', order: 0 }]
  }];
  return JSON.stringify(document) + '\n';
}

describe('Screen DSL create mode atomicity', () => {
  it('commits screen + objects as a single atomic unit', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.project.screens['atomicity-screen']).toBeDefined();
    expect(result.result?.session.project.screens['atomicity-screen']?.objects[0]?.id).toBe('atomicity-obj-1');
  });

  it('does not change existing screens on success', () => {
    const session = demoSession();
    const firstScreenId = session.project.screenOrder[0];
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.project.screens[firstScreenId]).toEqual(session.project.screens[firstScreenId]);
  });

  it('increments revision exactly once on success', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.revision).toBe(session.revision + 1);
  });

  it('creates exactly one history entry on success', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.history.entries).toHaveLength(session.history.entries.length + 1);
  });

  it('Undo removes the entire created aggregate', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = result.result ? undoProjectSession(result.result.session) : null;

    expect(undone).not.toBeNull();
    expect(undone!.project.screens['atomicity-screen']).toBeUndefined();
    expect(undone!.project.screenOrder).not.toContain('atomicity-screen');
  });

  it('Redo restores screen with the same IDs', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = result.result ? undoProjectSession(result.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(redone?.project.screens['atomicity-screen']).toBeDefined();
    expect(redone?.project.screens['atomicity-screen']?.objects[0]?.id).toBe('atomicity-obj-1');
  });

  it('failure before first operation leaves no screen created', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const hooks: ScreenDslApplyTestHooks = {
      beforeOperation: () => { throw new Error('injected failure before operation'); }
    };
    const result = applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(result.applied).toBe(false);
    expect(session.project.screens['atomicity-screen']).toBeUndefined();
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('failure after screen create (before commit) leaves no screen and no revision change', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const hooks: ScreenDslApplyTestHooks = {
      afterOperation: () => { throw new Error('injected failure after operation'); }
    };
    const result = applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(result.applied).toBe(false);
    expect(session.project.screens['atomicity-screen']).toBeUndefined();
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('failure before commit leaves no screen and no revision change', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const hooks: ScreenDslApplyTestHooks = {
      beforeCommit: () => { throw new Error('injected failure before commit'); }
    };
    const result = applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(result.applied).toBe(false);
    expect(session.project.screens['atomicity-screen']).toBeUndefined();
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
  });

  it('failed Apply leaves revision unchanged', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const hooks: ScreenDslApplyTestHooks = {
      beforeCommit: () => { throw new Error('abort'); }
    };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.revision).toBe(0);
  });

  it('failed Apply leaves history unchanged', () => {
    const session = demoSession();
    const historyBefore = session.history.entries.length;
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const hooks: ScreenDslApplyTestHooks = {
      beforeCommit: () => { throw new Error('abort'); }
    };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.history.entries).toHaveLength(historyBefore);
  });

  it('consumed Preview is rejected on second Apply attempt', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const firstResult = applyScreenDslPreview(session, { preview, sourceText: source });
    const consumed = firstResult.updatedPreview;
    const secondResult = applyScreenDslPreview(session, { preview: consumed, sourceText: source });

    expect(firstResult.applied).toBe(true);
    expect(consumed.lifecycle).toBe('consumed');
    expect(secondResult.applied).toBe(false);
    expect(secondResult.diagnostics.map((d) => d.code)).toContain('SCREEN_DSL_APPLY_PREVIEW_CONSUMED');
  });

  it('transaction fingerprint is deterministic for identical Previews', () => {
    const session = demoSession();
    const source = newScreenSource(session);
    const first = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const second = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const r1 = applyScreenDslPreview(session, { preview: first, sourceText: source });
    const session2 = demoSession();
    const r2 = applyScreenDslPreview(session2, { preview: second, sourceText: source });

    expect(r1.transaction?.fingerprint).toBe(r2.transaction?.fingerprint);
  });
});

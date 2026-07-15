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

const actor = { id: 'resource-atomicity-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

function newScreenWithBitmapSource(session: ReturnType<typeof demoSession>): string {
  const sid = session.project.screenOrder[0];
  const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
  doc.project = { ...doc.project, screenOrder: ['resource-test-screen'] };
  doc.screens = [{
    ...doc.screens[0],
    id: 'resource-test-screen',
    name: 'Resource Test',
    linkedStateIds: [],
    objectOrder: ['resource-obj-1'],
    objects: [{ ...doc.screens[0].objects[0], id: 'resource-obj-1', order: 0 }]
  }];
  return JSON.stringify(doc) + '\n';
}

describe('Screen DSL resource atomicity', () => {
  it('canvas objects are created atomically with their parent screen', () => {
    const session = demoSession();
    const source = newScreenWithBitmapSource(session);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    expect(result.result?.session.project.screens['resource-test-screen']?.objects).toHaveLength(1);
    expect(result.result?.session.project.screens['resource-test-screen']?.objects[0]?.id).toBe('resource-obj-1');
  });

  it('same-ID/different-content resource conflict is blocked before any mutation', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
    doc.project = { ...doc.project, screenOrder: ['conflict-screen'] };
    doc.screens = [{
      ...doc.screens[0],
      id: 'conflict-screen',
      name: 'Conflict',
      linkedStateIds: [],
      objectOrder: ['conflict-obj-1'],
      objects: [{ ...doc.screens[0].objects[0], id: 'conflict-obj-1', order: 0 }]
    }];
    // Introduce a conflicting resource with a font ID that already exists but different content
    const firstFontKey = Object.keys(doc.resources.fonts)[0];
    if (firstFontKey) {
      doc.resources.fonts[firstFontKey] = { ...doc.resources.fonts[firstFontKey], name: 'CONFLICTING FONT NAME' };
    }
    const source = JSON.stringify(doc) + '\n';
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });

    expect(preview.applyAllowed).toBe(false);
    expect(preview.diagnostics.map((d) => d.code)).toContain('SCREEN_DSL_RESOURCE_ID_CONFLICT');
    // Project must not be mutated
    expect(session.project.screens['conflict-screen']).toBeUndefined();
    expect(session.revision).toBe(0);
  });

  it('failure before commit leaves no partial screen or objects', () => {
    const session = demoSession();
    const source = newScreenWithBitmapSource(session);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const hooks: ScreenDslApplyTestHooks = { beforeCommit: () => { throw new Error('abort'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens['resource-test-screen']).toBeUndefined();
    expect(session.revision).toBe(0);
  });

  it('existing screens outside the created set are unchanged', () => {
    const session = demoSession();
    const existingIds = [...session.project.screenOrder];
    const source = newScreenWithBitmapSource(session);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });

    expect(result.applied).toBe(true);
    for (const id of existingIds) {
      expect(result.result?.session.project.screens[id]).toEqual(session.project.screens[id]);
    }
  });

  it('Undo removes the screen (and embedded objects), Redo restores them', () => {
    const session = demoSession();
    const source = newScreenWithBitmapSource(session);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = result.result ? undoProjectSession(result.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(undone?.project.screens['resource-test-screen']).toBeUndefined();
    expect(redone?.project.screens['resource-test-screen']).toBeDefined();
    expect(redone?.project.screens['resource-test-screen']?.objects[0]?.id).toBe('resource-obj-1');
  });

  it('clone does not reuse original screen object IDs as resource IDs', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const cloneId = preview.identityPlan?.screens[sid]!;
    const originalObjectIds = new Set(session.project.screens[sid]!.objects.map((o) => o.id));
    const cloneObjectIds = result.result?.session.project.screens[cloneId]?.objects.map((o) => o.id) ?? [];

    for (const id of cloneObjectIds) {
      expect(originalObjectIds.has(id)).toBe(false);
    }
  });

  it('failed clone leaves original screen objects unchanged', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    const originalObjects = [...session.project.screens[sid]!.objects];
    const source = exportScreenDsl(session, 'json', [sid]);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'clone', targetScreenIds: [sid], actor });
    const hooks: ScreenDslApplyTestHooks = { beforeCommit: () => { throw new Error('abort'); } };
    applyScreenDslPreview(session, { preview, sourceText: source }, hooks);

    expect(session.project.screens[sid]!.objects).toEqual(originalObjects);
  });

  it('screen ID collision in create mode is blocked before mutation', () => {
    const session = demoSession();
    const sid = session.project.screenOrder[0];
    // Use an existing screen ID as the create target — should fail at preview stage
    const doc = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
    // Keep the same screen ID → collision
    const source = JSON.stringify(doc) + '\n';
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });

    expect(preview.applyAllowed).toBe(false);
    expect(preview.diagnostics.map((d) => d.code)).toContain('SCREEN_DSL_SCREEN_ID_COLLISION');
    expect(session.revision).toBe(0);
  });
});

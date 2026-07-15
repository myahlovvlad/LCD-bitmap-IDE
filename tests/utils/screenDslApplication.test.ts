import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl,
  redoProjectSession,
  undoProjectSession
} from '../../src/application';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { ScreenDslDocumentV1 } from '../../src/screen-dsl';

const actor = { id: 'screen-dsl-test', type: 'system' as const };

describe('Screen DSL application Preview and Apply', () => {
  it('creates a read-only update preview with a dry-run ChangeSet', () => {
    const session = demoSession();
    const source = updateMainTitleSource(session, 'DIAGNOSTICS');
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: session.revision,
      format: 'json',
      sourceText: source,
      importMode: 'update',
      targetScreenIds: ['main-menu'],
      actor
    });

    expect(preview.success).toBe(true);
    expect(preview.applyAllowed).toBe(true);
    expect(preview.dryRun?.status).toBe('dry-run');
    expect(preview.changeSet?.commands.map((command) => command.type)).toEqual(['canvas.objects.update']);
    expect(session.project.screens['main-menu'].objects[0].type).toBe('text');
    expect(session.project.screens['main-menu'].objects[0]).toEqual(expect.objectContaining({
      text: expect.objectContaining({ en: 'UNIVERSAL LCD' })
    }));
  });

  it('applies update preview atomically and preserves Undo/Redo patches', () => {
    const session = demoSession();
    const source = updateMainTitleSource(session, 'DIAGNOSTICS');
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'update',
      targetScreenIds: ['main-menu'],
      actor
    });
    const applied = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = applied.result ? undoProjectSession(applied.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(applied.applied).toBe(true);
    expect(applied.result?.session.revision).toBe(1);
    expect(applied.result?.session.history.entries).toHaveLength(1);
    expect(titleText(applied.result!.session.project.screens['main-menu'].objects[0])).toBe('DIAGNOSTICS');
    expect(titleText(undone!.project.screens['main-menu'].objects[0])).toBe('UNIVERSAL LCD');
    expect(titleText(redone!.project.screens['main-menu'].objects[0])).toBe('DIAGNOSTICS');
  });

  it('requires confirmation for destructive object deletes', () => {
    const session = demoSession();
    const source = removeMainMenuObjectSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'update',
      targetScreenIds: ['main-menu'],
      actor
    });
    const rejected = applyScreenDslPreview(session, { preview, sourceText: source });
    const applied = applyScreenDslPreview(session, { preview, sourceText: source, confirmDestructive: true });

    expect(preview.destructive).toBe(true);
    expect(rejected.applied).toBe(false);
    expect(rejected.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_APPLY_DESTRUCTIVE_CONFIRMATION_REQUIRED');
    expect(applied.applied).toBe(true);
    expect(applied.result?.session.project.screens['main-menu'].objects).toHaveLength(2);
  });

  it('rejects stale source text at Apply time', () => {
    const session = demoSession();
    const source = updateMainTitleSource(session, 'DIAGNOSTICS');
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'update',
      targetScreenIds: ['main-menu'],
      actor
    });

    const result = applyScreenDslPreview(session, { preview, sourceText: updateMainTitleSource(session, 'OTHER') });

    expect(result.applied).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_APPLY_STALE_SOURCE');
  });

  it('applies create mode with exact stable IDs without changing existing screens', () => {
    const session = demoSession();
    const source = createNewScreenSource(session);
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const applied = applyScreenDslPreview(session, { preview, sourceText: source });
    const undone = applied.result ? undoProjectSession(applied.result.session) : null;
    const redone = undone ? redoProjectSession(undone) : null;

    expect(preview.success).toBe(true);
    expect(preview.semanticDiff?.operations.map((operation) => operation.type)).toContain('screen.create');
    expect(applied.applied).toBe(true);
    expect(applied.result?.session.project.screens['diagnostics-screen']?.objects[0]?.id).toBe('diagnostics-title');
    expect(applied.result?.session.project.screens['main-menu']).toEqual(session.project.screens['main-menu']);
    expect(undone?.project.screens['diagnostics-screen']).toBeUndefined();
    expect(redone?.project.screens['diagnostics-screen']?.objects[0]?.id).toBe('diagnostics-title');
  });

  it('applies clone mode with deterministic new screen and object IDs', () => {
    const session = demoSession();
    const source = exportScreenDsl(session, 'json', ['main-menu']);
    const first = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'clone',
      targetScreenIds: ['main-menu'],
      actor
    });
    const second = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'clone',
      targetScreenIds: ['main-menu'],
      actor
    });
    const applied = applyScreenDslPreview(session, { preview: first, sourceText: source });
    const cloneId = first.identityPlan?.screens['main-menu'];
    const originalObjectIds = session.project.screens['main-menu'].objects.map((object) => object.id);
    const cloneObjectIds = cloneId ? applied.result?.session.project.screens[cloneId]?.objects.map((object) => object.id) : [];

    expect(first.identityPlan).toEqual(second.identityPlan);
    expect(first.applyAllowed).toBe(true);
    expect(applied.applied).toBe(true);
    expect(cloneId).not.toBe('main-menu');
    expect(applied.result?.session.project.screens['main-menu']).toEqual(session.project.screens['main-menu']);
    expect(cloneObjectIds).toEqual(['main-menu-copy-text-1', 'main-menu-copy-text-2', 'main-menu-copy-text-3']);
    expect(cloneObjectIds).not.toEqual(originalObjectIds);
  });

  it('blocks create mode screen ID collisions without mutating the project', () => {
    const session = demoSession();
    const source = updateMainTitleSource(session, 'DIAGNOSTICS');
    const first = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });
    const second = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });

    expect(first.identityPlan).toEqual(second.identityPlan);
    expect(first.applyAllowed).toBe(false);
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_SCREEN_ID_COLLISION');
    expect(session.project.screens['main-menu'].objects).toHaveLength(3);
  });

  it('blocks same-ID resource conflicts during create mode', () => {
    const session = demoSession();
    const source = createNewScreenSource(session, (document) => {
      document.resources.fonts['font:1'] = {
        ...document.resources.fonts['font:1'],
        name: 'Conflicting Font'
      };
    });
    const preview = createScreenDslPreview(session, {
      projectId: session.project.meta.id,
      expectedRevision: 0,
      format: 'json',
      sourceText: source,
      importMode: 'create',
      actor
    });

    expect(preview.applyAllowed).toBe(false);
    expect(preview.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_RESOURCE_ID_CONFLICT');
  });
});

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

function updateMainTitleSource(session: ReturnType<typeof demoSession>, text: string): string {
  const document = JSON.parse(exportScreenDsl(session, 'json', ['main-menu'])) as ScreenDslDocumentV1;
  const object = document.screens[0].objects[0];
  if (object.kind === 'text') {
    object.text = { ...object.text, en: text };
  }
  return `${JSON.stringify(document)}\n`;
}

function removeMainMenuObjectSource(session: ReturnType<typeof demoSession>): string {
  const document = JSON.parse(exportScreenDsl(session, 'json', ['main-menu'])) as ScreenDslDocumentV1;
  document.screens = [{
    ...document.screens[0],
    objectOrder: document.screens[0].objectOrder.slice(0, 2),
    objects: document.screens[0].objects.slice(0, 2).map((object, index) => ({ ...object, order: index }))
  }];
  return `${JSON.stringify(document)}\n`;
}

function createNewScreenSource(
  session: ReturnType<typeof demoSession>,
  mutate?: (document: ScreenDslDocumentV1) => void
): string {
  const document = JSON.parse(exportScreenDsl(session, 'json', ['main-menu'])) as ScreenDslDocumentV1;
  document.project = {
    ...document.project,
    screenOrder: ['diagnostics-screen']
  };
  document.screens = [{
    ...document.screens[0],
    id: 'diagnostics-screen',
    name: 'Diagnostics',
    linkedStateIds: [],
    objectOrder: ['diagnostics-title'],
    objects: [{
      ...document.screens[0].objects[0],
      id: 'diagnostics-title',
      order: 0
    }]
  }];
  mutate?.(document);
  return `${JSON.stringify(document)}\n`;
}

function titleText(object: ReturnType<typeof demoSession>['project']['screens'][string]['objects'][number]): string {
  return object.type === 'text' ? object.text.en : '';
}

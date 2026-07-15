import { describe, expect, it } from 'vitest';
import {
  applyScreenDslPreview,
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl,
  undoProjectSession,
  redoProjectSession
} from '../../src/application';
import {
  buildScreenDslApplyOperations,
  buildScreenDslApplyTransaction,
  computeScreenDslTransactionFingerprint
} from '../../src/application/screenDsl/transactionContract';
import { fingerprintScreenDslSource } from '../../src/application/screenDsl/hash';
import { createScreenDslDocumentKey, serializeScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import {
  createScreenDslDocumentSession,
  reduceScreenDslDocumentSession
} from '../../src/application/screenDslSession/reducer';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { ScreenDslDocumentV1 } from '../../src/screen-dsl';

const actor = { id: 'performance-test', type: 'system' as const };

function demoSession() {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, 0);
}

function makeMultiObjectSource(session: ReturnType<typeof demoSession>, objectCount: number): string {
  const sid = session.project.screenOrder[0];
  const base = JSON.parse(exportScreenDsl(session, 'json', [sid])) as ScreenDslDocumentV1;
  const firstObj = base.screens[0].objects[0];
  const objects = Array.from({ length: objectCount }, (_, i) => ({
    ...firstObj,
    id: `perf-obj-${i + 1}`,
    order: i
  }));
  base.project = { ...base.project, screenOrder: ['perf-screen'] };
  base.screens = [{
    ...base.screens[0],
    id: 'perf-screen',
    name: 'Performance',
    linkedStateIds: [],
    objectOrder: objects.map((o) => o.id),
    objects
  }];
  return JSON.stringify(base) + '\n';
}

describe('Screen DSL transaction performance', () => {
  it('transaction preparation for 100 objects completes within 1 second', () => {
    const session = demoSession();
    const source = makeMultiObjectSource(session, 100);
    const start = performance.now();
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    const elapsed = performance.now() - start;

    console.log(JSON.stringify({ objectCount: 100, preparationMs: elapsed.toFixed(1), applied: result.applied, operationCount: result.transaction?.operations.length ?? 0 }));
    expect(elapsed).toBeLessThan(1000);
    expect(result.applied).toBe(true);
  });

  it('session key creation is fast (10,000 iterations)', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const key = createScreenDslDocumentKey(`proj-${i % 10}`, 'json', 'create', [`screen-${i}`]);
      serializeScreenDslDocumentKey(key);
    }
    const elapsed = performance.now() - start;

    console.log(JSON.stringify({ keyCreations: 10000, ms: elapsed.toFixed(1) }));
    expect(elapsed).toBeLessThan(500);
  });

  it('transaction fingerprint computation is stable and fast', () => {
    const session = demoSession();
    const source = makeMultiObjectSource(session, 20);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    if (!preview.changeSet) {
      return;
    }
    const operations = buildScreenDslApplyOperations(preview);
    const start = performance.now();
    const f1 = computeScreenDslTransactionFingerprint(
      preview.projectId, preview.importMode, preview.baseRevision,
      preview.baseScreenFingerprint, preview.sourceFingerprint,
      preview.identityPlan?.fingerprint ?? '', operations, preview.destructive
    );
    const f2 = computeScreenDslTransactionFingerprint(
      preview.projectId, preview.importMode, preview.baseRevision,
      preview.baseScreenFingerprint, preview.sourceFingerprint,
      preview.identityPlan?.fingerprint ?? '', operations, preview.destructive
    );
    const elapsed = performance.now() - start;

    console.log(JSON.stringify({ fingerprintMs: elapsed.toFixed(1), operationCount: operations.length }));
    expect(f1).toBe(f2);
    expect(elapsed).toBeLessThan(100);
  });

  it('Undo/Redo after create are fast', () => {
    const session = demoSession();
    const source = makeMultiObjectSource(session, 50);
    const preview = createScreenDslPreview(session, { projectId: session.project.meta.id, expectedRevision: 0, format: 'json', sourceText: source, importMode: 'create', actor });
    const result = applyScreenDslPreview(session, { preview, sourceText: source });
    if (!result.result) return;

    const start = performance.now();
    const undone = undoProjectSession(result.result.session);
    const redone = undone ? redoProjectSession(undone) : null;
    const elapsed = performance.now() - start;

    console.log(JSON.stringify({ undoRedoMs: elapsed.toFixed(1), objectCount: 50 }));
    expect(elapsed).toBeLessThan(500);
    expect(undone?.project.screens['perf-screen']).toBeUndefined();
    expect(redone?.project.screens['perf-screen']).toBeDefined();
  });

  it('multiple rapid source updates in session (request-sequence protection) are handled correctly', () => {
    const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
    let state = createScreenDslDocumentSession(key);
    const canonical = '{ "screens": [] }\n';
    const fp = fingerprintScreenDslSource(canonical);
    state = reduceScreenDslDocumentSession(state, {
      type: 'SOURCE_INITIALIZED', sourceText: canonical, canonicalFingerprint: fp, baseRevision: 0, baseScreenFingerprint: 'fp-0'
    });

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const text = `{ "screens": [${i}] }\n`;
      state = reduceScreenDslDocumentSession(state, {
        type: 'SOURCE_CHANGED', sourceText: text, sourceFingerprint: fingerprintScreenDslSource(text)
      });
    }
    const elapsed = performance.now() - start;

    console.log(JSON.stringify({ rapidSourceUpdates: iterations, ms: elapsed.toFixed(1) }));
    expect(elapsed).toBeLessThan(500);
    expect(state.dirty).toBe(true);
  });
});

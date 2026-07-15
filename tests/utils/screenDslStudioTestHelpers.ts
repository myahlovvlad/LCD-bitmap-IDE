/**
 * Shared test factories for Screen Schema Studio tests.
 * Pure helpers — no React, no Zustand, no DOM.
 */
import {
  createProjectSession,
  createScreenDslPreview,
  exportScreenDsl,
  type ProjectSession,
  type ScreenDslPreviewResult
} from '../../src/application';
import type { ScreenDslTextFormat } from '../../src/application/screenDsl/contracts';
import type { ScreenDslPreviewLifecycle } from '../../src/application/screenDsl/transactionContract';
import type {
  ScreenDslDocumentSession,
  ScreenDslSessionEventPayload
} from '../../src/application/screenDslSession/contracts';
import { createScreenDslDocumentKey, type ScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import {
  createScreenDslDocumentSession,
  reduceScreenDslDocumentSession
} from '../../src/application/screenDslSession/reducer';
import { fingerprintScreenDslSource } from '../../src/application/screenDsl/hash';
import type { ScreenDslImportMode, ScreenDslSemanticOperation } from '../../src/screen-dsl';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

export const ACTOR = { id: 'studio-test', type: 'system' as const };
export const TEST_PROJECT_ID = 'test-proj-001';
export const TEST_SCREEN_ID = 'main-menu';

// — Project / Session factories —

export function demoSession(revision = 0): ProjectSession {
  return createProjectSession(migrateLegacySnapshot(createDemoProject()).project, revision);
}

export function testKey(
  format: ScreenDslTextFormat = 'json',
  importMode: ScreenDslImportMode = 'create',
  targetScreenIds: readonly string[] = []
): ScreenDslDocumentKey {
  return createScreenDslDocumentKey(TEST_PROJECT_ID, format, importMode, targetScreenIds);
}

// — ScreenDslDocumentSession factories —

export function emptyDocSession(key?: ScreenDslDocumentKey): ScreenDslDocumentSession {
  return createScreenDslDocumentSession(key ?? testKey());
}

function applyEvent(
  session: ScreenDslDocumentSession,
  event: ScreenDslSessionEventPayload
): ScreenDslDocumentSession {
  return reduceScreenDslDocumentSession(session, event);
}

export function initializedDocSession(
  sourceText = '{ "screens": [] }\n',
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const k = key ?? testKey();
  const fp = fingerprintScreenDslSource(sourceText);
  return applyEvent(createScreenDslDocumentSession(k), {
    type: 'SOURCE_INITIALIZED',
    sourceText,
    canonicalFingerprint: fp,
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base-0'
  });
}

export function dirtyDocSession(
  canonicalSource = '{ "screens": [] }\n',
  draft = '{ "screens": [] }\n// edited',
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const init = initializedDocSession(canonicalSource, key);
  return applyEvent(init, {
    type: 'SOURCE_CHANGED',
    sourceText: draft,
    sourceFingerprint: fingerprintScreenDslSource(draft)
  });
}

export function validatingDocSession(key?: ScreenDslDocumentKey): ScreenDslDocumentSession {
  const init = initializedDocSession('{ "screens": [] }\n', key);
  return applyEvent(init, {
    type: 'PREVIEW_STARTED',
    requestSequence: 1,
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base-0'
  });
}

export function invalidDocSession(key?: ScreenDslDocumentKey): ScreenDslDocumentSession {
  const started = validatingDocSession(key);
  return applyEvent(started, {
    type: 'PREVIEW_FAILED',
    diagnostics: [{ code: 'SCREEN_DSL_PARSE_ERROR', severity: 'error', message: 'Syntax error', path: '/screens', line: 1, column: 1 }],
    requestSequence: 1
  });
}

export function previewReadyDocSession(
  preview: ScreenDslPreviewResult,
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const init = initializedDocSession(preview.sourceFingerprint, key);
  const started = applyEvent(init, {
    type: 'PREVIEW_STARTED',
    requestSequence: 1,
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base-0'
  });
  return applyEvent(started, { type: 'PREVIEW_SUCCEEDED', preview, requestSequence: 1 });
}

export function staleDocSession(
  preview: ScreenDslPreviewResult,
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const ready = previewReadyDocSession(preview, key);
  return applyEvent(ready, {
    type: 'PROJECT_CHANGED',
    baseRevision: 1,
    baseScreenFingerprint: 'fp-base-1',
    canonicalFingerprint: null,
    staleReason: 'project-revision-changed'
  });
}

export function applyingDocSession(
  preview: ScreenDslPreviewResult,
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const ready = previewReadyDocSession(preview, key);
  return applyEvent(ready, { type: 'APPLY_STARTED' });
}

export function appliedDocSession(key?: ScreenDslDocumentKey): ScreenDslDocumentSession {
  const k = key ?? testKey();
  const source = '{ "screens": [] }\n';
  const fp = fingerprintScreenDslSource(source);
  const started = applyEvent(createScreenDslDocumentSession(k), {
    type: 'SOURCE_INITIALIZED',
    sourceText: source,
    canonicalFingerprint: fp,
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base-0'
  });
  const s2 = applyEvent(started, { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-base-0' });
  const s3 = applyEvent(s2, {
    type: 'PREVIEW_SUCCEEDED',
    preview: makePreview({ applyAllowed: true }),
    requestSequence: 1
  });
  const s4 = applyEvent(s3, { type: 'APPLY_STARTED' });
  return applyEvent(s4, {
    type: 'APPLY_SUCCEEDED',
    canonicalFingerprint: fp,
    baseRevision: 1,
    baseScreenFingerprint: 'fp-base-1'
  });
}

export function failedDocSession(
  preview: ScreenDslPreviewResult,
  key?: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  const applying = applyingDocSession(preview, key);
  return applyEvent(applying, {
    type: 'APPLY_FAILED',
    diagnostics: [{ code: 'SCREEN_DSL_APPLY_REVISION_CONFLICT', severity: 'error', message: 'Revision conflict', path: '/' }]
  });
}

// — ScreenDslPreviewResult factories —

export function makePreview(overrides: Partial<ScreenDslPreviewResult> = {}): ScreenDslPreviewResult {
  return {
    success: true,
    projectId: TEST_PROJECT_ID,
    importMode: 'create',
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base-0',
    sourceFingerprint: 'fp-source-0',
    parsedDocument: null,
    interchangeCandidate: null,
    identityPlan: null,
    semanticDiff: null,
    changeSet: null,
    dryRun: null,
    rasterPreview: null,
    diagnostics: [],
    destructive: false,
    applyAllowed: true,
    lifecycle: 'current',
    ...overrides
  };
}

export function makeValidPreview(revision = 0): ScreenDslPreviewResult {
  return makePreview({
    baseRevision: revision,
    applyAllowed: true,
    destructive: false,
    semanticDiff: { operations: [{ type: 'screen.create', id: 'new-screen', path: '/screens/0' }] },
    lifecycle: 'current'
  });
}

export function makeDestructivePreview(revision = 0): ScreenDslPreviewResult {
  return makePreview({
    baseRevision: revision,
    applyAllowed: true,
    destructive: true,
    semanticDiff: {
      operations: [
        { type: 'screen.delete', id: 'old-screen', path: '/screens/0' },
        { type: 'object.delete', id: 'old-obj', path: '/screens/0/objects/0' }
      ]
    },
    lifecycle: 'current'
  });
}

export function makeNoOpPreview(revision = 0): ScreenDslPreviewResult {
  return makePreview({
    baseRevision: revision,
    applyAllowed: true,
    destructive: false,
    semanticDiff: { operations: [] },
    lifecycle: 'current'
  });
}

export function makeInvalidPreview(): ScreenDslPreviewResult {
  return makePreview({
    success: false,
    applyAllowed: false,
    diagnostics: [
      { code: 'SCREEN_DSL_PARSE_ERROR', severity: 'error', message: 'Unexpected token', path: '/', line: 3, column: 5 }
    ]
  });
}

export function makeBlockingDiagnosticPreview(): ScreenDslPreviewResult {
  return makePreview({
    applyAllowed: false,
    diagnostics: [
      { code: 'SCREEN_DSL_SCHEMA_INVALID', severity: 'error', message: 'Required field missing', path: '/screens/0' },
      { code: 'SCREEN_DSL_PIXEL_BUDGET_EXCEEDED', severity: 'warning', message: 'Pixel budget exceeded', path: '/screens/0' }
    ]
  });
}

export function makeConsumedPreview(revision = 0): ScreenDslPreviewResult {
  return makePreview({ baseRevision: revision, lifecycle: 'consumed' });
}

export function makeStaleLifecyclePreview(revision = 0): ScreenDslPreviewResult {
  return makePreview({ baseRevision: revision, lifecycle: 'stale' });
}

export function makeRasterPreview(
  beforeByteLength: number,
  afterByteLength: number,
  changedScreens: string[]
): ScreenDslPreviewResult {
  return makePreview({
    rasterPreview: { beforeByteLength, afterByteLength, changedScreens },
    semanticDiff: { operations: changedScreens.map((id) => ({ type: 'screen.update', id, path: `/screens/${id}` })) }
  });
}

export function makeResourceConflictPreview(): ScreenDslPreviewResult {
  return makePreview({
    applyAllowed: false,
    diagnostics: [
      { code: 'SCREEN_DSL_RESOURCE_ID_CONFLICT', severity: 'error', message: 'Resource ID conflict: font:1', path: '/resources/fonts/font:1' }
    ]
  });
}

// — Semantic operation factories —

export function makeSemanticOp(
  type: ScreenDslSemanticOperation['type'],
  id = 'test-id',
  path = '/screens/0'
): ScreenDslSemanticOperation {
  return { type, id, path };
}

// — Real preview via application facade —

export function realPreviewForUpdate(
  session: ProjectSession,
  screenId: string,
  sourceText?: string
): ScreenDslPreviewResult {
  const text = sourceText ?? exportScreenDsl(session, 'json', [screenId]);
  return createScreenDslPreview(session, {
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    format: 'json',
    sourceText: text,
    importMode: 'update',
    targetScreenIds: [screenId],
    actor: ACTOR
  });
}

export function realPreviewForCreate(
  session: ProjectSession,
  sourceText: string
): ScreenDslPreviewResult {
  return createScreenDslPreview(session, {
    projectId: session.project.meta.id,
    expectedRevision: session.revision,
    format: 'json',
    sourceText,
    importMode: 'create',
    actor: ACTOR
  });
}

// — Deterministic project session helper —

export function sessionWithRevision(revision: number): ProjectSession {
  const base = demoSession(0);
  // Adjust revision by simulating multiple history entries
  // We use the base session directly with adjusted revision field
  return { ...base, revision } as ProjectSession;
}

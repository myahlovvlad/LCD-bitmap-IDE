import { describe, expect, it } from 'vitest';
import { fingerprintScreenDslSource } from '../../src/application/screenDsl/hash';
import type { ScreenDslSessionEventPayload } from '../../src/application/screenDslSession/contracts';
import { createScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import {
  createScreenDslDocumentSession,
  reduceScreenDslDocumentSession
} from '../../src/application/screenDslSession/reducer';

const key = createScreenDslDocumentKey('proj-1', 'json', 'create', []);
const canonicalSource = '{ "screens": [] }\n';
const canonicalFingerprint = fingerprintScreenDslSource(canonicalSource);

function initialized(): ReturnType<typeof createScreenDslDocumentSession> {
  return reduceScreenDslDocumentSession(createScreenDslDocumentSession(key), {
    type: 'SOURCE_INITIALIZED',
    sourceText: canonicalSource,
    canonicalFingerprint,
    baseRevision: 0,
    baseScreenFingerprint: 'fp-base'
  });
}

describe('Screen DSL session reducer', () => {
  it('creates initial empty session', () => {
    const session = createScreenDslDocumentSession(key);

    expect(session.status).toBe('empty');
    expect(session.dirty).toBe(false);
    expect(session.disposed).toBe(false);
    expect(session.preview).toBeNull();
    expect(session.diagnostics).toHaveLength(0);
  });

  it('SOURCE_INITIALIZED produces clean session', () => {
    const session = initialized();

    expect(session.status).toBe('clean');
    expect(session.dirty).toBe(false);
    expect(session.sourceText).toBe(canonicalSource);
    expect(session.canonicalBaselineFingerprint).toBe(canonicalFingerprint);
    expect(session.baseRevision).toBe(0);
  });

  it('SOURCE_CHANGED with different text makes dirty', () => {
    const session = reduceScreenDslDocumentSession(initialized(), {
      type: 'SOURCE_CHANGED',
      sourceText: 'edited\n',
      sourceFingerprint: fingerprintScreenDslSource('edited\n')
    });

    expect(session.dirty).toBe(true);
    expect(session.status).toBe('dirty');
    expect(session.sourceText).toBe('edited\n');
  });

  it('SOURCE_CHANGED with canonical text makes clean', () => {
    const dirty = reduceScreenDslDocumentSession(initialized(), {
      type: 'SOURCE_CHANGED',
      sourceText: 'edited\n',
      sourceFingerprint: fingerprintScreenDslSource('edited\n')
    });
    const restored = reduceScreenDslDocumentSession(dirty, {
      type: 'SOURCE_CHANGED',
      sourceText: canonicalSource,
      sourceFingerprint: canonicalFingerprint
    });

    expect(restored.dirty).toBe(false);
    expect(restored.status).toBe('clean');
  });

  it('VALIDATION_STARTED advances requestSequence', () => {
    const session = reduceScreenDslDocumentSession(initialized(), {
      type: 'VALIDATION_STARTED',
      requestSequence: 1
    });

    expect(session.status).toBe('validating');
    expect(session.requestSequence).toBe(1);
    expect(session.activeRequestSequence).toBe(1);
  });

  it('VALIDATION_FAILED sets invalid status', () => {
    const validating = reduceScreenDslDocumentSession(initialized(), { type: 'VALIDATION_STARTED', requestSequence: 1 });
    const failed = reduceScreenDslDocumentSession(validating, {
      type: 'VALIDATION_FAILED',
      diagnostics: [{ code: 'E001', severity: 'error', message: 'Bad syntax', path: '$' }],
      requestSequence: 1
    });

    expect(failed.status).toBe('invalid');
    expect(failed.diagnostics).toHaveLength(1);
    expect(failed.activeRequestSequence).toBeNull();
  });

  it('VALIDATION_FAILED with stale sequence is ignored', () => {
    const validating = reduceScreenDslDocumentSession(initialized(), { type: 'VALIDATION_STARTED', requestSequence: 1 });
    const result = reduceScreenDslDocumentSession(validating, {
      type: 'VALIDATION_FAILED',
      diagnostics: [{ code: 'E001', severity: 'error', message: 'Bad', path: '$' }],
      requestSequence: 99
    });

    expect(result.status).toBe('validating');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('PREVIEW_STARTED advances sequence and clears preview', () => {
    const session = reduceScreenDslDocumentSession(initialized(), {
      type: 'PREVIEW_STARTED',
      requestSequence: 1,
      baseRevision: 0,
      baseScreenFingerprint: 'fp-base'
    });

    expect(session.status).toBe('validating');
    expect(session.preview).toBeNull();
    expect(session.requestSequence).toBe(1);
    expect(session.activeRequestSequence).toBe(1);
  });

  it('PREVIEW_SUCCEEDED sets preview-ready status and keeps dirty unchanged', () => {
    const dirty = reduceScreenDslDocumentSession(initialized(), {
      type: 'SOURCE_CHANGED',
      sourceText: 'edited\n',
      sourceFingerprint: fingerprintScreenDslSource('edited\n')
    });
    const previewing = reduceScreenDslDocumentSession(dirty, {
      type: 'PREVIEW_STARTED',
      requestSequence: 1,
      baseRevision: 0,
      baseScreenFingerprint: 'fp-base'
    });
    const fakePreview = { applyAllowed: true, diagnostics: [], lifecycle: 'current' as const } as unknown as import('../../src/application/screenDsl/contracts').ScreenDslPreviewResult;
    const ready = reduceScreenDslDocumentSession(previewing, {
      type: 'PREVIEW_SUCCEEDED',
      preview: fakePreview,
      requestSequence: 1
    });

    expect(ready.status).toBe('preview-ready');
    expect(ready.preview).toBe(fakePreview);
    expect(ready.dirty).toBe(true);
  });

  it('PREVIEW_SUCCEEDED with stale sequence is ignored', () => {
    const previewing = reduceScreenDslDocumentSession(initialized(), {
      type: 'PREVIEW_STARTED',
      requestSequence: 1,
      baseRevision: 0,
      baseScreenFingerprint: 'fp-base'
    });
    const fakePreview = { applyAllowed: true, diagnostics: [], lifecycle: 'current' as const } as unknown as import('../../src/application/screenDsl/contracts').ScreenDslPreviewResult;
    const result = reduceScreenDslDocumentSession(previewing, {
      type: 'PREVIEW_SUCCEEDED',
      preview: fakePreview,
      requestSequence: 99
    });

    expect(result.preview).toBeNull();
    expect(result.status).toBe('validating');
  });

  it('PROJECT_CHANGED marks preview-ready session stale', () => {
    const fakePreview = { applyAllowed: true, diagnostics: [], lifecycle: 'current' as const } as unknown as import('../../src/application/screenDsl/contracts').ScreenDslPreviewResult;
    const previewing = reduceScreenDslDocumentSession(initialized(), { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-base' });
    const ready = reduceScreenDslDocumentSession(previewing, { type: 'PREVIEW_SUCCEEDED', preview: fakePreview, requestSequence: 1 });
    const stale = reduceScreenDslDocumentSession(ready, {
      type: 'PROJECT_CHANGED',
      baseRevision: 1,
      baseScreenFingerprint: 'fp-new',
      canonicalFingerprint: canonicalFingerprint,
      staleReason: 'project-revision-changed'
    });

    expect(stale.status).toBe('stale');
    expect(stale.staleReason).toBe('project-revision-changed');
    expect(stale.preview).toBeNull();
  });

  it('APPLY_SUCCEEDED sets consumed lifecycle and applied status', () => {
    const previewing = reduceScreenDslDocumentSession(initialized(), { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-base' });
    const fakePreview = { applyAllowed: true, diagnostics: [], lifecycle: 'current' as const } as unknown as import('../../src/application/screenDsl/contracts').ScreenDslPreviewResult;
    const ready = reduceScreenDslDocumentSession(previewing, { type: 'PREVIEW_SUCCEEDED', preview: fakePreview, requestSequence: 1 });
    const applying = reduceScreenDslDocumentSession(ready, { type: 'APPLY_STARTED' });
    const applied = reduceScreenDslDocumentSession(applying, {
      type: 'APPLY_SUCCEEDED',
      canonicalFingerprint: canonicalFingerprint,
      baseRevision: 1,
      baseScreenFingerprint: 'fp-new'
    });

    expect(applied.status).toBe('applied');
    expect(applied.previewLifecycle).toBe('consumed');
    expect(applied.dirty).toBe(false);
  });

  it('APPLY_FAILED preserves source and sets failed lifecycle', () => {
    const previewing = reduceScreenDslDocumentSession(initialized(), { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-base' });
    const fakePreview = { applyAllowed: true, diagnostics: [], lifecycle: 'current' as const } as unknown as import('../../src/application/screenDsl/contracts').ScreenDslPreviewResult;
    const ready = reduceScreenDslDocumentSession(previewing, { type: 'PREVIEW_SUCCEEDED', preview: fakePreview, requestSequence: 1 });
    const applying = reduceScreenDslDocumentSession(ready, { type: 'APPLY_STARTED' });
    const failed = reduceScreenDslDocumentSession(applying, {
      type: 'APPLY_FAILED',
      diagnostics: [{ code: 'E_APPLY', severity: 'error', message: 'Failed', path: '$' }]
    });

    expect(failed.status).toBe('failed');
    expect(failed.previewLifecycle).toBe('failed');
    expect(failed.diagnostics).toHaveLength(1);
  });

  it('DISCARD_DRAFT restores canonical source and clean status', () => {
    const dirty = reduceScreenDslDocumentSession(initialized(), {
      type: 'SOURCE_CHANGED',
      sourceText: 'dirty\n',
      sourceFingerprint: fingerprintScreenDslSource('dirty\n')
    });
    const clean = reduceScreenDslDocumentSession(dirty, {
      type: 'DISCARD_DRAFT',
      canonicalSourceText: canonicalSource,
      canonicalFingerprint
    });

    expect(clean.dirty).toBe(false);
    expect(clean.status).toBe('clean');
    expect(clean.sourceText).toBe(canonicalSource);
  });

  it('SESSION_DISPOSED sets disposed flag', () => {
    const disposed = reduceScreenDslDocumentSession(initialized(), { type: 'SESSION_DISPOSED' });

    expect(disposed.disposed).toBe(true);
    expect(disposed.activeRequestSequence).toBeNull();
  });

  it('REFRESH_FROM_PROJECT with dirty session marks stale, preserves source', () => {
    const dirty = reduceScreenDslDocumentSession(initialized(), {
      type: 'SOURCE_CHANGED',
      sourceText: 'dirty\n',
      sourceFingerprint: fingerprintScreenDslSource('dirty\n')
    });
    const refreshed = reduceScreenDslDocumentSession(dirty, {
      type: 'REFRESH_FROM_PROJECT',
      canonicalSourceText: canonicalSource,
      canonicalFingerprint,
      baseRevision: 1,
      baseScreenFingerprint: 'fp-new'
    });

    expect(refreshed.status).toBe('stale');
    expect(refreshed.dirty).toBe(true);
    expect(refreshed.sourceText).toBe('dirty\n');
  });

  it('REFRESH_FROM_PROJECT with clean session updates source', () => {
    const refreshed = reduceScreenDslDocumentSession(initialized(), {
      type: 'REFRESH_FROM_PROJECT',
      canonicalSourceText: '{ "screens": ["new"] }\n',
      canonicalFingerprint: fingerprintScreenDslSource('{ "screens": ["new"] }\n'),
      baseRevision: 1,
      baseScreenFingerprint: 'fp-new'
    });

    expect(refreshed.status).toBe('clean');
    expect(refreshed.dirty).toBe(false);
    expect(refreshed.sourceText).toBe('{ "screens": ["new"] }\n');
  });
});

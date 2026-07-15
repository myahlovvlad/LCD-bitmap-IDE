import { describe, expect, it } from 'vitest';
import { fingerprintScreenDslSource } from '../../src/application/screenDsl/hash';
import type { ScreenDslSessionEventPayload } from '../../src/application/screenDslSession/contracts';
import { createScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import {
  createScreenDslDocumentSession,
  reduceScreenDslDocumentSession
} from '../../src/application/screenDslSession/reducer';
import type { ScreenDslPreviewResult } from '../../src/application/screenDsl/contracts';

const key = createScreenDslDocumentKey('proj-1', 'json', 'update', ['screen-a']);
const canonical = '{ "screens": [] }\n';
const canonicalFP = fingerprintScreenDslSource(canonical);

function fakePreview(): ScreenDslPreviewResult {
  return {
    applyAllowed: true,
    diagnostics: [],
    lifecycle: 'current'
  } as unknown as ScreenDslPreviewResult;
}

function previewReadySession() {
  const s0 = createScreenDslDocumentSession(key);
  const s1 = reduceScreenDslDocumentSession(s0, { type: 'SOURCE_INITIALIZED', sourceText: canonical, canonicalFingerprint: canonicalFP, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
  const s2 = reduceScreenDslDocumentSession(s1, { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
  return reduceScreenDslDocumentSession(s2, { type: 'PREVIEW_SUCCEEDED', preview: fakePreview(), requestSequence: 1 });
}

describe('Screen DSL session staleness', () => {
  it('project revision change marks preview-ready stale', () => {
    const ready = previewReadySession();
    const stale = reduceScreenDslDocumentSession(ready, {
      type: 'PROJECT_CHANGED',
      baseRevision: 1,
      baseScreenFingerprint: 'fp-1',
      canonicalFingerprint: canonicalFP,
      staleReason: 'project-revision-changed'
    });

    expect(stale.status).toBe('stale');
    expect(stale.staleReason).toBe('project-revision-changed');
    expect(stale.preview).toBeNull();
  });

  it('screen fingerprint change marks stale', () => {
    const ready = previewReadySession();
    const stale = reduceScreenDslDocumentSession(ready, {
      type: 'PROJECT_CHANGED',
      baseRevision: 0,
      baseScreenFingerprint: 'fp-changed',
      canonicalFingerprint: canonicalFP,
      staleReason: 'screen-fingerprint-changed'
    });

    expect(stale.status).toBe('stale');
    expect(stale.staleReason).toBe('screen-fingerprint-changed');
  });

  it('source change clears preview and resets to dirty', () => {
    const ready = previewReadySession();
    const dirty = reduceScreenDslDocumentSession(ready, {
      type: 'SOURCE_CHANGED',
      sourceText: 'edited\n',
      sourceFingerprint: fingerprintScreenDslSource('edited\n')
    });

    expect(dirty.preview).toBeNull();
    expect(dirty.dirty).toBe(true);
    expect(dirty.status).toBe('dirty');
  });

  it('TARGET_SELECTION_CHANGED marks stale reason', () => {
    const ready = previewReadySession();
    const stale = reduceScreenDslDocumentSession(ready, { type: 'TARGET_SELECTION_CHANGED' });

    expect(stale.staleReason).toBe('target-selection-changed');
    expect(stale.preview).toBeNull();
  });

  it('older PREVIEW_SUCCEEDED result with stale requestSequence is discarded', () => {
    const s0 = createScreenDslDocumentSession(key);
    const s1 = reduceScreenDslDocumentSession(s0, { type: 'SOURCE_INITIALIZED', sourceText: canonical, canonicalFingerprint: canonicalFP, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
    // Start two preview requests
    const s2 = reduceScreenDslDocumentSession(s1, { type: 'PREVIEW_STARTED', requestSequence: 1, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
    const s3 = reduceScreenDslDocumentSession(s2, { type: 'PREVIEW_STARTED', requestSequence: 2, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
    // Old result arrives for sequence 1 (should be discarded)
    const s4 = reduceScreenDslDocumentSession(s3, { type: 'PREVIEW_SUCCEEDED', preview: fakePreview(), requestSequence: 1 });
    // New result arrives for sequence 2
    const preview2 = { ...fakePreview(), sourceFingerprint: 'different' };
    const s5 = reduceScreenDslDocumentSession(s4, { type: 'PREVIEW_SUCCEEDED', preview: preview2 as unknown as ScreenDslPreviewResult, requestSequence: 2 });

    expect(s4.preview).toBeNull();
    expect(s4.status).toBe('validating');
    expect(s5.status).toBe('preview-ready');
    expect(s5.preview).toBe(preview2);
  });

  it('clean session with project change updates revision without going stale', () => {
    const s0 = createScreenDslDocumentSession(key);
    const s1 = reduceScreenDslDocumentSession(s0, { type: 'SOURCE_INITIALIZED', sourceText: canonical, canonicalFingerprint: canonicalFP, baseRevision: 0, baseScreenFingerprint: 'fp-0' });
    const s2 = reduceScreenDslDocumentSession(s1, {
      type: 'PROJECT_CHANGED',
      baseRevision: 1,
      baseScreenFingerprint: 'fp-1',
      canonicalFingerprint: canonicalFP,
      staleReason: 'project-revision-changed'
    });

    // Clean session status (not preview-ready/dirty) — PROJECT_CHANGED should not set 'stale'
    expect(s2.baseRevision).toBe(1);
    expect(s2.status).toBe('clean');
  });
});

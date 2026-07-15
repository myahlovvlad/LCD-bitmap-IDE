import { fingerprintScreenDslSource } from '../screenDsl/hash';
import type { ScreenDslDocumentSession, ScreenDslSessionEventPayload, ScreenDslStaleReason } from './contracts';
import type { ScreenDslDocumentKey } from './identity';

export function createScreenDslDocumentSession(
  key: ScreenDslDocumentKey
): ScreenDslDocumentSession {
  return {
    key,
    sourceText: '',
    sourceFingerprint: fingerprintScreenDslSource(''),
    canonicalBaselineFingerprint: null,
    dirty: false,
    status: 'empty',
    baseRevision: null,
    baseScreenFingerprint: null,
    preview: null,
    previewLifecycle: null,
    diagnostics: [],
    requestSequence: 0,
    activeRequestSequence: null,
    staleReason: null,
    disposed: false
  };
}

export function reduceScreenDslDocumentSession(
  session: ScreenDslDocumentSession,
  event: ScreenDslSessionEventPayload
): ScreenDslDocumentSession {
  switch (event.type) {
    case 'SOURCE_INITIALIZED':
      return {
        ...session,
        sourceText: event.sourceText,
        sourceFingerprint: fingerprintScreenDslSource(event.sourceText),
        canonicalBaselineFingerprint: event.canonicalFingerprint,
        dirty: false,
        status: 'clean',
        baseRevision: event.baseRevision,
        baseScreenFingerprint: event.baseScreenFingerprint,
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        requestSequence: 0,
        activeRequestSequence: null,
        staleReason: null,
        disposed: false
      };

    case 'SOURCE_CHANGED': {
      const dirty = event.sourceFingerprint !== session.canonicalBaselineFingerprint;
      return {
        ...session,
        sourceText: event.sourceText,
        sourceFingerprint: event.sourceFingerprint,
        dirty,
        status: dirty ? 'dirty' : 'clean',
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: null
      };
    }

    case 'VALIDATION_STARTED':
      return {
        ...session,
        status: 'validating',
        requestSequence: event.requestSequence,
        activeRequestSequence: event.requestSequence,
        diagnostics: [],
        staleReason: null
      };

    case 'VALIDATION_FAILED':
      if (session.activeRequestSequence !== event.requestSequence) {
        return session;
      }
      return {
        ...session,
        status: 'invalid',
        diagnostics: event.diagnostics,
        activeRequestSequence: null
      };

    case 'PREVIEW_STARTED':
      return {
        ...session,
        status: 'validating',
        requestSequence: event.requestSequence,
        activeRequestSequence: event.requestSequence,
        baseRevision: event.baseRevision,
        baseScreenFingerprint: event.baseScreenFingerprint,
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        staleReason: null
      };

    case 'PREVIEW_SUCCEEDED':
      if (session.activeRequestSequence !== event.requestSequence) {
        return session;
      }
      return {
        ...session,
        status: event.preview.applyAllowed ? 'preview-ready' : 'invalid',
        preview: event.preview,
        previewLifecycle: event.preview.lifecycle,
        diagnostics: event.preview.diagnostics,
        activeRequestSequence: null,
        staleReason: null
      };

    case 'PREVIEW_FAILED':
      if (session.activeRequestSequence !== event.requestSequence) {
        return session;
      }
      return {
        ...session,
        status: 'invalid',
        preview: null,
        previewLifecycle: null,
        diagnostics: event.diagnostics,
        activeRequestSequence: null
      };

    case 'PREVIEW_SUPERSEDED':
      if (session.activeRequestSequence !== event.requestSequence) {
        return session;
      }
      return {
        ...session,
        activeRequestSequence: null,
        staleReason: 'source-changed'
      };

    case 'PROJECT_CHANGED':
      return {
        ...session,
        baseRevision: event.baseRevision,
        baseScreenFingerprint: event.baseScreenFingerprint,
        canonicalBaselineFingerprint: event.canonicalFingerprint,
        status: shouldMarkStale(session) ? 'stale' : session.status,
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: event.staleReason
      };

    case 'TARGET_SELECTION_CHANGED':
      return {
        ...session,
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: 'target-selection-changed'
      };

    case 'APPLY_STARTED':
      return {
        ...session,
        status: 'applying',
        previewLifecycle: 'applying'
      };

    case 'APPLY_SUCCEEDED':
      return {
        ...session,
        status: 'applied',
        sourceText: '',
        sourceFingerprint: fingerprintScreenDslSource(''),
        canonicalBaselineFingerprint: event.canonicalFingerprint,
        dirty: false,
        baseRevision: event.baseRevision,
        baseScreenFingerprint: event.baseScreenFingerprint,
        preview: null,
        previewLifecycle: 'consumed',
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: null
      };

    case 'APPLY_FAILED':
      return {
        ...session,
        status: 'failed',
        previewLifecycle: 'failed',
        diagnostics: event.diagnostics,
        activeRequestSequence: null
      };

    case 'DISCARD_DRAFT':
      return {
        ...session,
        sourceText: event.canonicalSourceText,
        sourceFingerprint: fingerprintScreenDslSource(event.canonicalSourceText),
        canonicalBaselineFingerprint: event.canonicalFingerprint,
        dirty: false,
        status: 'clean',
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: null
      };

    case 'REFRESH_FROM_PROJECT':
      if (session.dirty) {
        return {
          ...session,
          baseRevision: event.baseRevision,
          baseScreenFingerprint: event.baseScreenFingerprint,
          canonicalBaselineFingerprint: event.canonicalFingerprint,
          status: 'stale',
          preview: null,
          previewLifecycle: null,
          diagnostics: [],
          activeRequestSequence: null,
          staleReason: 'project-revision-changed'
        };
      }
      return {
        ...session,
        sourceText: event.canonicalSourceText,
        sourceFingerprint: fingerprintScreenDslSource(event.canonicalSourceText),
        canonicalBaselineFingerprint: event.canonicalFingerprint,
        dirty: false,
        status: 'clean',
        baseRevision: event.baseRevision,
        baseScreenFingerprint: event.baseScreenFingerprint,
        preview: null,
        previewLifecycle: null,
        diagnostics: [],
        activeRequestSequence: null,
        staleReason: null
      };

    case 'SESSION_DISPOSED':
      return { ...session, disposed: true, activeRequestSequence: null };

    default: {
      const _exhaustive: never = event;
      return session;
    }
  }
}

function shouldMarkStale(session: ScreenDslDocumentSession): boolean {
  return session.status === 'preview-ready' || session.status === 'dirty' || session.status === 'stale';
}

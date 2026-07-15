import type { ScreenDslDiagnostic, ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslPreviewLifecycle } from '../screenDsl/transactionContract';
import type { ScreenDslPreviewResult } from '../screenDsl/contracts';
import type { ScreenDslDocumentKey } from './identity';

export type ScreenDslDocumentStatus =
  | 'empty'
  | 'clean'
  | 'dirty'
  | 'validating'
  | 'invalid'
  | 'preview-ready'
  | 'stale'
  | 'applying'
  | 'applied'
  | 'failed';

export type ScreenDslStaleReason =
  | 'source-changed'
  | 'project-revision-changed'
  | 'screen-fingerprint-changed'
  | 'resource-fingerprint-changed'
  | 'target-selection-changed'
  | 'import-mode-changed'
  | 'identity-plan-changed'
  | 'undo-redo'
  | 'project-switched';

export interface ScreenDslDocumentSession {
  readonly key: ScreenDslDocumentKey;
  readonly sourceText: string;
  readonly sourceFingerprint: string;
  /** Fingerprint of the canonical source generated from the committed project. */
  readonly canonicalBaselineFingerprint: string | null;
  readonly dirty: boolean;
  readonly status: ScreenDslDocumentStatus;
  readonly baseRevision: number | null;
  readonly baseScreenFingerprint: string | null;
  readonly preview: ScreenDslPreviewResult | null;
  readonly previewLifecycle: ScreenDslPreviewLifecycle | null;
  readonly diagnostics: readonly ScreenDslDiagnostic[];
  readonly requestSequence: number;
  readonly activeRequestSequence: number | null;
  readonly staleReason: ScreenDslStaleReason | null;
  readonly disposed: boolean;
}

export interface ScreenDslPreviewRequest {
  readonly sessionKey: ScreenDslDocumentKey;
  readonly requestSequence: number;
  readonly baseRevision: number;
  readonly baseScreenFingerprint: string;
  readonly sourceFingerprint: string;
  readonly importMode: ScreenDslImportMode;
}

export interface ScreenDslSessionEvent {
  type:
    | 'SOURCE_INITIALIZED'
    | 'SOURCE_CHANGED'
    | 'VALIDATION_STARTED'
    | 'VALIDATION_FAILED'
    | 'PREVIEW_STARTED'
    | 'PREVIEW_SUCCEEDED'
    | 'PREVIEW_FAILED'
    | 'PREVIEW_SUPERSEDED'
    | 'PROJECT_CHANGED'
    | 'TARGET_SELECTION_CHANGED'
    | 'APPLY_STARTED'
    | 'APPLY_SUCCEEDED'
    | 'APPLY_FAILED'
    | 'DISCARD_DRAFT'
    | 'REFRESH_FROM_PROJECT'
    | 'SESSION_DISPOSED';
  payload?: ScreenDslSessionEventPayload;
}

export type ScreenDslSessionEventPayload =
  | { type: 'SOURCE_INITIALIZED'; sourceText: string; canonicalFingerprint: string; baseRevision: number; baseScreenFingerprint: string }
  | { type: 'SOURCE_CHANGED'; sourceText: string; sourceFingerprint: string }
  | { type: 'VALIDATION_STARTED'; requestSequence: number }
  | { type: 'VALIDATION_FAILED'; diagnostics: readonly ScreenDslDiagnostic[]; requestSequence: number }
  | { type: 'PREVIEW_STARTED'; requestSequence: number; baseRevision: number; baseScreenFingerprint: string }
  | { type: 'PREVIEW_SUCCEEDED'; preview: ScreenDslPreviewResult; requestSequence: number }
  | { type: 'PREVIEW_FAILED'; diagnostics: readonly ScreenDslDiagnostic[]; requestSequence: number }
  | { type: 'PREVIEW_SUPERSEDED'; requestSequence: number }
  | { type: 'PROJECT_CHANGED'; baseRevision: number; baseScreenFingerprint: string; canonicalFingerprint: string | null; staleReason: ScreenDslStaleReason }
  | { type: 'TARGET_SELECTION_CHANGED' }
  | { type: 'APPLY_STARTED' }
  | { type: 'APPLY_SUCCEEDED'; canonicalFingerprint: string; baseRevision: number; baseScreenFingerprint: string }
  | { type: 'APPLY_FAILED'; diagnostics: readonly ScreenDslDiagnostic[] }
  | { type: 'DISCARD_DRAFT'; canonicalSourceText: string; canonicalFingerprint: string }
  | { type: 'REFRESH_FROM_PROJECT'; canonicalSourceText: string; canonicalFingerprint: string; baseRevision: number; baseScreenFingerprint: string }
  | { type: 'SESSION_DISPOSED' };

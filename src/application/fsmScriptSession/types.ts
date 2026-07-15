import type { FsmParseDiagnostic, FsmScriptFormat } from '../../fsm-interchange';
import type { FsmScriptPreview } from '../fsmRoundTrip';

export type FsmScriptDocumentStatus =
  | 'clean'
  | 'dirty'
  | 'scheduled'
  | 'parsing'
  | 'invalid'
  | 'preview-ready'
  | 'stale'
  | 'conflicted'
  | 'applying'
  | 'applied'
  | 'failed';

export type FsmScriptStaleReason =
  | 'graph-changed'
  | 'project-changed'
  | 'source-changed'
  | 'preview-stale'
  | 'request-stale'
  | 'apply-rejected';

export interface FsmScriptDocumentSession {
  readonly projectId: string;
  readonly format: FsmScriptFormat;
  readonly sourceText: string;
  readonly sourceFingerprint: string;
  readonly baseRevision: number;
  readonly baseFsmFingerprint: string;
  readonly generatedSourceFingerprint: string | null;
  readonly dirty: boolean;
  readonly status: FsmScriptDocumentStatus;
  readonly requestSequence: number;
  readonly activeRequestSequence: number | null;
  readonly preview: FsmScriptPreview | null;
  readonly diagnostics: readonly FsmParseDiagnostic[];
  readonly staleReason: FsmScriptStaleReason | null;
}

export interface FsmScriptPreviewRequest {
  readonly projectId: string;
  readonly format: FsmScriptFormat;
  readonly requestSequence: number;
  readonly baseRevision: number;
  readonly baseFsmFingerprint: string;
  readonly sourceFingerprint: string;
}

export interface FsmScriptPreviewTask {
  readonly document: FsmScriptDocumentSession;
  readonly request: FsmScriptPreviewRequest;
}

export interface FsmScriptPreviewRejection {
  readonly accepted: false;
  readonly document: FsmScriptDocumentSession;
  readonly reason: FsmScriptStaleReason;
}

export interface FsmScriptPreviewAcceptance {
  readonly accepted: true;
  readonly document: FsmScriptDocumentSession;
}

export type FsmScriptPreviewResult =
  | FsmScriptPreviewAcceptance
  | FsmScriptPreviewRejection;

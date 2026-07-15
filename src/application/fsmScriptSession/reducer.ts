import {
  fsmInterchangeFingerprint,
  projectToFsmInterchange,
  type FsmScriptFormat
} from '../../fsm-interchange';
import { exportFsmScript, type FsmScriptPreview } from '../fsmRoundTrip';
import type { ProjectSession } from '../projectSession';
import { fingerprintScriptSource } from './fingerprint';
import type {
  FsmScriptDocumentSession,
  FsmScriptPreviewRequest,
  FsmScriptPreviewResult,
  FsmScriptPreviewTask,
  FsmScriptStaleReason
} from './types';

export function createFsmScriptDocumentSession(
  session: ProjectSession,
  format: FsmScriptFormat
): FsmScriptDocumentSession {
  const sourceText = exportFsmScript(session, format);
  const sourceFingerprint = fingerprintScriptSource(sourceText);
  return {
    projectId: session.project.meta.id,
    format,
    sourceText,
    sourceFingerprint,
    baseRevision: session.revision,
    baseFsmFingerprint: fingerprintProjectFsm(session),
    generatedSourceFingerprint: sourceFingerprint,
    dirty: false,
    status: 'clean',
    requestSequence: 0,
    activeRequestSequence: null,
    preview: null,
    diagnostics: [],
    staleReason: null
  };
}

export function editFsmScriptDocument(
  document: FsmScriptDocumentSession,
  sourceText: string,
  options: { autoPreview?: boolean } = {}
): FsmScriptDocumentSession {
  const sourceFingerprint = fingerprintScriptSource(sourceText);
  const dirty = sourceFingerprint !== document.generatedSourceFingerprint;
  return {
    ...document,
    sourceText,
    sourceFingerprint,
    dirty,
    status: options.autoPreview ? 'scheduled' : dirty ? 'dirty' : 'clean',
    preview: null,
    diagnostics: [],
    activeRequestSequence: null,
    staleReason: null
  };
}

export function scheduleFsmScriptPreview(document: FsmScriptDocumentSession): FsmScriptDocumentSession {
  return {
    ...document,
    status: 'scheduled',
    preview: null,
    activeRequestSequence: null,
    staleReason: null
  };
}

export function beginFsmScriptPreview(
  document: FsmScriptDocumentSession,
  session: ProjectSession
): FsmScriptPreviewTask {
  const rebased = rebaseFsmScriptDocument(document, session);
  const requestSequence = rebased.requestSequence + 1;
  const request: FsmScriptPreviewRequest = {
    projectId: rebased.projectId,
    format: rebased.format,
    requestSequence,
    baseRevision: rebased.baseRevision,
    baseFsmFingerprint: rebased.baseFsmFingerprint,
    sourceFingerprint: rebased.sourceFingerprint
  };
  return {
    document: {
      ...rebased,
      requestSequence,
      activeRequestSequence: requestSequence,
      status: 'parsing',
      preview: null,
      diagnostics: [],
      staleReason: null
    },
    request
  };
}

export function acceptFsmScriptPreviewResult(
  document: FsmScriptDocumentSession,
  request: FsmScriptPreviewRequest,
  preview: FsmScriptPreview
): FsmScriptPreviewResult {
  const staleReason = findPreviewRequestStaleReason(document, request, preview);
  if (staleReason) {
    return {
      accepted: false,
      reason: staleReason,
      document: {
        ...document,
        activeRequestSequence: document.activeRequestSequence === request.requestSequence
          ? null
          : document.activeRequestSequence,
        staleReason
      }
    };
  }
  return {
    accepted: true,
    document: {
      ...document,
      preview,
      diagnostics: preview.diagnostics,
      activeRequestSequence: null,
      status: preview.ok ? 'preview-ready' : 'invalid',
      staleReason: null
    }
  };
}

export function refreshFsmScriptDocumentFromGraph(
  document: FsmScriptDocumentSession,
  session: ProjectSession,
  options: { force?: boolean } = {}
): FsmScriptDocumentSession {
  if (document.projectId !== session.project.meta.id) {
    return createFsmScriptDocumentSession(session, document.format);
  }
  const generatedText = exportFsmScript(session, document.format);
  const generatedSourceFingerprint = fingerprintScriptSource(generatedText);
  const baseFsmFingerprint = fingerprintProjectFsm(session);
  if (!options.force && document.dirty) {
    const staleReason: FsmScriptStaleReason = document.baseFsmFingerprint === baseFsmFingerprint
      ? 'source-changed'
      : 'graph-changed';
    return {
      ...document,
      baseRevision: session.revision,
      baseFsmFingerprint,
      generatedSourceFingerprint,
      status: staleReason === 'graph-changed' ? 'stale' : document.status,
      preview: null,
      activeRequestSequence: null,
      diagnostics: [],
      staleReason
    };
  }
  return {
    ...document,
    sourceText: generatedText,
    sourceFingerprint: generatedSourceFingerprint,
    baseRevision: session.revision,
    baseFsmFingerprint,
    generatedSourceFingerprint,
    dirty: false,
    status: 'clean',
    requestSequence: document.requestSequence,
    activeRequestSequence: null,
    preview: null,
    diagnostics: [],
    staleReason: null
  };
}

export function markFsmScriptDocumentApplied(
  document: FsmScriptDocumentSession,
  session: ProjectSession
): FsmScriptDocumentSession {
  return refreshFsmScriptDocumentFromGraph(document, session, { force: true });
}

export function rebaseFsmScriptDocument(
  document: FsmScriptDocumentSession,
  session: ProjectSession
): FsmScriptDocumentSession {
  if (document.projectId !== session.project.meta.id) {
    return createFsmScriptDocumentSession(session, document.format);
  }
  const baseFsmFingerprint = fingerprintProjectFsm(session);
  return {
    ...document,
    baseRevision: session.revision,
    baseFsmFingerprint
  };
}

export function isFsmScriptPreviewApplicable(
  document: FsmScriptDocumentSession,
  session: ProjectSession
): boolean {
  const preview = document.preview;
  if (!preview?.ok || !preview.changeSet || !preview.candidate) {
    return false;
  }
  if (document.status !== 'preview-ready' || document.staleReason) {
    return false;
  }
  if (document.sourceFingerprint !== fingerprintScriptSource(document.sourceText)) {
    return false;
  }
  if (document.baseRevision !== session.revision || preview.baseRevision !== session.revision) {
    return false;
  }
  return document.baseFsmFingerprint === fingerprintProjectFsm(session)
    && preview.baseFingerprint === document.baseFsmFingerprint
    && (preview.diff?.operations.length ?? 0) > 0;
}

export function fingerprintProjectFsm(session: ProjectSession): string {
  return fsmInterchangeFingerprint(projectToFsmInterchange(session.project));
}

function findPreviewRequestStaleReason(
  document: FsmScriptDocumentSession,
  request: FsmScriptPreviewRequest,
  preview: FsmScriptPreview
): FsmScriptStaleReason | null {
  if (document.projectId !== request.projectId || document.format !== request.format) {
    return 'project-changed';
  }
  if (document.sourceFingerprint !== request.sourceFingerprint) {
    return 'source-changed';
  }
  if (document.activeRequestSequence !== request.requestSequence) {
    return 'request-stale';
  }
  if (document.baseRevision !== request.baseRevision || document.baseFsmFingerprint !== request.baseFsmFingerprint) {
    return 'graph-changed';
  }
  if (preview.baseRevision !== request.baseRevision || preview.baseFingerprint !== request.baseFsmFingerprint) {
    return 'preview-stale';
  }
  return null;
}

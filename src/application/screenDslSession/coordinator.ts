import type { ScreenDslImportMode } from '../../screen-dsl';
import type { ProjectSession } from '../projectSession';
import { exportSessionScreenInterchange } from '../screenInterchangeFacade';
import { applyScreenDslPreview, createScreenDslPreview } from '../screenDsl';
import type { ScreenDslTextFormat } from '../screenDsl/contracts';
import { fingerprintScreenDslSource } from '../screenDsl/hash';
import type { ScreenDslDocumentSession, ScreenDslSessionEventPayload } from './contracts';
import { createScreenDslDocumentKey, screenDslDocumentKeyEquals, type ScreenDslDocumentKey } from './identity';
import { createScreenDslDocumentSession, reduceScreenDslDocumentSession } from './reducer';

export interface ScreenDslSessionCoordinatorOptions {
  actor?: { id: string; type: 'system' | 'user' };
}

/**
 * Coordinator manages Screen DSL document session lifecycle.
 * It separates side effects (Preview/Apply calls) from pure state (reducer).
 * Not React/Electron/Zustand dependent.
 */
export class ScreenDslSessionCoordinator {
  private sessions = new Map<string, ScreenDslDocumentSession>();
  private actor: { id: string; type: 'system' | 'user' };

  constructor(options: ScreenDslSessionCoordinatorOptions = {}) {
    this.actor = options.actor ?? { id: 'screen-dsl-coordinator', type: 'system' };
  }

  getOrCreate(
    projectId: string,
    format: ScreenDslTextFormat,
    importMode: ScreenDslImportMode,
    targetScreenIds: readonly string[] = []
  ): ScreenDslDocumentSession {
    const key = createScreenDslDocumentKey(projectId, format, importMode, targetScreenIds);
    const serialized = this.serializeKey(key);
    const existing = this.sessions.get(serialized);
    if (existing && !existing.disposed) {
      return existing;
    }
    const session = createScreenDslDocumentSession(key);
    this.sessions.set(serialized, session);
    return session;
  }

  initialize(
    projectSession: ProjectSession,
    format: ScreenDslTextFormat,
    importMode: ScreenDslImportMode,
    targetScreenIds: readonly string[],
    canonicalSourceText: string
  ): ScreenDslDocumentSession {
    const key = createScreenDslDocumentKey(projectSession.project.meta.id, format, importMode, targetScreenIds);
    const baseScreenFingerprint = exportSessionScreenInterchange(
      projectSession,
      targetScreenIds.length > 0 ? targetScreenIds : undefined
    ).fingerprint;
    const canonicalFingerprint = fingerprintScreenDslSource(canonicalSourceText);
    const event: ScreenDslSessionEventPayload = {
      type: 'SOURCE_INITIALIZED',
      sourceText: canonicalSourceText,
      canonicalFingerprint,
      baseRevision: projectSession.revision,
      baseScreenFingerprint
    };
    return this.applyEvent(key, event);
  }

  updateSource(key: ScreenDslDocumentKey, sourceText: string): ScreenDslDocumentSession {
    const event: ScreenDslSessionEventPayload = {
      type: 'SOURCE_CHANGED',
      sourceText,
      sourceFingerprint: fingerprintScreenDslSource(sourceText)
    };
    return this.applyEvent(key, event);
  }

  async requestPreview(
    projectSession: ProjectSession,
    key: ScreenDslDocumentKey
  ): Promise<ScreenDslDocumentSession> {
    const docSession = this.getSession(key);
    if (!docSession || docSession.disposed) {
      return docSession ?? createScreenDslDocumentSession(key);
    }
    const baseScreenFingerprint = exportSessionScreenInterchange(
      projectSession,
      key.targetScreenIds.length > 0 ? key.targetScreenIds : undefined
    ).fingerprint;
    const requestSequence = docSession.requestSequence + 1;

    this.applyEvent(key, {
      type: 'PREVIEW_STARTED',
      requestSequence,
      baseRevision: projectSession.revision,
      baseScreenFingerprint
    });

    const current = this.getSession(key)!;
    if (current.activeRequestSequence !== requestSequence) {
      return current;
    }

    const preview = createScreenDslPreview(projectSession, {
      projectId: key.projectId,
      expectedRevision: projectSession.revision,
      format: key.format,
      sourceText: current.sourceText,
      importMode: key.importMode,
      targetScreenIds: key.targetScreenIds.length > 0 ? [...key.targetScreenIds] : undefined,
      actor: this.actor
    });

    const afterRequest = this.getSession(key)!;
    if (afterRequest.activeRequestSequence !== requestSequence ||
        afterRequest.sourceFingerprint !== preview.sourceFingerprint ||
        afterRequest.baseRevision !== preview.baseRevision) {
      this.applyEvent(key, { type: 'PREVIEW_SUPERSEDED', requestSequence });
      return this.getSession(key)!;
    }

    if (preview.diagnostics.some((d) => d.severity === 'error') || !preview.applyAllowed) {
      return this.applyEvent(key, {
        type: 'PREVIEW_FAILED',
        diagnostics: preview.diagnostics,
        requestSequence
      });
    }

    return this.applyEvent(key, {
      type: 'PREVIEW_SUCCEEDED',
      preview,
      requestSequence
    });
  }

  applyPreview(
    projectSession: ProjectSession,
    key: ScreenDslDocumentKey,
    canonicalSourceAfter: string
  ): ScreenDslDocumentSession {
    const docSession = this.getSession(key);
    if (!docSession?.preview || docSession.disposed) {
      return docSession ?? createScreenDslDocumentSession(key);
    }

    this.applyEvent(key, { type: 'APPLY_STARTED' });

    const result = applyScreenDslPreview(projectSession, {
      preview: docSession.preview,
      sourceText: docSession.sourceText
    });

    if (!result.applied || !result.result) {
      return this.applyEvent(key, {
        type: 'APPLY_FAILED',
        diagnostics: result.diagnostics
      });
    }

    const newSession = result.result.session;
    const baseScreenFingerprint = exportSessionScreenInterchange(
      newSession,
      key.targetScreenIds.length > 0 ? [...key.targetScreenIds] : undefined
    ).fingerprint;
    const canonicalFingerprint = fingerprintScreenDslSource(canonicalSourceAfter);

    return this.applyEvent(key, {
      type: 'APPLY_SUCCEEDED',
      canonicalFingerprint,
      baseRevision: newSession.revision,
      baseScreenFingerprint
    });
  }

  notifyProjectChanged(
    key: ScreenDslDocumentKey,
    newRevision: number,
    newScreenFingerprint: string,
    newCanonicalFingerprint: string | null
  ): ScreenDslDocumentSession {
    const docSession = this.getSession(key);
    if (!docSession || docSession.disposed) {
      return docSession ?? createScreenDslDocumentSession(key);
    }
    const staleReason =
      newRevision !== docSession.baseRevision ? 'project-revision-changed' :
      newScreenFingerprint !== docSession.baseScreenFingerprint ? 'screen-fingerprint-changed' :
      'project-revision-changed';

    return this.applyEvent(key, {
      type: 'PROJECT_CHANGED',
      baseRevision: newRevision,
      baseScreenFingerprint: newScreenFingerprint,
      canonicalFingerprint: newCanonicalFingerprint,
      staleReason
    });
  }

  refreshFromProject(
    projectSession: ProjectSession,
    key: ScreenDslDocumentKey,
    canonicalSourceText: string
  ): ScreenDslDocumentSession {
    const baseScreenFingerprint = exportSessionScreenInterchange(
      projectSession,
      key.targetScreenIds.length > 0 ? [...key.targetScreenIds] : undefined
    ).fingerprint;
    const canonicalFingerprint = fingerprintScreenDslSource(canonicalSourceText);
    return this.applyEvent(key, {
      type: 'REFRESH_FROM_PROJECT',
      canonicalSourceText,
      canonicalFingerprint,
      baseRevision: projectSession.revision,
      baseScreenFingerprint
    });
  }

  discardDraft(key: ScreenDslDocumentKey, canonicalSourceText: string): ScreenDslDocumentSession {
    const canonicalFingerprint = fingerprintScreenDslSource(canonicalSourceText);
    return this.applyEvent(key, {
      type: 'DISCARD_DRAFT',
      canonicalSourceText,
      canonicalFingerprint
    });
  }

  dispose(key: ScreenDslDocumentKey): void {
    this.applyEvent(key, { type: 'SESSION_DISPOSED' });
  }

  getSession(key: ScreenDslDocumentKey): ScreenDslDocumentSession | undefined {
    return this.sessions.get(this.serializeKey(key));
  }

  getAllSessions(): ScreenDslDocumentSession[] {
    return [...this.sessions.values()];
  }

  private applyEvent(key: ScreenDslDocumentKey, event: ScreenDslSessionEventPayload): ScreenDslDocumentSession {
    const serialized = this.serializeKey(key);
    const existing = this.sessions.get(serialized) ?? createScreenDslDocumentSession(key);
    const next = reduceScreenDslDocumentSession(existing, event);
    this.sessions.set(serialized, next);
    return next;
  }

  private serializeKey(key: ScreenDslDocumentKey): string {
    return `${key.projectId}|${key.format}|${key.importMode}|${key.targetScreenIds.join(',')}`;
  }
}

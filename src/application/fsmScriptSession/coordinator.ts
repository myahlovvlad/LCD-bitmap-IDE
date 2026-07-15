import type { FsmScriptFormat } from '../../fsm-interchange';
import { previewFsmScriptImport, type FsmScriptPreview } from '../fsmRoundTrip';
import type { ProjectSession } from '../projectSession';
import {
  acceptFsmScriptPreviewResult,
  beginFsmScriptPreview
} from './reducer';
import type {
  FsmScriptDocumentSession,
  FsmScriptPreviewRequest,
  FsmScriptPreviewResult,
  FsmScriptPreviewTask
} from './types';

export interface FsmScriptPreviewRunner {
  (
    session: ProjectSession,
    source: string,
    format: FsmScriptFormat
  ): FsmScriptPreview | Promise<FsmScriptPreview>;
}

export interface FsmScriptPreviewScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface FsmScriptPreviewCoordinatorOptions {
  readonly delayMs?: number;
  readonly runPreview?: FsmScriptPreviewRunner;
  readonly scheduler?: FsmScriptPreviewScheduler;
}

export interface FsmScriptPreviewCoordinatorHooks {
  readonly readDocument: () => FsmScriptDocumentSession;
  readonly writeDocument: (document: FsmScriptDocumentSession) => void;
  readonly readSession: () => ProjectSession;
  readonly onResult?: (result: FsmScriptPreviewResult) => void;
}

const DEFAULT_DELAY_MS = 350;

export class FsmScriptPreviewCoordinator {
  private readonly delayMs: number;
  private readonly runPreview: FsmScriptPreviewRunner;
  private readonly scheduler: FsmScriptPreviewScheduler;
  private activeHandle: unknown = null;

  constructor(options: FsmScriptPreviewCoordinatorOptions = {}) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.runPreview = options.runPreview ?? previewFsmScriptImport;
    this.scheduler = options.scheduler ?? timeoutScheduler;
  }

  schedule(hooks: FsmScriptPreviewCoordinatorHooks): void {
    this.cancel();
    this.activeHandle = this.scheduler.schedule(() => {
      this.activeHandle = null;
      void this.previewNow(hooks);
    }, this.delayMs);
  }

  cancel(): void {
    if (this.activeHandle !== null) {
      this.scheduler.cancel(this.activeHandle);
      this.activeHandle = null;
    }
  }

  async previewNow(hooks: FsmScriptPreviewCoordinatorHooks): Promise<FsmScriptPreviewResult> {
    const session = hooks.readSession();
    const task = beginFsmScriptPreview(hooks.readDocument(), session);
    hooks.writeDocument(task.document);
    const preview = await this.runPreview(
      session,
      task.document.sourceText,
      task.document.format
    );
    const result = acceptFsmScriptPreviewResult(hooks.readDocument(), task.request, preview);
    hooks.writeDocument(result.document);
    hooks.onResult?.(result);
    return result;
  }
}

export function previewFsmScriptDocumentNow(
  document: FsmScriptDocumentSession,
  session: ProjectSession,
  preview: FsmScriptPreview
): FsmScriptPreviewResult {
  const task: FsmScriptPreviewTask = beginFsmScriptPreview(document, session);
  return acceptFsmScriptPreviewResult(task.document, task.request, preview);
}

export function isSamePreviewRequest(
  request: FsmScriptPreviewRequest,
  document: FsmScriptDocumentSession
): boolean {
  return request.projectId === document.projectId
    && request.format === document.format
    && request.requestSequence === document.activeRequestSequence
    && request.sourceFingerprint === document.sourceFingerprint
    && request.baseRevision === document.baseRevision
    && request.baseFsmFingerprint === document.baseFsmFingerprint;
}

const timeoutScheduler: FsmScriptPreviewScheduler = {
  schedule(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  cancel(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
};

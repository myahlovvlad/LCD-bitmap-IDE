import { describe, expect, it } from 'vitest';
import {
  createFsmScriptDocumentSession,
  editFsmScriptDocument,
  FsmScriptPreviewCoordinator,
  type FsmScriptPreviewScheduler
} from '../../src/application';
import { demoSession, previewScript } from './fsmRoundTripTestHelpers';

describe('FSM script preview coordinator', () => {
  it('debounces scheduled previews and runs only the latest pending callback', async () => {
    const scheduler = createManualScheduler();
    const session = demoSession();
    let document = editFsmScriptDocument(
      createFsmScriptDocumentSession(session, 'mermaid'),
      createFsmScriptDocumentSession(session, 'mermaid').sourceText.replace('title="Measurement"', 'title="Debounced"'),
      { autoPreview: true }
    );
    let runCount = 0;
    const coordinator = new FsmScriptPreviewCoordinator({
      delayMs: 10,
      scheduler,
      runPreview: (currentSession, source, format) => {
        runCount += 1;
        return previewScript(currentSession, source, format);
      }
    });

    coordinator.schedule({
      readDocument: () => document,
      writeDocument: (next) => { document = next; },
      readSession: () => session
    });
    coordinator.schedule({
      readDocument: () => document,
      writeDocument: (next) => { document = next; },
      readSession: () => session
    });

    await scheduler.flushNext();

    expect(runCount).toBe(1);
    expect(document.status).toBe('preview-ready');
    expect(document.preview?.diff?.operations.length).toBeGreaterThan(0);
  });

  it('does not mutate project revision or command history during preview', async () => {
    const session = demoSession();
    let document = editFsmScriptDocument(
      createFsmScriptDocumentSession(session, 'python'),
      createFsmScriptDocumentSession(session, 'python').sourceText.replace('title="Measurement"', 'title="Preview only"'),
      { autoPreview: true }
    );
    const coordinator = new FsmScriptPreviewCoordinator({
      runPreview: (currentSession, source, format) => previewScript(currentSession, source, format)
    });

    await coordinator.previewNow({
      readDocument: () => document,
      writeDocument: (next) => { document = next; },
      readSession: () => session
    });

    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
    expect(document.status).toBe('preview-ready');
  });
});

function createManualScheduler(): FsmScriptPreviewScheduler & { flushNext: () => Promise<void> } {
  const queue: Array<{ callback: () => void; canceled: boolean }> = [];
  return {
    schedule(callback) {
      const item = { callback, canceled: false };
      queue.push(item);
      return item;
    },
    cancel(handle) {
      (handle as { canceled: boolean }).canceled = true;
    },
    async flushNext() {
      const item = queue.find((entry) => !entry.canceled);
      if (!item) {
        return;
      }
      item.canceled = true;
      item.callback();
      await Promise.resolve();
    }
  };
}

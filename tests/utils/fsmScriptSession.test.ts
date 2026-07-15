import { describe, expect, it } from 'vitest';
import {
  acceptFsmScriptPreviewResult,
  beginFsmScriptPreview,
  createFsmScriptDocumentSession,
  editFsmScriptDocument,
  fingerprintProjectFsm,
  isFsmScriptPreviewApplicable,
  refreshFsmScriptDocumentFromGraph
} from '../../src/application';
import { demoSession, previewScript, cloneSessionWithProject } from './fsmRoundTripTestHelpers';

describe('FSM script document session', () => {
  it('creates a clean transient document from the canonical project FSM', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');

    expect(document.projectId).toBe(session.project.meta.id);
    expect(document.format).toBe('mermaid');
    expect(document.status).toBe('clean');
    expect(document.dirty).toBe(false);
    expect(document.generatedSourceFingerprint).toBe(document.sourceFingerprint);
    expect(document.baseRevision).toBe(session.revision);
    expect(document.baseFsmFingerprint).toBe(fingerprintProjectFsm(session));
  });

  it('refreshes a clean document from graph changes without marking it dirty', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');
    const nextSession = renameMeasureState(session, 'Measure refreshed');

    const refreshed = refreshFsmScriptDocumentFromGraph(document, nextSession);

    expect(refreshed.status).toBe('clean');
    expect(refreshed.dirty).toBe(false);
    expect(refreshed.sourceText).toContain('title="Measure refreshed"');
    expect(refreshed.baseRevision).toBe(nextSession.revision);
    expect(refreshed.baseFsmFingerprint).toBe(fingerprintProjectFsm(nextSession));
  });

  it('does not overwrite a dirty document when the graph changes', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');
    const edited = editFsmScriptDocument(
      document,
      document.sourceText.replace('title="Measurement"', 'title="Draft measurement"'),
      { autoPreview: true }
    );
    const nextSession = renameMeasureState(session, 'Graph measurement');

    const refreshed = refreshFsmScriptDocumentFromGraph(edited, nextSession);

    expect(refreshed.sourceText).toContain('title="Draft measurement"');
    expect(refreshed.sourceText).not.toContain('title="Graph measurement"');
    expect(refreshed.status).toBe('stale');
    expect(refreshed.dirty).toBe(true);
    expect(refreshed.staleReason).toBe('graph-changed');
    expect(refreshed.preview).toBeNull();
  });

  it('rejects an older preview result after a newer edit changes the source fingerprint', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');
    const firstEdit = editFsmScriptDocument(
      document,
      document.sourceText.replace('title="Measurement"', 'title="First draft"'),
      { autoPreview: true }
    );
    const task = beginFsmScriptPreview(firstEdit, session);
    const secondEdit = editFsmScriptDocument(
      task.document,
      task.document.sourceText.replace('title="First draft"', 'title="Second draft"'),
      { autoPreview: true }
    );
    const oldPreview = previewScript(session, task.document.sourceText, 'mermaid');

    const result = acceptFsmScriptPreviewResult(secondEdit, task.request, oldPreview);

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('source-changed');
    expect(result.document.sourceText).toContain('title="Second draft"');
    expect(result.document.preview).toBeNull();
  });

  it('accepts only a sequence-bound preview as applicable to the current graph', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');
    const edited = editFsmScriptDocument(
      document,
      document.sourceText.replace('title="Measurement"', 'title="Preview ready"'),
      { autoPreview: true }
    );
    const task = beginFsmScriptPreview(edited, session);
    const preview = previewScript(session, task.document.sourceText, 'mermaid');
    const result = acceptFsmScriptPreviewResult(task.document, task.request, preview);

    expect(result.accepted).toBe(true);
    expect(result.document.status).toBe('preview-ready');
    expect(isFsmScriptPreviewApplicable(result.document, session)).toBe(true);
    expect(isFsmScriptPreviewApplicable(result.document, renameMeasureState(session, 'Other graph'))).toBe(false);
  });
});

function renameMeasureState(session: ReturnType<typeof demoSession>, title: string) {
  const measure = session.project.fsm.states.measure;
  return cloneSessionWithProject(session, {
    ...session.project,
    fsm: {
      ...session.project.fsm,
      states: {
        ...session.project.fsm.states,
        measure: { ...measure, title }
      }
    }
  }, session.revision + 1);
}

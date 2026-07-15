import { describe, expect, it } from 'vitest';
import {
  acceptFsmScriptPreviewResult,
  applyFsmScriptPreview,
  beginFsmScriptPreview,
  createFixedApplicationCommandContext,
  createFsmScriptDocumentSession,
  editFsmScriptDocument,
  isFsmScriptPreviewApplicable,
  markFsmScriptDocumentApplied,
  refreshFsmScriptDocumentFromGraph
} from '../../src/application';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  createEffectInvocation,
  createGuardInvocation,
  serializeEffectInvocations,
  serializeGuardInvocation
} from '../../src/fsm-behavior';
import { demoSession, previewScript } from './fsmRoundTripTestHelpers';

const timestamp = '2026-06-25T05:15:00.000Z';

describe('FSM script controlled synchronization integration', () => {
  it('keeps auto-preview separate from explicit Apply and command history', () => {
    const session = demoSession();
    const document = createFsmScriptDocumentSession(session, 'mermaid');
    const edited = editFsmScriptDocument(
      document,
      document.sourceText.replace('title="Measurement"', 'title="Integration Preview"'),
      { autoPreview: true }
    );
    const task = beginFsmScriptPreview(edited, session);
    const preview = previewScript(session, task.document.sourceText, 'mermaid');
    const accepted = acceptFsmScriptPreviewResult(task.document, task.request, preview);

    expect(accepted.accepted).toBe(true);
    expect(session.revision).toBe(0);
    expect(session.history.entries).toHaveLength(0);
    expect(isFsmScriptPreviewApplicable(accepted.document, session)).toBe(true);

    const applied = applyFsmScriptPreview(
      session,
      accepted.document.preview!,
      createFixedApplicationCommandContext(timestamp)
    );

    expect(applied.status).toBe('applied');
    expect(applied.session.revision).toBe(1);
    expect(applied.session.history.entries).toHaveLength(1);
    expect(applied.session.project.fsm.states.measure.title).toBe('Integration Preview');
  });

  it('marks sibling dirty format stale after applying one format', () => {
    const session = demoSession();
    const mermaid = editFsmScriptDocument(
      createFsmScriptDocumentSession(session, 'mermaid'),
      createFsmScriptDocumentSession(session, 'mermaid').sourceText.replace('title="Measurement"', 'title="Applied Format"'),
      { autoPreview: false }
    );
    const python = editFsmScriptDocument(
      createFsmScriptDocumentSession(session, 'python'),
      createFsmScriptDocumentSession(session, 'python').sourceText.replace('title="Measurement"', 'title="Python Draft"'),
      { autoPreview: false }
    );
    const task = beginFsmScriptPreview(mermaid, session);
    const accepted = acceptFsmScriptPreviewResult(
      task.document,
      task.request,
      previewScript(session, task.document.sourceText, 'mermaid')
    );
    if (!accepted.accepted) {
      throw new Error('Expected preview acceptance');
    }
    const applied = applyFsmScriptPreview(
      session,
      accepted.document.preview!,
      createFixedApplicationCommandContext(timestamp)
    );

    const cleanMermaid = markFsmScriptDocumentApplied(accepted.document, applied.session);
    const stalePython = refreshFsmScriptDocumentFromGraph(python, applied.session);

    expect(cleanMermaid.dirty).toBe(false);
    expect(stalePython.sourceText).toContain('Python Draft');
    expect(stalePython.status).toBe('stale');
    expect(stalePython.staleReason).toBe('graph-changed');
  });

  it('keeps typed and opaque behavior storage byte-preserved during preview/apply lifecycle', () => {
    const session = demoSession();
    const guard = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    }));
    const effects = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);
    session.project.fsm.transitions['tr-main-measure'].condition = guard;
    session.project.fsm.transitions['tr-main-measure'].backendProcessId = effects;
    session.project.fsm.transitions['tr-measure-save'].condition = 'status == READY';
    session.project.fsm.transitions['tr-measure-error'].backendProcessId = '@lcdide-effect-process';

    const document = createFsmScriptDocumentSession(session, 'python');
    const edited = editFsmScriptDocument(
      document,
      document.sourceText.replace('title="Measurement"', 'title="Behavior Safe"'),
      { autoPreview: false }
    );
    const task = beginFsmScriptPreview(edited, session);
    const accepted = acceptFsmScriptPreviewResult(
      task.document,
      task.request,
      previewScript(session, task.document.sourceText, 'python')
    );
    if (!accepted.accepted) {
      throw new Error('Expected preview acceptance');
    }
    const applied = applyFsmScriptPreview(
      session,
      accepted.document.preview!,
      createFixedApplicationCommandContext(timestamp)
    );

    expect(applied.session.project.fsm.transitions['tr-main-measure'].condition).toBe(guard);
    expect(applied.session.project.fsm.transitions['tr-main-measure'].backendProcessId).toBe(effects);
    expect(applied.session.project.fsm.transitions['tr-measure-save'].condition).toBe('status == READY');
    expect(applied.session.project.fsm.transitions['tr-measure-error'].backendProcessId).toBe('@lcdide-effect-process');
  });
});

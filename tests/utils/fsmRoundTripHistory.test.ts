import { describe, expect, it } from 'vitest';
import { redoProjectSession, undoProjectSession } from '../../src/application';
import {
  applyPreview,
  demoSession,
  exportScript,
  previewScript
} from './fsmRoundTripTestHelpers';

describe('FSM round-trip history integration', () => {
  it('applies one semantic import as one history entry and replays it with Undo/Redo', () => {
    const session = demoSession(7);
    const source = exportScript(session, 'mermaid')
      .replace('title="Measurement"', 'title="Measure Accepted"')
      .replace('x=250 y=200 order=1', 'x=321 y=123 order=1');

    const preview = previewScript(session, source, 'mermaid');
    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations.map((operation) => operation.type)).toEqual([
      'state.update',
      'layout.update'
    ]);
    expect(session.project.fsm.states.measure.title).toBe('Measurement');
    expect(session.project.fsm.graphLayout.measure).toEqual({ x: 250, y: 200 });

    const applied = applyPreview(session, preview);
    expect(applied.status).toBe('applied');
    expect(applied.session.revision).toBe(8);
    expect(applied.session.history.entries).toHaveLength(1);
    expect(applied.session.history.entries[0]).toEqual(expect.objectContaining({
      kind: 'changeset',
      revisionBefore: 7,
      revisionAfter: 8,
      label: expect.stringMatching(/^fsm-roundtrip-/)
    }));
    expect(applied.session.project.fsm.states.measure.title).toBe('Measure Accepted');
    expect(applied.session.project.fsm.graphLayout.measure).toEqual({ x: 321, y: 123 });

    const undone = undoProjectSession(applied.session);
    expect(undone?.revision).toBe(9);
    expect(undone?.history.cursor).toBe(0);
    expect(undone?.project.fsm.states.measure.title).toBe('Measurement');
    expect(undone?.project.fsm.graphLayout.measure).toEqual({ x: 250, y: 200 });

    const redone = undone ? redoProjectSession(undone) : null;
    expect(redone?.revision).toBe(10);
    expect(redone?.history.cursor).toBe(1);
    expect(redone?.project.fsm.states.measure.title).toBe('Measure Accepted');
    expect(redone?.project.fsm.graphLayout.measure).toEqual({ x: 321, y: 123 });
    expect(redone?.project.fsm.stateOrder).toEqual(session.project.fsm.stateOrder);
    expect(redone?.project.fsm.transitionOrder).toEqual(session.project.fsm.transitionOrder);
  });

  it('keeps no-op previews out of command history', () => {
    const session = demoSession(3);
    const preview = previewScript(session, exportScript(session, 'python'), 'python');

    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations).toEqual([]);

    const result = applyPreview(session, preview);
    expect(result.status).toBe('noop');
    expect(result.session).toBe(session);
    expect(result.session.revision).toBe(3);
    expect(result.session.history.entries).toHaveLength(0);
  });
});

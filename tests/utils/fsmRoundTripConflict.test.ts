import { describe, expect, it } from 'vitest';
import {
  applyPreview,
  cloneSessionWithProject,
  demoSession,
  exportScript,
  previewScript
} from './fsmRoundTripTestHelpers';

describe('FSM round-trip conflict integration', () => {
  it('rejects stale expectedRevision without mutating the later session', () => {
    const session = demoSession(1);
    const source = exportScript(session, 'mermaid').replace('title="Measurement"', 'title="Measure Later"');
    const preview = previewScript(session, source, 'mermaid');
    const later = cloneSessionWithProject(session, session.project, 2);

    const rejected = applyPreview(later, preview);

    expect(rejected.status).toBe('rejected');
    expect(rejected.diagnostics[0]).toEqual(expect.objectContaining({ code: 'fsm.roundtrip.stale-preview' }));
    expect(later.project.fsm.states.measure.title).toBe('Measurement');
    expect(later.history.entries).toHaveLength(0);
  });

  it('rejects stale FSM fingerprints even when the revision number matches', () => {
    const session = demoSession(4);
    const source = exportScript(session, 'mermaid').replace('title="Measurement"', 'title="Measure From Preview"');
    const preview = previewScript(session, source, 'mermaid');
    const changedProject = {
      ...session.project,
      fsm: {
        ...session.project.fsm,
        states: {
          ...session.project.fsm.states,
          error: { ...session.project.fsm.states.error, title: 'Changed Elsewhere' }
        }
      }
    };
    const sameRevisionButDifferentFsm = cloneSessionWithProject(session, changedProject, 4);

    const rejected = applyPreview(sameRevisionButDifferentFsm, preview);

    expect(rejected.status).toBe('rejected');
    expect(rejected.diagnostics[0]).toEqual(expect.objectContaining({ code: 'fsm.roundtrip.stale-preview' }));
    expect(sameRevisionButDifferentFsm.project.fsm.states.measure.title).toBe('Measurement');
    expect(sameRevisionButDifferentFsm.project.fsm.states.error.title).toBe('Changed Elsewhere');
  });

  it('does not create a ChangeSet or mutate project state for parser failures', () => {
    const session = demoSession();
    const preview = previewScript(session, [
      'from lcd_bitmap_ide import FSM, State, Event',
      'exec("print(1)")',
      'this is not supported'
    ].join('\n'), 'python');

    expect(preview.ok).toBe(false);
    expect(preview.changeSet).toBeUndefined();
    expect(preview.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'fsm.python.blocked-construct',
      'fsm.python.syntax'
    ]);

    const rejected = applyPreview(session, preview);
    expect(rejected.status).toBe('rejected');
    expect(rejected.diagnostics[0]).toEqual(expect.objectContaining({ code: 'fsm.roundtrip.preview-invalid' }));
    expect(session.project.fsm.states.measure.title).toBe('Measurement');
    expect(session.history.entries).toHaveLength(0);
  });
});

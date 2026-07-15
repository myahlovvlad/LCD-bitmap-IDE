import { describe, expect, it } from 'vitest';
import {
  applyPreview,
  demoSession,
  exportScript,
  previewScript
} from './fsmRoundTripTestHelpers';

describe('FSM round-trip transition handle integration', () => {
  it('preserves unchanged handles and applies explicit handle updates', () => {
    const session = demoSession();
    const source = exportScript(session, 'python')
      .replace(
        'id="tr-main-measure", from="main-menu", to="measure", event="START", mechanism="event", button=null, fact=null, source_handle="s-right", target_handle="t-left"',
        'id="tr-main-measure", from="main-menu", to="measure", event="START", mechanism="event", button=null, fact=null, source_handle="s-bottom", target_handle="t-top"'
      );

    const preview = previewScript(session, source, 'python');
    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations).toEqual([
      expect.objectContaining({ type: 'transition.update', id: 'tr-main-measure' })
    ]);

    const applied = applyPreview(session, preview);
    expect(applied.status).toBe('applied');
    expect(applied.session.project.fsm.transitions['tr-main-measure']).toEqual(expect.objectContaining({
      sourceHandle: 's-bottom',
      targetHandle: 't-top'
    }));
    expect(applied.session.project.fsm.transitions['tr-measure-save']).toEqual(expect.objectContaining({
      sourceHandle: session.project.fsm.transitions['tr-measure-save'].sourceHandle,
      targetHandle: session.project.fsm.transitions['tr-measure-save'].targetHandle
    }));
  });
});

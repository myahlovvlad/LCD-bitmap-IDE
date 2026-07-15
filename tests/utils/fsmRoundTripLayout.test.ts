import { describe, expect, it } from 'vitest';
import {
  applyPreview,
  demoSession,
  exportScript,
  previewScript
} from './fsmRoundTripTestHelpers';

describe('FSM round-trip layout integration', () => {
  it('preserves unchanged graph positions and applies explicit layout metadata', () => {
    const session = demoSession();
    const beforeLayout = session.project.fsm.graphLayout;
    const source = exportScript(session, 'mermaid')
      .replace('%% lcdide:layout state="measure" x=250 y=200 order=1', '%% lcdide:layout state="measure" x=512 y=256 order=1');

    const preview = previewScript(session, source, 'mermaid');
    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations).toEqual([
      expect.objectContaining({ type: 'layout.update', id: 'measure' })
    ]);

    const applied = applyPreview(session, preview);
    expect(applied.status).toBe('applied');
    expect(applied.session.project.fsm.graphLayout.measure).toEqual({ x: 512, y: 256 });

    for (const stateId of session.project.fsm.stateOrder.filter((id) => id !== 'measure')) {
      expect(applied.session.project.fsm.graphLayout[stateId]).toEqual(beforeLayout[stateId]);
    }
  });

  it('preserves previous layout when a candidate omits layout directives', () => {
    const session = demoSession();
    const sourceWithoutLayout = exportScript(session, 'mermaid')
      .split('\n')
      .filter((line) => !line.includes('%% lcdide:layout'))
      .join('\n')
      .replace('title="Measurement"', 'title="Measurement Without Layout Directives"');

    const preview = previewScript(session, sourceWithoutLayout, 'mermaid');
    expect(preview.ok).toBe(true);

    const applied = applyPreview(session, preview);
    expect(applied.status).toBe('applied');
    expect(applied.session.project.fsm.graphLayout).toEqual(session.project.fsm.graphLayout);
  });
});

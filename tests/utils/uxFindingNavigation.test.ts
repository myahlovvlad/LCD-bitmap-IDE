import { describe, expect, it } from 'vitest';
import type { UxValidationFinding } from '../../src/services/ux/uxTypes';
import { resolveNavigationTarget } from '../../src/features/ux-validation/uxFindingNavigation';

function finding(affected: UxValidationFinding['affected']): UxValidationFinding {
  return {
    id: 'x', ruleId: 'ux.test', category: 'structure', severity: 'warning',
    message: 'test', affected
  };
}

describe('resolveNavigationTarget', () => {
  it('prefers a transition id, routing to the FSM workspace', () => {
    const target = resolveNavigationTarget(finding({ transitionIds: ['tr-1'], stateIds: ['st-1'] }));
    expect(target).toEqual({ mode: 'fsm', transitionId: 'tr-1' });
  });

  it('falls back to a state id when no transition is affected', () => {
    const target = resolveNavigationTarget(finding({ stateIds: ['st-1'] }));
    expect(target).toEqual({ mode: 'fsm', stateId: 'st-1' });
  });

  it('routes a control id to the control-panel workspace', () => {
    const target = resolveNavigationTarget(finding({ controlIds: ['btn-1'] }));
    expect(target).toEqual({ mode: 'control-panel', elementId: 'btn-1' });
  });

  it('routes a screen id to the LCD workspace', () => {
    const target = resolveNavigationTarget(finding({ screenIds: ['scr-1'] }));
    expect(target).toEqual({ mode: 'lcd', screenId: 'scr-1' });
  });

  it('returns null when nothing navigable is affected', () => {
    const target = resolveNavigationTarget(finding({ goalIds: ['goal-1'] }));
    expect(target).toBeNull();
  });
});

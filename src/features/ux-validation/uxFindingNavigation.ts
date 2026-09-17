/** Pure mapping from a UX finding's affected ids to a workspace navigation target. No React. */
import type { WorkspaceLocation } from '../../domain/project';
import type { UxValidationFinding } from '../../services/ux/uxTypes';

export function resolveNavigationTarget(finding: UxValidationFinding): WorkspaceLocation | null {
  const { affected } = finding;
  if (affected.transitionIds?.[0]) return { mode: 'fsm', transitionId: affected.transitionIds[0] };
  if (affected.stateIds?.[0]) return { mode: 'fsm', stateId: affected.stateIds[0] };
  if (affected.controlIds?.[0]) return { mode: 'control-panel', elementId: affected.controlIds[0] };
  if (affected.screenIds?.[0]) return { mode: 'lcd', screenId: affected.screenIds[0] };
  return null;
}

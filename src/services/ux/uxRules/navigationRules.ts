/** Category B — navigation and recovery rules. */
import type { ProjectUxGraph } from '../uxGraphBuilder';
import { findCycles, forwardReachable, hasPathTo, initialStateIds } from '../uxGraphAlgorithms';
import { makeFinding, type UxValidationFinding } from '../uxTypes';

export function evaluateNavigationRules(graph: ProjectUxGraph): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const policies = graph.contract.policies;
  const initialIds = initialStateIds(graph);
  const initialSet = new Set(initialIds);

  // ux.nonterminal-state-without-exit
  if (policies.requireBackOrExitFromNonTerminalState) {
    for (const state of graph.states) {
      if (!state.isTerminal && state.outgoingTransitionIds.length === 0) {
        findings.push(makeFinding({
          ruleId: 'ux.nonterminal-state-without-exit',
          category: 'recovery',
          severity: 'error',
          message: `State "${state.title}" (${state.stateId}) is not terminal but has no outgoing transition — a dead end for the operator.`,
          affected: { stateIds: [state.stateId] },
          remediation: 'Add a back/exit/next transition, or mark the state terminal if it is intentionally final.'
        }));
      }
    }
  }

  // ux.error-state-without-recovery
  if (policies.requireErrorRecoveryPath) {
    for (const state of graph.states) {
      if (state.role !== 'error') continue;
      const reachesInitial = hasPathTo(graph, state.stateId, initialSet);
      const declaredRecoveryOk = state.meta.recoveryStateId
        ? hasPathTo(graph, state.stateId, new Set([state.meta.recoveryStateId]))
        : false;
      if (!reachesInitial && !declaredRecoveryOk) {
        findings.push(makeFinding({
          ruleId: 'ux.error-state-without-recovery',
          category: 'recovery',
          severity: 'error',
          message: `Error state "${state.title}" (${state.stateId}) has no path back to an initial/navigation state or a declared recovery state.`,
          affected: { stateIds: [state.stateId] },
          remediation: 'Add a transition (e.g. Retry/Back) leading out of this error state, or declare states[id].recoveryStateId in the UX contract.'
        }));
      }
    }

    // ux.warning-state-without-safe-action
    for (const state of graph.states) {
      if (state.role === 'warning' && state.outgoingTransitionIds.length === 0) {
        findings.push(makeFinding({
          ruleId: 'ux.warning-state-without-safe-action',
          category: 'recovery',
          severity: 'warning',
          message: `Warning state "${state.title}" (${state.stateId}) offers no action for the operator to continue safely.`,
          affected: { stateIds: [state.stateId] },
          remediation: 'Add an acknowledge/continue/back transition from this warning state.'
        }));
      }
    }
  }

  // ux.result-state-without-next-action
  if (policies.requireBackOrExitFromNonTerminalState) {
    for (const state of graph.states) {
      if (state.role === 'result' && !state.isTerminal && state.outgoingTransitionIds.length === 0) {
        findings.push(makeFinding({
          ruleId: 'ux.result-state-without-next-action',
          category: 'recovery',
          severity: 'warning',
          message: `Result state "${state.title}" (${state.stateId}) has no next action (save/export/return to menu).`,
          affected: { stateIds: [state.stateId] },
          remediation: 'Add a transition for the operator to act on or leave the result screen.'
        }));
      }
    }
  }

  // ux.progress-state-without-cancel-or-status
  if (policies.requireProgressFeedbackForLongRunningOperations) {
    for (const state of graph.states) {
      if (state.role !== 'progress') continue;
      const hasCancelControl = state.outgoingTransitionIds.some((id) => {
        const transition = graph.transitionsById.get(id);
        const control = transition?.triggerControlId ? graph.controlsById.get(transition.triggerControlId) : undefined;
        return control?.actionKind === 'cancel' || control?.actionKind === 'stop';
      });
      const screen = state.screenId ? graph.screensById.get(state.screenId) : undefined;
      const hasStatusInfo = Boolean(state.meta.purpose || screen?.meta.operatorHint);
      if (!hasCancelControl && !hasStatusInfo) {
        findings.push(makeFinding({
          ruleId: 'ux.progress-state-without-cancel-or-status',
          category: 'behavior',
          severity: 'warning',
          message: `Progress state "${state.title}" (${state.stateId}) has neither a cancel/stop control nor declared status information.`,
          affected: { stateIds: [state.stateId] },
          remediation: 'Add a cancel/stop control, or document the expected progress feedback in states[id].purpose/operatorHint.'
        }));
      }
    }
  }

  // ux.back-intent-does-not-return-to-logical-context
  for (const transition of graph.transitions) {
    const control = transition.triggerControlId ? graph.controlsById.get(transition.triggerControlId) : undefined;
    if (control?.actionKind !== 'back') continue;
    if (!hasPathTo(graph, transition.to, new Set([transition.from]))) {
      findings.push(makeFinding({
        ruleId: 'ux.back-intent-does-not-return-to-logical-context',
        category: 'behavior',
        severity: 'warning',
        message: `"Back" transition ${transition.transitionId} moves to ${transition.to}, which has no path back to its origin ${transition.from} — likely not the logical previous screen.`,
        affected: { transitionIds: [transition.transitionId] },
        remediation: 'Point the back control at the state the operator actually came from.'
      }));
    }
  }

  // ux.unintended-navigation-loop
  for (const cycle of findCycles(graph)) {
    const justified = cycle.some((stateId) =>
      (graph.statesById.get(stateId)?.outgoingTransitionIds ?? []).some((tid) => graph.transitionsById.get(tid)?.meta.rationale)
    );
    if (!justified) {
      findings.push(makeFinding({
        ruleId: 'ux.unintended-navigation-loop',
        category: 'behavior',
        severity: 'suggestion',
        message: `States ${cycle.join(', ')} form a navigation cycle with no documented rationale on any edge.`,
        affected: { stateIds: cycle },
        remediation: 'Confirm the loop is intentional (e.g. retry flow) and document it via a transition rationale, or break the cycle.'
      }));
    }
  }

  // ux.orphan-state
  const reachable = forwardReachable(graph, initialIds);
  for (const state of graph.states) {
    if (!reachable.has(state.stateId)) {
      findings.push(makeFinding({
        ruleId: 'ux.orphan-state',
        category: 'structure',
        severity: 'error',
        message: `State "${state.title}" (${state.stateId}) is unreachable from any initial state.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Add a transition into this state from the reachable graph, or delete it.'
      }));
    }
  }

  // ux.goal-has-no-success-path
  for (const goal of graph.goals) {
    const successIds = goal.successStateIds ?? [];
    const startIds = goal.startStateIds ?? [];
    if (successIds.length === 0 || startIds.length === 0) continue;
    const successSet = new Set(successIds);
    const unreachableStarts = startIds.filter((startId) => !hasPathTo(graph, startId, successSet));
    if (unreachableStarts.length > 0) {
      findings.push(makeFinding({
        ruleId: 'ux.goal-has-no-success-path',
        category: 'behavior',
        severity: 'error',
        message: `Goal "${goal.title}" (${goal.id}) has no path from start state(s) ${unreachableStarts.join(', ')} to any declared success state.`,
        affected: { goalIds: [goal.id], stateIds: unreachableStarts },
        remediation: 'Add the missing transitions, or correct the goal\'s start/success state ids.'
      }));
    }
  }

  return findings;
}

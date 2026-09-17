/** Category D — safety rules. */
import type { ProjectUxGraph } from '../uxGraphBuilder';
import { forwardReachable, hasPathTo, reverseReachable } from '../uxGraphAlgorithms';
import { makeFinding, type UxValidationFinding } from '../uxTypes';
import { availableIntentsOnState } from './semanticsRules';

const RISKY_LEVELS = new Set(['destructive', 'critical']);

export function evaluateSafetyRules(graph: ProjectUxGraph): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const policies = graph.contract.policies;

  // ux.destructive-action-without-confirmation
  if (policies.requireConfirmationForDestructiveActions) {
    for (const transition of graph.transitions) {
      if (RISKY_LEVELS.has(transition.riskLevel) && !transition.requiresConfirmation && !transition.meta.confirmationStateId) {
        findings.push(makeFinding({
          ruleId: 'ux.destructive-action-without-confirmation',
          category: 'safety',
          severity: 'error',
          message: `Transition ${transition.transitionId} is marked "${transition.riskLevel}" but has no confirmation step.`,
          affected: { transitionIds: [transition.transitionId] },
          remediation: 'Set transitions[id].requiresConfirmation and route through a confirmation state, or lower the declared risk level.'
        }));
      }
    }
    for (const control of graph.controls) {
      if (RISKY_LEVELS.has(control.riskLevel) && !control.requiresConfirmation) {
        findings.push(makeFinding({
          ruleId: 'ux.destructive-action-without-confirmation',
          category: 'safety',
          severity: 'error',
          message: `Control "${control.label}" (${control.controlId}) is marked "${control.riskLevel}" but has no confirmation requirement.`,
          affected: { controlIds: [control.controlId] },
          remediation: 'Set controls[id].requiresConfirmation, or lower the declared risk level.'
        }));
      }
    }
  }

  // ux.critical-transition-without-rationale
  for (const transition of graph.transitions) {
    if (transition.riskLevel === 'critical' && !transition.meta.rationale) {
      findings.push(makeFinding({
        ruleId: 'ux.critical-transition-without-rationale',
        category: 'safety',
        severity: 'warning',
        message: `Critical transition ${transition.transitionId} has no documented rationale.`,
        affected: { transitionIds: [transition.transitionId] },
        remediation: 'Set transitions[id].rationale explaining why this transition is safety-critical.'
      }));
    }
  }

  // ux.error-state-missing-user-guidance
  for (const state of graph.states) {
    if (state.role !== 'error') continue;
    const screen = state.screenId ? graph.screensById.get(state.screenId) : undefined;
    const hasGuidance = Boolean(state.meta.purpose) || Boolean(screen?.hasVisibleText);
    if (!hasGuidance) {
      findings.push(makeFinding({
        ruleId: 'ux.error-state-missing-user-guidance',
        category: 'safety',
        severity: 'warning',
        message: `Error state "${state.title}" (${state.stateId}) has no visible explanatory text and no declared purpose.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Add explanatory text to the bound screen, or set states[id].purpose.'
      }));
    }
  }

  // ux.recovery-action-not-reachable
  for (const state of graph.states) {
    const target = state.meta.recoveryStateId;
    if (target && !hasPathTo(graph, state.stateId, new Set([target]))) {
      findings.push(makeFinding({
        ruleId: 'ux.recovery-action-not-reachable',
        category: 'safety',
        severity: 'error',
        message: `State "${state.title}" (${state.stateId}) declares recoveryStateId ${target}, but no transition path reaches it.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Add the missing transition(s), or correct recoveryStateId.'
      }));
    }
  }

  // ux.cancel-flow-loses-user-context — cancelling should never dump the operator into an error screen.
  for (const transition of graph.transitions) {
    const control = transition.triggerControlId ? graph.controlsById.get(transition.triggerControlId) : undefined;
    if (control?.actionKind !== 'cancel') continue;
    const targetState = graph.statesById.get(transition.to);
    if (targetState?.role === 'error') {
      findings.push(makeFinding({
        ruleId: 'ux.cancel-flow-loses-user-context',
        category: 'safety',
        severity: 'error',
        message: `Cancel transition ${transition.transitionId} leads to error state "${targetState.title}" (${targetState.stateId}) instead of a safe prior context.`,
        affected: { transitionIds: [transition.transitionId], stateIds: [targetState.stateId] },
        remediation: 'Route cancel to a neutral/navigation state rather than an error state.'
      }));
    }
  }

  // ux.operation-start-without-required-precondition
  for (const goal of graph.goals) {
    const requiredIntents = goal.requiredIntents ?? [];
    const startIds = goal.startStateIds ?? [];
    const successIds = goal.successStateIds ?? [];
    if (requiredIntents.length === 0 || startIds.length === 0 || successIds.length === 0) continue;
    const between = intersect(forwardReachable(graph, startIds), reverseReachable(graph, successIds));
    const availableIntents = new Set<string>();
    for (const stateId of between) {
      for (const intent of availableIntentsOnState(graph, stateId)) availableIntents.add(intent);
    }
    const missing = requiredIntents.filter((intent) => !availableIntents.has(intent));
    if (missing.length > 0) {
      findings.push(makeFinding({
        ruleId: 'ux.operation-start-without-required-precondition',
        category: 'safety',
        severity: 'error',
        message: `Goal "${goal.title}" (${goal.id}) requires intent(s) ${missing.join(', ')} on its path, but none is represented by any state, control or transition between start and success.`,
        affected: { goalIds: [goal.id] },
        remediation: 'Add a control/transition providing the missing precondition, or correct goal.requiredIntents.'
      }));
    }
  }

  // ux.failure-path-not-modeled
  for (const goal of graph.goals) {
    const isRisky = goal.criticality === 'destructive' || goal.criticality === 'critical';
    if (isRisky && (!goal.failureStateIds || goal.failureStateIds.length === 0)) {
      findings.push(makeFinding({
        ruleId: 'ux.failure-path-not-modeled',
        category: 'safety',
        severity: 'warning',
        message: `Goal "${goal.title}" (${goal.id}) is marked "${goal.criticality}" but declares no failure state(s).`,
        affected: { goalIds: [goal.id] },
        remediation: 'Set goal.failureStateIds to the state(s) reached when this goal fails.'
      }));
    }
  }

  return findings;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((id) => b.has(id)));
}

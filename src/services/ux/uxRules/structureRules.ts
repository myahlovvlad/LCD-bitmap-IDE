/** Category A — structure and binding rules. */
import type { ProjectUxGraph } from '../uxGraphBuilder';
import { forwardReachable, initialStateIds } from '../uxGraphAlgorithms';
import { makeFinding, type UxValidationFinding } from '../uxTypes';

export function evaluateStructureRules(graph: ProjectUxGraph): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const policies = graph.contract.policies;

  // ux.screen-state-binding-missing — state has no bound screen.
  for (const state of graph.states) {
    if (!state.screenId) {
      findings.push(makeFinding({
        ruleId: 'ux.screen-state-binding-missing',
        category: 'structure',
        severity: 'warning',
        message: `State "${state.title}" (${state.stateId}) has no bound LCD screen.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Bind the state to an LCD screen so the operator sees UI while in this state.'
      }));
    }
  }

  // ux.state-screen-binding-invalid — state references a screen id that does not exist.
  for (const state of graph.states) {
    if (state.screenId && !graph.screensById.has(state.screenId)) {
      findings.push(makeFinding({
        ruleId: 'ux.state-screen-binding-invalid',
        category: 'structure',
        severity: 'error',
        message: `State "${state.title}" (${state.stateId}) references missing screen ${state.screenId}.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Re-bind the state to an existing screen or remove the dangling reference.'
      }));
    }
  }

  // ux.user-transition-without-visible-trigger
  if (policies.requireVisibleTriggerForUserInitiatedTransitions) {
    for (const transition of graph.transitions) {
      if (transition.mechanism === 'button' && transition.linkedControlIds.length === 0) {
        findings.push(makeFinding({
          ruleId: 'ux.user-transition-without-visible-trigger',
          category: 'structure',
          severity: 'error',
          message: `Transition ${transition.transitionId} is button-triggered but no control panel button fires event ${transition.eventId}.`,
          affected: { transitionIds: [transition.transitionId] },
          remediation: 'Bind a control-panel button to this event, or change the transition trigger mechanism.'
        }));
      } else if (transition.mechanism === 'event' && transition.intent && transition.linkedControlIds.length === 0) {
        findings.push(makeFinding({
          ruleId: 'ux.user-transition-without-visible-trigger',
          category: 'structure',
          severity: 'warning',
          message: `Transition ${transition.transitionId} declares intent "${transition.intent}" but has no visible control firing event ${transition.eventId}.`,
          affected: { transitionIds: [transition.transitionId] },
          remediation: 'Bind a control-panel button to this event, or document how the operator triggers it.'
        }));
      }
    }
  }

  // ux.visible-control-without-intent
  if (policies.requireIntentForInteractiveControls) {
    for (const control of graph.controls) {
      if (!control.intent) {
        findings.push(makeFinding({
          ruleId: 'ux.visible-control-without-intent',
          category: 'structure',
          severity: policies.treatUnclassifiedInteractiveControlsAsWarning ? 'warning' : 'suggestion',
          message: `Control "${control.label}" (${control.controlId}) has no declared UX intent.`,
          affected: { controlIds: [control.controlId] },
          remediation: 'Set controls[id].intent in the UX contract to describe what this control means to the operator.'
        }));
      }
    }
  }

  // ux.transition-intent-mismatch-with-control
  for (const transition of graph.transitions) {
    if (!transition.intent || !transition.triggerControlId) continue;
    const control = graph.controlsById.get(transition.triggerControlId);
    if (control?.intent && control.intent !== transition.intent) {
      findings.push(makeFinding({
        ruleId: 'ux.transition-intent-mismatch-with-control',
        category: 'semantics',
        severity: 'warning',
        message: `Transition ${transition.transitionId} declares intent "${transition.intent}" but its trigger control "${control.label}" declares intent "${control.intent}".`,
        affected: { transitionIds: [transition.transitionId], controlIds: [control.controlId] },
        remediation: 'Align the transition intent and the control intent, or split them into two distinct controls.'
      }));
    }
  }

  // ux.control-event-missing-transition
  for (const control of graph.controls) {
    if (control.fsmEventId && control.linkedTransitionIds.length === 0) {
      findings.push(makeFinding({
        ruleId: 'ux.control-event-missing-transition',
        category: 'structure',
        severity: 'error',
        message: `Control "${control.label}" (${control.controlId}) fires event ${control.fsmEventId}, but no FSM transition listens for it.`,
        affected: { controlIds: [control.controlId] },
        remediation: 'Add a transition triggered by this event, or remove the dead control binding.'
      }));
    }
  }

  // ux.transition-to-unreachable-state — flags transitions whose source state cannot be reached.
  // Overlay states (e.g. hardware-presence notifications) are exempt: they are legitimately
  // reached through a runtime mechanism other than FSM transitions.
  const reachable = forwardReachable(graph, initialStateIds(graph));
  for (const transition of graph.transitions) {
    if (graph.statesById.get(transition.from)?.isOverlay) continue;
    if (!reachable.has(transition.from)) {
      findings.push(makeFinding({
        ruleId: 'ux.transition-to-unreachable-state',
        category: 'structure',
        severity: 'warning',
        message: `Transition ${transition.transitionId} originates from state ${transition.from}, which is unreachable from any initial state.`,
        affected: { transitionIds: [transition.transitionId], stateIds: [transition.from] },
        remediation: 'Connect the source state to the reachable graph, or delete the dead transition.'
      }));
    }
  }

  return findings;
}

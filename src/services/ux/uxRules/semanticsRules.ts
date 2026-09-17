/** Category C — semantics and terminology rules. */
import type { ProjectUxGraph } from '../uxGraphBuilder';
import { controlsAvailableOnState } from '../uxGraphAlgorithms';
import { makeFinding, type UxValidationFinding } from '../uxTypes';

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/** Intents effectively available while `stateId` is active: controls usable in that state, plus
 *  outgoing-transition intents (an intent can be represented purely by FSM behavior too). Also
 *  used by safetyRules for precondition-coverage analysis. */
export function availableIntentsOnState(graph: ProjectUxGraph, stateId: string): Set<string> {
  const intents = new Set<string>();
  for (const control of controlsAvailableOnState(graph, stateId)) {
    if (control.intent) intents.add(control.intent);
  }
  const state = graph.statesById.get(stateId);
  for (const transitionId of state?.outgoingTransitionIds ?? []) {
    const intent = graph.transitionsById.get(transitionId)?.intent;
    if (intent) intents.add(intent);
  }
  return intents;
}

export function evaluateSemanticsRules(graph: ProjectUxGraph): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const policies = graph.contract.policies;

  // ux.screen-missing-role
  for (const screen of graph.screens) {
    if (screen.role === 'unknown') {
      findings.push(makeFinding({
        ruleId: 'ux.screen-missing-role',
        category: 'semantics',
        severity: 'warning',
        message: `Screen "${screen.name}" (${screen.screenId}) has no declared UX role.`,
        affected: { screenIds: [screen.screenId] },
        remediation: 'Set screens[id].role in the UX contract (navigation, operation, progress, result, error, ...).'
      }));
    }
  }

  // ux.state-missing-purpose
  for (const state of graph.states) {
    if (!state.meta.purpose) {
      findings.push(makeFinding({
        ruleId: 'ux.state-missing-purpose',
        category: 'semantics',
        severity: 'warning',
        message: `State "${state.title}" (${state.stateId}) has no declared purpose.`,
        affected: { stateIds: [state.stateId] },
        remediation: 'Set states[id].purpose in the UX contract.'
      }));
    }
  }

  // ux.transition-missing-intent — only for transitions with a visible trigger (user-facing).
  for (const transition of graph.transitions) {
    if (transition.triggerControlId && !transition.intent) {
      findings.push(makeFinding({
        ruleId: 'ux.transition-missing-intent',
        category: 'semantics',
        severity: 'warning',
        message: `Transition ${transition.transitionId} has a visible trigger control but no declared intent.`,
        affected: { transitionIds: [transition.transitionId] },
        remediation: 'Set transitions[id].intent in the UX contract.'
      }));
    }
  }

  if (policies.requireTerminologyConsistency) {
    const locale = policies.defaultLocale;

    // ux.intent-label-inconsistent / ux.intent-uses-forbidden-label
    for (const entry of graph.contract.terminology) {
      const usages = graph.intents.get(entry.intent) ?? [];
      const preferred = entry.preferredLabels[locale];
      const forbidden = new Set((entry.forbiddenLabels?.[locale] ?? []).map(normalizeLabel));
      for (const usage of usages) {
        if (!usage.label) continue;
        if (forbidden.has(normalizeLabel(usage.label))) {
          findings.push(makeFinding({
            ruleId: 'ux.intent-uses-forbidden-label',
            category: 'terminology',
            severity: 'warning',
            message: `${usage.kind} ${usage.id} uses label "${usage.label}", which is forbidden for intent "${entry.intent}".`,
            affected: usage.kind === 'control' ? { controlIds: [usage.id] } : { transitionIds: [usage.id] },
            remediation: preferred ? `Use the preferred label "${preferred}" instead.` : 'Use an approved label for this intent.'
          }));
        } else if (preferred && normalizeLabel(usage.label) !== normalizeLabel(preferred)) {
          findings.push(makeFinding({
            ruleId: 'ux.intent-label-inconsistent',
            category: 'terminology',
            severity: 'warning',
            message: `${usage.kind} ${usage.id} uses label "${usage.label}" for intent "${entry.intent}", but the preferred label is "${preferred}".`,
            affected: usage.kind === 'control' ? { controlIds: [usage.id] } : { transitionIds: [usage.id] },
            remediation: `Rename to "${preferred}" or update terminology[].preferredLabels if this label should be preferred.`
          }));
        }
      }
    }

    // ux.same-label-different-intent
    const byLabel = new Map<string, { id: string; kind: 'control' | 'transition'; intent: string }[]>();
    const collect = (id: string, kind: 'control' | 'transition', label: string | undefined, intent: string | undefined) => {
      if (!label || !intent) return;
      const key = normalizeLabel(label);
      byLabel.set(key, [...(byLabel.get(key) ?? []), { id, kind, intent }]);
    };
    for (const control of graph.controls) collect(control.controlId, 'control', control.label, control.intent);
    for (const transition of graph.transitions) {
      const control = transition.triggerControlId ? graph.controlsById.get(transition.triggerControlId) : undefined;
      collect(transition.transitionId, 'transition', control?.label, transition.intent);
    }
    for (const [label, usages] of byLabel) {
      const distinctIntents = new Set(usages.map((u) => u.intent));
      if (distinctIntents.size > 1) {
        findings.push(makeFinding({
          ruleId: 'ux.same-label-different-intent',
          category: 'terminology',
          severity: 'warning',
          message: `Label "${label}" is used for ${distinctIntents.size} different intents: ${[...distinctIntents].join(', ')}.`,
          affected: {
            controlIds: usages.filter((u) => u.kind === 'control').map((u) => u.id),
            transitionIds: usages.filter((u) => u.kind === 'transition').map((u) => u.id)
          },
          remediation: 'Use distinct labels for distinct intents, or unify the intent if they truly mean the same thing.'
        }));
      }
    }
  }

  // ux.prohibited-action-present-on-screen / ux.expected-action-missing-on-screen / ux.primary-action-not-available
  for (const screen of graph.screens) {
    if (screen.stateIds.length === 0) continue;
    const availableOnAnyState = new Set<string>();
    for (const stateId of screen.stateIds) {
      for (const intent of availableIntentsOnState(graph, stateId)) availableOnAnyState.add(intent);
    }

    for (const intent of screen.meta.prohibitedActionIntents ?? []) {
      if (availableOnAnyState.has(intent)) {
        findings.push(makeFinding({
          ruleId: 'ux.prohibited-action-present-on-screen',
          category: 'semantics',
          severity: 'error',
          message: `Screen "${screen.name}" (${screen.screenId}) exposes intent "${intent}", which is explicitly prohibited on this screen.`,
          affected: { screenIds: [screen.screenId] },
          remediation: 'Remove or disable the control/transition exposing this intent while on this screen.'
        }));
      }
    }

    for (const intent of screen.meta.expectedActionIntents ?? []) {
      if (!availableOnAnyState.has(intent)) {
        findings.push(makeFinding({
          ruleId: 'ux.expected-action-missing-on-screen',
          category: 'semantics',
          severity: 'warning',
          message: `Screen "${screen.name}" (${screen.screenId}) declares expected intent "${intent}", but no available control/transition provides it.`,
          affected: { screenIds: [screen.screenId] },
          remediation: 'Add a control or transition that provides this intent, or remove it from expectedActionIntents.'
        }));
      }
    }

    if (screen.meta.primaryActionIntent && !availableOnAnyState.has(screen.meta.primaryActionIntent)) {
      findings.push(makeFinding({
        ruleId: 'ux.primary-action-not-available',
        category: 'semantics',
        severity: 'error',
        message: `Screen "${screen.name}" (${screen.screenId}) declares primary action intent "${screen.meta.primaryActionIntent}", but it is not available from any bound state.`,
        affected: { screenIds: [screen.screenId] },
        remediation: 'Add a control or transition providing this intent, or correct primaryActionIntent.'
      }));
    }
  }

  return findings;
}

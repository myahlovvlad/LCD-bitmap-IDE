/** Category E — scenario execution and traceability rules. Consumes already-executed scenario
 *  results (Part D); never runs simulation itself. */
import type { ProjectUxGraph } from '../uxGraphBuilder';
import type { UxScenarioResult } from '../uxScenarioRunner';
import { makeFinding, type UxValidationFinding } from '../uxTypes';

export function evaluateScenarioRules(graph: ProjectUxGraph, scenarioResults: readonly UxScenarioResult[]): UxValidationFinding[] {
  const findings: UxValidationFinding[] = [];
  const policies = graph.contract.policies;
  const resultsByScenarioId = new Map(scenarioResults.map((r) => [r.scenarioId, r]));

  // ux.critical-goal-without-scenario
  if (policies.requireScenarioForCriticalGoals) {
    for (const goal of graph.goals) {
      const isCritical = goal.criticality === 'destructive' || goal.criticality === 'critical';
      if (!isCritical) continue;
      const hasScenario = graph.scenarios.some((s) => s.goalId === goal.id);
      if (!hasScenario) {
        findings.push(makeFinding({
          ruleId: 'ux.critical-goal-without-scenario',
          category: 'traceability',
          severity: 'error',
          message: `Goal "${goal.title}" (${goal.id}) is marked "${goal.criticality}" but has no scripted UX scenario verifying it.`,
          affected: { goalIds: [goal.id] },
          remediation: 'Add a UxScenarioDefinition with goalId set to this goal and run it via run_project_ux_scenario.'
        }));
      }
    }
  }

  for (const scenario of graph.scenarios) {
    const result = resultsByScenarioId.get(scenario.id);
    if (!result) continue;
    const severity = scenario.severityOnFailure ?? 'error';

    // ux.scenario-blocked-step
    for (const blocked of result.blockedSteps) {
      findings.push(makeFinding({
        ruleId: 'ux.scenario-blocked-step',
        category: 'scenario',
        severity,
        message: `Scenario "${scenario.title}" (${scenario.id}) step ${blocked.index} was blocked: ${blocked.reason ?? 'unknown reason'}.`,
        affected: { scenarioIds: [scenario.id], goalIds: scenario.goalId ? [scenario.goalId] : undefined },
        evidence: { stepIndex: blocked.index, trace: result.trace.steps[blocked.index] }
      }));
    }

    // ux.scenario-unexpected-final-state
    if (result.finalStateMismatch) {
      findings.push(makeFinding({
        ruleId: 'ux.scenario-unexpected-final-state',
        category: 'scenario',
        severity,
        message: `Scenario "${scenario.title}" (${scenario.id}) expected final state ${result.finalStateMismatch.expected}, got ${result.finalStateMismatch.actual ?? 'null'}.`,
        affected: { scenarioIds: [scenario.id], goalIds: scenario.goalId ? [scenario.goalId] : undefined },
        evidence: { finalStateMismatch: result.finalStateMismatch }
      }));
    }

    // ux.scenario-transition-mismatch
    for (const mismatch of result.stepMismatches) {
      findings.push(makeFinding({
        ruleId: 'ux.scenario-transition-mismatch',
        category: 'scenario',
        severity: scenario.severityOnFailure ?? 'warning',
        message: `Scenario "${scenario.title}" (${scenario.id}) step ${mismatch.index} expected state ${mismatch.expectedStateId}, got ${mismatch.actualStateId ?? 'null'}.`,
        affected: { scenarioIds: [scenario.id], goalIds: scenario.goalId ? [scenario.goalId] : undefined },
        evidence: { stepIndex: mismatch.index, mismatch }
      }));
    }

    if (result.missingRequiredMessages.length > 0) {
      findings.push(makeFinding({
        ruleId: 'ux.scenario-blocked-step',
        category: 'scenario',
        severity,
        message: `Scenario "${scenario.title}" (${scenario.id}) never showed required message(s): ${result.missingRequiredMessages.join(', ')}.`,
        affected: { scenarioIds: [scenario.id], goalIds: scenario.goalId ? [scenario.goalId] : undefined },
        evidence: { missingRequiredMessages: result.missingRequiredMessages }
      }));
    }
  }

  // ux.requirement-goal-not-covered-by-state-or-scenario
  for (const goal of graph.goals) {
    const referencedByState = graph.states.some((s) => (s.meta.userGoalIds ?? []).includes(goal.id));
    const referencedByScreen = graph.screens.some((s) => (s.meta.userGoalIds ?? []).includes(goal.id));
    const referencedByScenario = graph.scenarios.some((s) => s.goalId === goal.id);
    if (!referencedByState && !referencedByScreen && !referencedByScenario) {
      findings.push(makeFinding({
        ruleId: 'ux.requirement-goal-not-covered-by-state-or-scenario',
        category: 'traceability',
        severity: 'warning',
        message: `Goal "${goal.title}" (${goal.id}) is not referenced by any state, screen, or scenario.`,
        affected: { goalIds: [goal.id] },
        remediation: 'Reference this goal from the states/screens that serve it, or add a scenario covering it.'
      }));
    }
  }

  return findings;
}

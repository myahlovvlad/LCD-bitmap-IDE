/**
 * Runs a UX scenario (Part D of the UX validation spec) by delegating entirely to the existing
 * headless runFsmScenario() — no reimplementation of simulation. Always builds a fresh engine
 * from a project snapshot, so the caller's open project/session is never mutated.
 */
import type { LcdBitmapProject } from '../../domain/project';
import type { UxScenarioDefinition } from '../../domain/uxContract';
import { runFsmScenario, type FsmScenarioResult, type FsmScenarioStep } from '../runtime/fsmScenarioRunner';

export interface UxScenarioResult {
  scenarioId: string;
  goalId?: string;
  initialStateId: string | null;
  finalStateId: string | null;
  passed: boolean;
  trace: FsmScenarioResult;
  blockedSteps: { index: number; reason?: string }[];
  stepMismatches: { index: number; expectedStateId: string; actualStateId: string | null }[];
  finalStateMismatch?: { expected: string; actual: string | null };
  missingRequiredMessages: string[];
}

export async function runUxScenario(project: LcdBitmapProject, scenario: UxScenarioDefinition): Promise<UxScenarioResult> {
  const steps: FsmScenarioStep[] = scenario.steps.map((step) => {
    if (step.type === 'event') return { type: 'event', eventId: step.eventId };
    if (step.type === 'button') return { type: 'button', buttonId: step.buttonId };
    return { type: 'tag', tagId: step.tagId, value: step.value };
  });

  const trace = await runFsmScenario(project, steps, { initialStateId: scenario.initialStateId });

  const blockedSteps = trace.steps
    .filter((step) => step.blocked)
    .map((step) => ({ index: step.index, reason: step.blockReason }));

  const stepMismatches: { index: number; expectedStateId: string; actualStateId: string | null }[] = [];
  scenario.steps.forEach((step, index) => {
    const expected = step.type !== 'tag' ? step.expectedStateId : undefined;
    const actual = trace.steps[index]?.stateIdAfter ?? null;
    if (expected && actual !== expected) {
      stepMismatches.push({ index, expectedStateId: expected, actualStateId: actual });
    }
  });

  const finalStateMismatch = scenario.expectedFinalStateId && trace.finalStateId !== scenario.expectedFinalStateId
    ? { expected: scenario.expectedFinalStateId, actual: trace.finalStateId }
    : undefined;

  const messages = trace.eventLog.map((entry) => entry.message);
  const missingRequiredMessages = (scenario.requiredVisibleMessages ?? []).filter(
    (required) => !messages.some((message) => message.includes(required))
  );

  const passed =
    blockedSteps.length === 0 &&
    stepMismatches.length === 0 &&
    !finalStateMismatch &&
    missingRequiredMessages.length === 0 &&
    !(scenario.expectNoBlockedSteps && blockedSteps.length > 0);

  return {
    scenarioId: scenario.id,
    goalId: scenario.goalId,
    initialStateId: trace.initialStateId,
    finalStateId: trace.finalStateId,
    passed,
    trace,
    blockedSteps,
    stepMismatches,
    finalStateMismatch,
    missingRequiredMessages
  };
}

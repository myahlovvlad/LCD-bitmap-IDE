import type { LcdBitmapProject } from '../../domain/project';
import type { RuntimeEvent } from '../runtimeEngine';
import type { HardwareNotification } from '../runtimeHardwareNotifications';
import type { TagValue } from './TagContext';
import { OrchestratedRuntimeEngine, type ProcedureStatus } from './orchestratedRuntimeEngine';
import { createInstantSimulation } from './SimulationTransport';
import { Ecros5501SimulationTransport } from '../../spectrophotometer';

/**
 * Headless FSM scenario runner — drives a fresh OrchestratedRuntimeEngine
 * instance built from a project snapshot, independent of whether the
 * RuntimeWorkspace UI is mounted. Lets a caller (an MCP/automation tool, a
 * test) script a sequence of events/button presses/tag writes and get back a
 * deterministic per-step trace, to verify an FSM graph behaves as intended
 * without a human driving the simulator by hand.
 *
 * Uses createInstantSimulation() (zero-delay transport) so a scenario with
 * backend-procedure transitions resolves immediately instead of waiting out
 * simulated instrument timings.
 */

export type FsmScenarioStep =
  | { type: 'event'; eventId: string }
  | { type: 'button'; buttonId: string }
  | { type: 'tag'; tagId: string; value: TagValue };

export interface FsmScenarioStepResult {
  index: number;
  step: FsmScenarioStep;
  stateIdBefore: string | null;
  stateIdAfter: string | null;
  transitionId: string | null;
  procedureStatus: ProcedureStatus;
  blocked: boolean;
  blockReason?: string;
}

export interface FsmScenarioOptions {
  initialStateId?: string;
  bypassProcedures?: boolean;
}

export interface FsmScenarioResult {
  initialStateId: string | null;
  finalStateId: string | null;
  steps: FsmScenarioStepResult[];
  eventLog: readonly RuntimeEvent[];
  hardwareNotification: HardwareNotification | null;
  tags: Record<string, TagValue>;
}

function hasEventTransition(project: LcdBitmapProject, fromStateId: string | null, eventId: string): boolean {
  if (!fromStateId) return false;
  return project.fsm.transitionOrder.some((id) => {
    const transition = project.fsm.transitions[id];
    return transition?.from === fromStateId && transition.trigger.eventId === eventId;
  });
}

export async function runFsmScenario(
  project: LcdBitmapProject,
  steps: readonly FsmScenarioStep[],
  options: FsmScenarioOptions = {}
): Promise<FsmScenarioResult> {
  const transport = project.dataSources?.['ecros.cli']
    ? new Ecros5501SimulationTransport({ startConnected: true })
    : createInstantSimulation(project.cliCatalog ?? {});
  const engine = new OrchestratedRuntimeEngine(project, {
    transport,
    bypassProcedures: options.bypassProcedures ?? false
  });
  engine.start(options.initialStateId);
  const initialStateId = engine.currentStateId;

  const stepResults: FsmScenarioStepResult[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const stateIdBefore = engine.currentStateId;
    let blocked = false;
    let blockReason: string | undefined;

    if (step.type === 'event') {
      if (!hasEventTransition(project, stateIdBefore, step.eventId)) {
        blocked = true;
        blockReason = `No transition from state "${stateIdBefore ?? 'null'}" for event "${step.eventId}".`;
      } else {
        await engine.sendEventAsync(step.eventId);
      }
    } else if (step.type === 'button') {
      const element = project.controlPanel.elements[step.buttonId];
      if (!element || element.type !== 'button') {
        blocked = true;
        blockReason = `Unknown control-panel button "${step.buttonId}".`;
      } else if (!engine.isButtonAllowed(element)) {
        blocked = true;
        blockReason = engine.getButtonBlockReason(element) ?? 'Button is not available in the current state.';
      } else {
        await engine.pressButtonAsync(step.buttonId);
      }
    } else {
      engine.tags.set(step.tagId, step.value);
      engine.refreshHardwareNotification();
    }

    stepResults.push({
      index,
      step,
      stateIdBefore,
      stateIdAfter: engine.currentStateId,
      transitionId: engine.lastTransition?.id ?? null,
      procedureStatus: engine.procedureStatus,
      blocked,
      blockReason
    });
  }

  return {
    initialStateId,
    finalStateId: engine.currentStateId,
    steps: stepResults,
    eventLog: engine.eventLog,
    hardwareNotification: engine.hardwareNotification,
    tags: engine.tags.snapshot()
  };
}

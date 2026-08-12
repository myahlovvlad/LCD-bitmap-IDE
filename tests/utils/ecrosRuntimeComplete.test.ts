import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ControlPanelButton, FsmTransition } from '../../src/domain/project';
import { migrateProject } from '../../src/services/projectMigrationService';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';

const PROJECT_FILE = resolve(process.cwd(), 'ECROS-5400UV', 'ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj');
const snapshot = migrateProject(JSON.parse(readFileSync(PROJECT_FILE, 'utf8')));
const project = snapshot.project;
const buttons = project.controlPanel.elementOrder
  .map((id) => project.controlPanel.elements[id])
  .filter((element): element is ControlPanelButton => element?.type === 'button' && element.visible);

function eventRoutes(): Array<{ from: string; eventId: string; routes: FsmTransition[] }> {
  const grouped = new Map<string, FsmTransition[]>();
  for (const transitionId of project.fsm.transitionOrder) {
    const transition = project.fsm.transitions[transitionId];
    if (!transition) continue;
    const key = `${transition.from}\u0000${transition.trigger.eventId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), transition]);
  }
  return [...grouped.entries()].map(([key, routes]) => {
    const [from, eventId] = key.split('\u0000');
    return { from, eventId, routes };
  });
}

function satisfyGuard(expression: string | null | undefined): Record<string, string | number | boolean | null> {
  if (!expression) return {};
  const match = expression.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) return { [expression]: true };
  const [, key, operator, raw] = match;
  const value = raw.trim().replace(/^['"]|['"]$/g, '');
  const expected: string | number | boolean = value === 'true' ? true : value === 'false' ? false : Number.isFinite(Number(value)) ? Number(value) : value;
  if (operator === '!=') return { [key]: typeof expected === 'boolean' ? !expected : '__different__' };
  if (operator === '>') return { [key]: Number(expected) + 1 };
  if (operator === '<') return { [key]: Number(expected) - 1 };
  return { [key]: expected };
}

describe('ECROS-5400UV runtime-complete project', () => {
  it('has a linked LCD screen for every FSM state and no dead transition endpoint', () => {
    expect(project.fsm.stateOrder).toHaveLength(299);
    expect(Object.keys(project.fsm.visibilityPresets ?? {})).toHaveLength(10);
    for (const stateId of project.fsm.stateOrder) {
      const state = project.fsm.states[stateId];
      expect(state, `missing state ${stateId}`).toBeTruthy();
      expect(state?.screenId, `state ${stateId} has no screen`).toBeTruthy();
      expect(state?.screenId && project.screens[state.screenId], `screen for ${stateId} is missing`).toBeTruthy();
    }
    for (const transitionId of project.fsm.transitionOrder) {
      const transition = project.fsm.transitions[transitionId];
      expect(project.fsm.states[transition.from], `missing source in ${transitionId}`).toBeTruthy();
      expect(project.fsm.states[transition.to], `missing target in ${transitionId}`).toBeTruthy();
    }
  });

  it('executes every programmed state/event route and opens its target screen', () => {
    const engine = createRuntimeEngine(project);
    const failures: string[] = [];
    const coverage = new Map<string, number>();

    const guardedFeedbackRoutes: string[] = [];
    for (const route of eventRoutes()) {
      const button = buttons.find((candidate) => candidate.fsmEventId === route.eventId);
      // These transitions intentionally require a device/alarm fact.  A
      // keyboard-only runtime must not force them through with invented data;
      // their evaluation belongs to the connected instrument simulation.
      if (!button && route.routes.every((candidate) => Boolean(candidate.condition || candidate.trigger.fact))) {
        guardedFeedbackRoutes.push(...route.routes.map((candidate) => candidate.id));
        continue;
      }
      engine.start(route.from);
      if (button) {
        if (!engine.isButtonAllowed(button)) {
          failures.push(`${route.from} + ${button.label} (${route.eventId}): button disabled`);
          continue;
        }
        engine.pressButton(button.id);
      } else {
        engine.sendEvent(route.eventId);
      }
      const completed = engine.lastTransition;
      if (!completed || completed.from !== route.from || completed.trigger.eventId !== route.eventId || !route.routes.some((candidate) => candidate.id === completed.id)) {
        failures.push(`${route.from} + ${route.eventId}: transition did not execute`);
        continue;
      }
      if (!engine.getCurrentScreen()) failures.push(`${completed.id}: target LCD screen is unavailable`);
      const subsystem = project.fsm.states[route.from]?.subsystem || 'unclassified';
      coverage.set(subsystem, (coverage.get(subsystem) ?? 0) + 1);
    }

    expect(failures, failures.join('\n')).toEqual([]);
    expect(guardedFeedbackRoutes).toHaveLength(16);
    for (const subsystem of ['photometry', 'quantitative', 'multiwave', 'kinetics', 'settings', 'files']) {
      expect(coverage.get(subsystem) ?? 0, `no executed route in ${subsystem}`).toBeGreaterThan(0);
    }
  });

  it('enables only controls which have an outgoing route in the current state', () => {
    const engine = createRuntimeEngine(project);
    for (const stateId of project.fsm.stateOrder) {
      engine.start(stateId);
      for (const button of buttons) {
        const hasRoute = project.fsm.transitionOrder.some((transitionId) => {
          const transition = project.fsm.transitions[transitionId];
          return transition?.from === stateId && transition.trigger.eventId === button.fsmEventId;
        });
        const explicitlyDisabled = button.disabledStates?.includes(stateId) ?? false;
        const stateAllowed = !button.allowedStates?.length || button.allowedStates.includes(stateId);
        expect(engine.isButtonAllowed(button), `${stateId}: ${button.label}`).toBe(hasRoute && stateAllowed && !explicitlyDisabled);
      }
    }
  });

  it('executes every SYS.ERR route when its declared alarm tag is injected', () => {
    const faultTransitions = project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((transition): transition is FsmTransition => transition?.trigger.eventId === 'SYS.ERR');
    const failures: string[] = [];

    for (const transition of faultTransitions) {
      const tags = satisfyGuard(transition.condition ?? transition.trigger.fact);
      const engine = createRuntimeEngine(project, { getGuardValues: () => tags });
      engine.start(transition.from);
      engine.sendEvent('SYS.ERR');
      if (engine.lastTransition?.id !== transition.id || !engine.getCurrentScreen()) {
        failures.push(`${transition.id}: ${engine.lastTransition?.id ?? 'no transition'}`);
      }
    }

    expect(faultTransitions).toHaveLength(16);
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

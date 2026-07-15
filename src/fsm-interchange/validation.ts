import type { FsmInterchangeModelV1, FsmParseDiagnostic } from './types';
import { parseGuardCondition } from '../fsm-behavior';

export function validateFsmInterchange(model: FsmInterchangeModelV1): readonly FsmParseDiagnostic[] {
  const diagnostics: FsmParseDiagnostic[] = [];
  const stateIds = new Set<string>();
  const eventIds = new Set<string>();
  const transitionIds = new Set<string>();

  for (const state of model.states) {
    if (!isSafeId(state.id)) {
      diagnostics.push(error('fsm.state.invalid-id', `Invalid state id: ${state.id}`));
    }
    if (stateIds.has(state.id)) {
      diagnostics.push(error('fsm.state.duplicate-id', `Duplicate state id: ${state.id}`));
    }
    stateIds.add(state.id);
  }

  for (const event of model.events) {
    if (!isSafeId(event.id)) {
      diagnostics.push(error('fsm.event.invalid-id', `Invalid event id: ${event.id}`));
    }
    if (eventIds.has(event.id)) {
      diagnostics.push(error('fsm.event.duplicate-id', `Duplicate event id: ${event.id}`));
    }
    eventIds.add(event.id);
  }

  for (const transition of model.transitions) {
    if (!isSafeId(transition.id)) {
      diagnostics.push(error('fsm.transition.invalid-id', `Invalid transition id: ${transition.id}`));
    }
    if (transitionIds.has(transition.id)) {
      diagnostics.push(error('fsm.transition.duplicate-id', `Duplicate transition id: ${transition.id}`));
    }
    transitionIds.add(transition.id);
    if (!stateIds.has(transition.from)) {
      diagnostics.push(error('fsm.transition.unknown-from', `Transition ${transition.id} references missing source state ${transition.from}`));
    }
    if (!stateIds.has(transition.to)) {
      diagnostics.push(error('fsm.transition.unknown-to', `Transition ${transition.id} references missing target state ${transition.to}`));
    }
    if (!eventIds.has(transition.eventId)) {
      diagnostics.push(error('fsm.transition.unknown-event', `Transition ${transition.id} references missing event ${transition.eventId}`));
    }
    const guard = parseGuardCondition(transition.condition);
    if (guard.kind === 'invalid') {
      diagnostics.push(error('fsm.transition.invalid-guard', `Transition ${transition.id} has an invalid typed guard: ${guard.diagnostics.map((diagnostic) => diagnostic.message).join(' ')}`));
    }
  }

  for (const entry of model.layout) {
    if (!stateIds.has(entry.stateId)) {
      diagnostics.push(error('fsm.layout.unknown-state', `Layout references missing state ${entry.stateId}`));
    }
  }

  return diagnostics;
}

export function isSafeId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(value) && !value.includes('__proto__') && !value.includes('constructor');
}

function error(code: string, message: string): FsmParseDiagnostic {
  return { severity: 'error', code, message, line: 1, column: 1 };
}

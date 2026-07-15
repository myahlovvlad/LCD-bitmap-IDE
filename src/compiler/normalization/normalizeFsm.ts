import type { NormalizedFsmIr } from '../ir/fsmIr';
import type { CompilerSymbolTable } from '../ir/symbolTable';
import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { describeTransitionBehavior } from '../../fsm-behavior';
import { symbolFor } from './normalizeSymbols';

export function normalizeFsm(source: CompilerSourceSnapshot, symbols: CompilerSymbolTable): NormalizedFsmIr {
  const { fsm } = source.project;
  const states = fsm.stateOrder
    .map((id) => fsm.states[id])
    .filter((state): state is NonNullable<typeof state> => Boolean(state))
    .map((state, order) => ({
      id: state.id,
      order,
      title: state.title,
      subsystem: state.subsystem,
      stateType: state.stateType,
      origin: state.origin,
      screenId: state.screenId,
      initial: state.initial,
      terminal: state.terminal,
      graphPosition: fsm.graphLayout[state.id] ? { ...fsm.graphLayout[state.id] } : undefined,
      symbol: symbolFor(symbols, 'fsm-state', state.id),
      sourcePath: `/fsm/states/${state.id}`
    }));
  const events = fsm.eventOrder
    .map((id) => fsm.events[id])
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .map((event, order) => ({
      id: event.id,
      order,
      name: event.name,
      description: event.description,
      legacyTrigger: event.legacyTrigger,
      symbol: symbolFor(symbols, 'fsm-event', event.id),
      sourcePath: `/fsm/events/${event.id}`
    }));
  const transitions = fsm.transitionOrder
    .map((id) => fsm.transitions[id])
    .filter((transition): transition is NonNullable<typeof transition> => Boolean(transition))
    .map((transition, order) => ({
      id: transition.id,
      order,
      fromStateId: transition.from,
      toStateId: transition.to,
      trigger: {
        eventId: transition.trigger.eventId,
        mechanism: transition.trigger.mechanism ?? 'event',
        buttonId: transition.trigger.buttonId,
        timerMs: transition.trigger.timerMs,
        fact: transition.trigger.fact
      },
      kind: transition.kind,
      condition: transition.condition,
      backendProcessId: transition.backendProcessId,
      behavior: describeTransitionBehavior(transition),
      symbol: symbolFor(symbols, 'fsm-transition', transition.id),
      sourcePath: `/fsm/transitions/${transition.id}`
    }));

  return {
    states,
    events,
    transitions,
    initialStateIds: states.filter((state) => state.initial).map((state) => state.id),
    terminalStateIds: states.filter((state) => state.terminal).map((state) => state.id)
  };
}

import type { LcdBitmapProject } from '../domain';
import { FSM_INTERCHANGE_VERSION, type FsmInterchangeModelV1 } from './types';

export function projectToFsmInterchange(project: LcdBitmapProject): FsmInterchangeModelV1 {
  return canonicalizeFsmInterchange({
    version: FSM_INTERCHANGE_VERSION,
    machine: {
      projectId: project.meta.id,
      name: project.meta.name
    },
    states: project.fsm.stateOrder
      .map((id, order) => {
        const state = project.fsm.states[id];
        if (!state) {
          return null;
        }
        return {
          id: state.id,
          title: state.title,
          stateType: state.stateType,
          initial: state.initial,
          terminal: state.terminal,
          subsystem: state.subsystem,
          origin: state.origin,
          screenId: state.screenId,
          runtimeId: state.runtimeId,
          legacyIds: [...state.legacyIds],
          order
        };
      })
      .filter((state): state is NonNullable<typeof state> => Boolean(state)),
    events: project.fsm.eventOrder
      .map((id, order) => {
        const event = project.fsm.events[id];
        if (!event) {
          return null;
        }
        return {
          id: event.id,
          name: event.name,
          description: event.description,
          legacyTrigger: event.legacyTrigger,
          order
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event)),
    transitions: project.fsm.transitionOrder
      .map((id, order) => {
        const transition = project.fsm.transitions[id];
        if (!transition) {
          return null;
        }
        return {
          id: transition.id,
          from: transition.from,
          to: transition.to,
          eventId: transition.trigger.eventId,
          mechanism: transition.trigger.mechanism,
          buttonId: transition.trigger.buttonId,
          timerMs: transition.trigger.timerMs,
          fact: transition.trigger.fact,
          sourceHandle: transition.sourceHandle,
          targetHandle: transition.targetHandle,
          kind: transition.kind,
          condition: transition.condition,
          source: transition.source,
          backendProcessId: transition.backendProcessId,
          order
        };
      })
      .filter((transition): transition is NonNullable<typeof transition> => Boolean(transition)),
    layout: project.fsm.stateOrder
      .map((stateId, order) => {
        const position = project.fsm.graphLayout[stateId];
        if (!position) {
          return null;
        }
        return {
          stateId,
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height,
          order
        };
      })
      .filter((layout): layout is NonNullable<typeof layout> => Boolean(layout))
  });
}

export function canonicalizeFsmInterchange(model: FsmInterchangeModelV1): FsmInterchangeModelV1 {
  return {
    version: FSM_INTERCHANGE_VERSION,
    machine: {
      projectId: model.machine.projectId,
      name: normalizeOptionalString(model.machine.name)
    },
    states: [...model.states]
      .sort(compareOrderThenId)
      .map((state, order) => ({
        id: state.id,
        title: state.title || state.id,
        stateType: state.stateType || 'process',
        initial: Boolean(state.initial),
        terminal: Boolean(state.terminal),
        subsystem: state.subsystem || 'default',
        origin: state.origin || 'author',
        screenId: state.screenId ?? null,
        runtimeId: state.runtimeId ?? null,
        legacyIds: [...state.legacyIds].sort(),
        order
      })),
    events: [...model.events]
      .sort(compareOrderThenId)
      .map((event, order) => ({
        id: event.id,
        name: event.name || event.id,
        description: normalizeOptionalString(event.description),
        legacyTrigger: normalizeOptionalString(event.legacyTrigger),
        order
      })),
    transitions: [...model.transitions]
      .sort(compareOrderThenId)
      .map((transition, order) => ({
        id: transition.id,
        from: transition.from,
        to: transition.to,
        eventId: transition.eventId,
        mechanism: transition.mechanism,
        buttonId: transition.buttonId ?? null,
        timerMs: transition.timerMs ?? null,
        fact: transition.fact ?? null,
        sourceHandle: transition.sourceHandle ?? null,
        targetHandle: transition.targetHandle ?? null,
        kind: transition.kind || 'navigation',
        condition: transition.condition ?? null,
        source: transition.source ?? null,
        backendProcessId: transition.backendProcessId ?? null,
        order
      })),
    layout: [...model.layout]
      .sort((left, right) => left.order - right.order || left.stateId.localeCompare(right.stateId))
      .map((entry, order) => ({
        stateId: entry.stateId,
        x: Number.isFinite(entry.x) ? entry.x : 0,
        y: Number.isFinite(entry.y) ? entry.y : 0,
        width: entry.width,
        height: entry.height,
        order
      }))
  };
}

export function canonicalSerializeFsmInterchange(model: FsmInterchangeModelV1): string {
  return canonicalSerializeValue(canonicalizeFsmInterchange(model));
}

export function fsmInterchangeFingerprint(model: FsmInterchangeModelV1): string {
  let hash = 2166136261;
  const serialized = canonicalSerializeFsmInterchange(model);
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function compareOrderThenId(left: { order: number; id: string }, right: { order: number; id: string }): number {
  return left.order - right.order || left.id.localeCompare(right.id);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function canonicalSerializeValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerializeValue(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalSerializeValue(item)}`).join(',')}}`;
}

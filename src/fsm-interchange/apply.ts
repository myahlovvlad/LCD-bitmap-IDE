import type { GraphPosition, LcdBitmapProject } from '../domain';
import { canonicalizeFsmInterchange } from './canonical';
import type { FsmInterchangeModelV1 } from './types';

export type FsmInterchangeSemanticChangeKind = 'created' | 'updated' | 'deleted';

export interface FsmInterchangeSemanticChange {
  readonly kind: FsmInterchangeSemanticChangeKind;
  readonly entityType: 'fsm-state' | 'fsm-event' | 'fsm-transition' | 'graph-position';
  readonly entityId: string;
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export interface ApplyFsmInterchangeResult {
  readonly project: LcdBitmapProject;
  readonly changes: readonly FsmInterchangeSemanticChange[];
}

export function applyFsmInterchangeToProject(
  project: LcdBitmapProject,
  candidate: FsmInterchangeModelV1,
  timestamp: string
): ApplyFsmInterchangeResult {
  const model = canonicalizeFsmInterchange(candidate);
  const existing = project.fsm;
  const states = Object.fromEntries(model.states.map((state) => {
    const previous = existing.states[state.id];
    return [state.id, {
      id: state.id,
      runtimeId: state.runtimeId,
      legacyIds: [...state.legacyIds],
      title: state.title,
      subsystem: state.subsystem,
      stateType: state.stateType,
      origin: state.origin,
      screenId: state.screenId,
      initial: state.initial,
      terminal: state.terminal
    }];
  }));
  const events = Object.fromEntries(model.events.map((event) => [event.id, {
    id: event.id,
    name: event.name,
    description: event.description,
    legacyTrigger: event.legacyTrigger
  }]));
  const transitions = Object.fromEntries(model.transitions.map((transition) => [transition.id, {
    id: transition.id,
    from: transition.from,
    to: transition.to,
    sourceHandle: transition.sourceHandle,
    targetHandle: transition.targetHandle,
    trigger: {
      eventId: transition.eventId,
      mechanism: transition.mechanism,
      buttonId: transition.buttonId,
      timerMs: transition.timerMs,
      fact: transition.fact
    },
    kind: transition.kind,
    condition: transition.condition,
    source: transition.source,
    backendProcessId: transition.backendProcessId
  }]));
  const graphLayout = Object.fromEntries(model.states.map((state, index) => {
    const explicit = model.layout.find((entry) => entry.stateId === state.id);
    const previous = existing.graphLayout[state.id];
    return [state.id, explicit
      ? graphPosition(explicit)
      : previous ?? deterministicPosition(index)];
  }));
  const nextProject: LcdBitmapProject = {
    ...project,
    meta: { ...project.meta, updatedAt: timestamp },
    fsm: {
      ...existing,
      states,
      stateOrder: model.states.map((state) => state.id),
      events,
      eventOrder: model.events.map((event) => event.id),
      transitions,
      transitionOrder: model.transitions.map((transition) => transition.id),
      graphLayout
    }
  };
  return { project: nextProject, changes: collectChanges(project, nextProject) };
}

function collectChanges(before: LcdBitmapProject, after: LcdBitmapProject): FsmInterchangeSemanticChange[] {
  const changes: FsmInterchangeSemanticChange[] = [];
  collectRecordChanges('fsm-state', '/fsm/states', before.fsm.states, after.fsm.states, changes);
  collectRecordChanges('fsm-event', '/fsm/events', before.fsm.events, after.fsm.events, changes);
  collectRecordChanges('fsm-transition', '/fsm/transitions', before.fsm.transitions, after.fsm.transitions, changes);
  collectRecordChanges('graph-position', '/fsm/graphLayout', before.fsm.graphLayout, after.fsm.graphLayout, changes);
  if (JSON.stringify(before.fsm.stateOrder) !== JSON.stringify(after.fsm.stateOrder)) {
    changes.push({ kind: 'updated', entityType: 'fsm-state', entityId: 'order', path: '/fsm/stateOrder', before: before.fsm.stateOrder, after: after.fsm.stateOrder });
  }
  if (JSON.stringify(before.fsm.eventOrder) !== JSON.stringify(after.fsm.eventOrder)) {
    changes.push({ kind: 'updated', entityType: 'fsm-event', entityId: 'order', path: '/fsm/eventOrder', before: before.fsm.eventOrder, after: after.fsm.eventOrder });
  }
  if (JSON.stringify(before.fsm.transitionOrder) !== JSON.stringify(after.fsm.transitionOrder)) {
    changes.push({ kind: 'updated', entityType: 'fsm-transition', entityId: 'order', path: '/fsm/transitionOrder', before: before.fsm.transitionOrder, after: after.fsm.transitionOrder });
  }
  return changes;
}

function collectRecordChanges(
  entityType: FsmInterchangeSemanticChange['entityType'],
  path: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changes: FsmInterchangeSemanticChange[]
): void {
  for (const [id, beforeValue] of Object.entries(before)) {
    if (!(id in after)) {
      changes.push({ kind: 'deleted', entityType, entityId: id, path: `${path}/${id}`, before: beforeValue });
    } else if (JSON.stringify(beforeValue) !== JSON.stringify(after[id])) {
      changes.push({ kind: 'updated', entityType, entityId: id, path: `${path}/${id}`, before: beforeValue, after: after[id] });
    }
  }
  for (const [id, afterValue] of Object.entries(after)) {
    if (!(id in before)) {
      changes.push({ kind: 'created', entityType, entityId: id, path: `${path}/${id}`, after: afterValue });
    }
  }
}

function graphPosition(entry: FsmInterchangeModelV1['layout'][number]): GraphPosition {
  return {
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height
  };
}

function deterministicPosition(index: number): GraphPosition {
  return {
    x: 80 + (index % 4) * 190,
    y: 80 + Math.floor(index / 4) * 130
  };
}

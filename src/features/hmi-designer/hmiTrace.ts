import type { HmiBindings, LcdBitmapProject, ValueExpression } from '../../domain';

export type HmiTraceGap =
  | 'missing-state'
  | 'missing-screen'
  | 'missing-button'
  | 'missing-event'
  | 'missing-transition'
  | 'missing-tag'
  | 'missing-procedure';

export interface HmiTrace {
  stateId: string | null;
  screenId: string | null;
  buttonId: string | null;
  eventId: string | null;
  transitionIds: string[];
  tagIds: string[];
  procedureIds: string[];
  alarmIds: string[];
  gaps: HmiTraceGap[];
}

export function resolveHmiTrace(
  project: LcdBitmapProject,
  requestedStateId: string | null,
  requestedButtonId: string | null
): HmiTrace {
  const gaps: HmiTraceGap[] = [];
  const state = requestedStateId ? project.fsm.states[requestedStateId] : null;
  if (!state) gaps.push('missing-state');
  const screen = state?.screenId ? project.screens[state.screenId] : null;
  if (state && !screen) gaps.push('missing-screen');
  const element = requestedButtonId ? project.controlPanel.elements[requestedButtonId] : null;
  const button = element?.type === 'button' ? element : null;
  if (requestedButtonId && !button) gaps.push('missing-button');

  const eventId = button?.fsmEventId ?? button?.bindings?.eventId ?? null;
  if (button && !eventId) gaps.push('missing-event');
  const transitions = state && eventId
    ? project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((transition) => transition?.from === state.id && transition.trigger.eventId === eventId)
    : [];
  if (button && transitions.length === 0) gaps.push('missing-transition');

  const referencedProcedureIds = unique([
    button?.bindings?.procedureId,
    ...transitions.map((transition) => transition.backendProcessId)
  ]);
  const procedureIds = referencedProcedureIds.filter((id) => Boolean(project.procedures?.[id] ?? project.backendProcesses[id]));
  if (referencedProcedureIds.length !== procedureIds.length) gaps.push('missing-procedure');

  const referencedTagIds = new Set<string>();
  collectBindingTags(button?.bindings, referencedTagIds);
  for (const procedureId of procedureIds) {
    const procedure = project.procedures?.[procedureId];
    if (!procedure) continue;
    collectExpressionTags(procedure.precondition, referencedTagIds);
    collectExpressionTags(procedure.postcondition, referencedTagIds);
    for (const step of procedure.steps) {
      if (step.tagId) referencedTagIds.add(step.tagId);
      collectExpressionTags(step.value, referencedTagIds);
    }
  }
  const tagIds = [...referencedTagIds].filter((id) => Boolean(project.tags?.[id]));
  if (referencedTagIds.size !== tagIds.length) gaps.push('missing-tag');

  const linkedTags = new Set(tagIds);
  const alarmIds = Object.values(project.alarms ?? {})
    .filter((alarm) => expressionTagIds(alarm.condition).some((id) => linkedTags.has(id)))
    .map((alarm) => alarm.id);

  return {
    stateId: state?.id ?? null,
    screenId: screen?.id ?? null,
    buttonId: button?.id ?? null,
    eventId,
    transitionIds: transitions.map((transition) => transition.id),
    tagIds,
    procedureIds,
    alarmIds,
    gaps: unique(gaps)
  };
}

function collectBindingTags(bindings: HmiBindings | undefined, target: Set<string>): void {
  if (!bindings) return;
  collectExpressionTags(bindings.visibility, target);
  collectExpressionTags(bindings.enabled, target);
  collectExpressionTags(bindings.text, target);
  collectExpressionTags(bindings.value, target);
  collectExpressionTags(bindings.color, target);
  if (bindings.writeTag) {
    target.add(bindings.writeTag.tagId);
    collectExpressionTags(bindings.writeTag.value, target);
  }
}

function collectExpressionTags(expression: ValueExpression | undefined, target: Set<string>): void {
  for (const id of expressionTagIds(expression)) target.add(id);
}

function expressionTagIds(expression: ValueExpression | undefined): string[] {
  if (!expression) return [];
  if (expression.kind === 'tag') return [expression.tagId];
  if (expression.kind === 'formula') return expression.deps;
  return [];
}

function unique<T>(items: Array<T | null | undefined>): T[] {
  return [...new Set(items.filter((item): item is T => item !== null && item !== undefined))];
}

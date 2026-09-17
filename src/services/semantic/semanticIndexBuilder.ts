import type { CanvasObject } from '../../domain/canvas';
import type { ControlPanelElement, FsmState, LcdBitmapProject } from '../../domain/project';
import type {
  ProjectSemanticIndex,
  SemanticControlRecord,
  SemanticIndexDiagnostic,
  SemanticLayoutObject,
  SemanticRelation,
  SemanticScreenRecord,
  SemanticStateCandidate,
  SemanticStateClassification,
  SemanticStateRecord,
  SemanticTransitionRecord,
  SemanticWorkflowDefinition
} from '../../domain/semanticIndex';
import { buildProjectUxGraph } from '../ux/uxGraphBuilder';
import {
  buildEcros5400WorkflowDefinitions,
  classifyEcros5400State,
  globalEcros5400EventIntent,
  resolveEcros5400EventIntent
} from './profiles/ecros5400Profile';

const UNKNOWN_CLASSIFICATION: SemanticStateClassification = {
  domain: 'unknown', mode: null, phase: 'unknown', operation: 'unknown', quantity: null,
  inputKind: null, longRunning: false, confidence: 'unknown'
};

function isEcros5400(project: LcdBitmapProject): boolean {
  const identity = `${project.meta.modelId} ${project.meta.name}`.toLowerCase();
  return /ecros[-_ ]?5400|экрос[-_ ]?5400/.test(identity);
}

function candidate(state: FsmState): SemanticStateCandidate {
  return { id: state.id, title: state.title, subsystem: state.subsystem, screenId: state.screenId };
}

function summarizeText(value: unknown): string[] | undefined {
  if (typeof value === 'string') return value.trim() ? [value] : undefined;
  if (!value || typeof value !== 'object') return undefined;
  const values = Object.values(value as Record<string, unknown>).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return values.length ? values.sort() : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function summarizeObject(object: CanvasObject): SemanticLayoutObject {
  const raw = object as unknown as Record<string, unknown>;
  const bindings = raw.bindings && typeof raw.bindings === 'object' ? raw.bindings as Record<string, unknown> : undefined;
  const summary: SemanticLayoutObject = {
    id: object.id,
    type: object.type,
    ...(finite(raw.x) !== undefined ? { x: finite(raw.x) } : {}),
    ...(finite(raw.y) !== undefined ? { y: finite(raw.y) } : {}),
    ...(finite(raw.width) !== undefined ? { width: finite(raw.width) } : {}),
    ...(finite(raw.height) !== undefined ? { height: finite(raw.height) } : {})
  };
  const text = summarizeText(raw.text);
  if (text) summary.text = text;
  if (typeof bindings?.procedureId === 'string') summary.procedureId = bindings.procedureId;
  if (typeof bindings?.algorithmId === 'string') summary.algorithmId = bindings.algorithmId;
  return summary;
}

function globalIntentForControl(element: ControlPanelElement, ecros: boolean, uxIntent?: string): string {
  if (uxIntent) return uxIntent;
  if (element.type !== 'button') return `control.${element.type}`;
  if (ecros && element.fsmEventId) return globalEcros5400EventIntent(element.fsmEventId);
  return element.fsmEventId ? 'event.trigger' : 'control.press';
}

function sortedRelations(relations: SemanticRelation[]): SemanticRelation[] {
  return relations.sort((a, b) => `${a.kind}|${a.from}|${a.to}|${a.via ?? ''}`.localeCompare(`${b.kind}|${b.from}|${b.to}|${b.via ?? ''}`));
}

function workflowRefs(workflows: SemanticWorkflowDefinition[]): Map<string, Array<{ workflowId: string; stepId: string }>> {
  const refs = new Map<string, Array<{ workflowId: string; stepId: string }>>();
  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      for (const stateId of step.stateIds) {
        refs.set(stateId, [...(refs.get(stateId) ?? []), { workflowId: workflow.id, stepId: step.id }]);
      }
    }
  }
  for (const values of refs.values()) values.sort((a, b) => `${a.workflowId}/${a.stepId}`.localeCompare(`${b.workflowId}/${b.stepId}`));
  return refs;
}

function addWorkflowDiagnostics(workflows: SemanticWorkflowDefinition[], diagnostics: SemanticIndexDiagnostic[]): void {
  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      if (step.stateIds.length === 0) diagnostics.push({
        code: 'semantic.workflow-step-unresolved', severity: 'info',
        message: `Workflow ${workflow.id} step ${step.id} does not resolve to a state in this project.`,
        workflowId: workflow.id, stepId: step.id
      });
    }
  }
}

export function buildProjectSemanticIndex(project: LcdBitmapProject): ProjectSemanticIndex {
  const ux = buildProjectUxGraph(project);
  const ecros = isEcros5400(project);
  const diagnostics: SemanticIndexDiagnostic[] = ux.diagnostics.map((item) => ({
    code: item.code, severity: 'warning', message: item.message
  }));

  const stateClassifications = new Map<string, SemanticStateClassification>();
  for (const stateId of project.fsm.stateOrder) {
    const state = project.fsm.states[stateId];
    const classification = ecros ? classifyEcros5400State(candidate(state)) : UNKNOWN_CLASSIFICATION;
    stateClassifications.set(stateId, classification);
    if (!state.screenId || !project.screens[state.screenId]) diagnostics.push({
      code: 'semantic.state-screen-missing', severity: 'warning', entityId: stateId,
      message: `State ${stateId} has no resolvable LCD screen.`
    });
    if (ecros && classification.confidence === 'unknown') diagnostics.push({
      code: 'semantic.state-unclassified', severity: 'warning', entityId: stateId,
      message: `ECROS state ${stateId} could not be classified deterministically.`
    });
  }

  const workflows = ecros
    ? buildEcros5400WorkflowDefinitions(project.fsm.stateOrder.map((id) => candidate(project.fsm.states[id])))
    : [];
  addWorkflowDiagnostics(workflows, diagnostics);
  const refsByState = workflowRefs(workflows);

  const states: SemanticStateRecord[] = ux.states.map((state) => ({
    stateId: state.stateId,
    title: state.title,
    screenId: state.screenId,
    role: state.role,
    incomingTransitionIds: [...state.incomingTransitionIds],
    outgoingTransitionIds: [...state.outgoingTransitionIds],
    classification: stateClassifications.get(state.stateId) ?? UNKNOWN_CLASSIFICATION,
    workflowRefs: refsByState.get(state.stateId) ?? []
  }));

  const screens: SemanticScreenRecord[] = project.screenOrder.map((screenId) => {
    const screen = project.screens[screenId];
    const uxScreen = ux.screensById.get(screenId);
    const linkedStateIds = [...(project.bindings.statesByScreenId[screenId] ?? [])].sort();
    const linkedClassifications = linkedStateIds.map((id) => stateClassifications.get(id)).filter((item): item is SemanticStateClassification => Boolean(item));
    const classification = linkedClassifications.length > 0 ? linkedClassifications[0] : null;
    if (linkedStateIds.length === 0) diagnostics.push({
      code: 'semantic.screen-state-missing', severity: 'info', entityId: screenId,
      message: `Screen ${screenId} is not linked to an FSM state.`
    });
    return {
      screenId,
      name: screen.name,
      role: uxScreen?.role ?? 'unknown',
      ...(uxScreen?.meta.purpose ? { purpose: uxScreen.meta.purpose } : {}),
      stateIds: linkedStateIds,
      classification,
      layout: {
        width: screen.width,
        height: screen.height,
        objects: screen.objects.map(summarizeObject)
      }
    };
  });

  const transitions: SemanticTransitionRecord[] = ux.transitions.map((transition) => {
    const executable = project.fsm.transitions[transition.transitionId];
    const source = stateClassifications.get(transition.from) ?? UNKNOWN_CLASSIFICATION;
    const target = stateClassifications.get(transition.to) ?? UNKNOWN_CLASSIFICATION;
    const intent = ecros
      ? resolveEcros5400EventIntent(transition.eventId, source, target)
      : transition.intent ?? 'event.trigger';
    return {
      transitionId: transition.transitionId,
      from: transition.from,
      to: transition.to,
      eventId: transition.eventId,
      mechanism: transition.mechanism,
      controlIds: [...transition.linkedControlIds].sort(),
      intent,
      backendProcessId: executable.backendProcessId
    };
  });
  const transitionById = new Map(transitions.map((item) => [item.transitionId, item]));

  const controls: SemanticControlRecord[] = project.controlPanel.elementOrder.map((controlId) => {
    const element = project.controlPanel.elements[controlId];
    const uxControl = ux.controlsById.get(controlId);
    const eventId = element.type === 'button' ? element.fsmEventId : undefined;
    const linkedTransitionIds = eventId ? [...(project.bindings.transitionsByEventId[eventId] ?? [])].sort() : [];
    return {
      controlId,
      label: element.type === 'button' ? element.label : element.type,
      ...(eventId ? { eventId } : {}),
      globalIntent: globalIntentForControl(element, ecros, uxControl?.intent),
      linkedTransitionIds,
      contextualIntents: linkedTransitionIds.map((transitionId) => {
        const transition = transitionById.get(transitionId);
        return {
          transitionId,
          fromStateId: transition?.from ?? '',
          intent: transition?.intent ?? 'event.trigger'
        };
      })
    };
  });

  const relations: SemanticRelation[] = [];
  for (const state of states) {
    if (state.screenId && project.screens[state.screenId]) {
      relations.push({ kind: 'state.uses_screen', from: state.stateId, to: state.screenId });
      relations.push({ kind: 'screen.represents_state', from: state.screenId, to: state.stateId });
    }
    for (const ref of state.workflowRefs) relations.push({ kind: 'state.belongs_to_workflow_step', from: state.stateId, to: `${ref.workflowId}/${ref.stepId}` });
  }
  for (const transition of transitions) {
    relations.push({ kind: 'state.next_state', from: transition.from, to: transition.to, via: transition.transitionId });
    relations.push({ kind: 'transition.triggered_by_event', from: transition.transitionId, to: transition.eventId });
    for (const controlId of transition.controlIds) relations.push({ kind: 'control.triggers_transition', from: controlId, to: transition.transitionId });
    if (transition.backendProcessId) relations.push({ kind: 'transition.invokes_process', from: transition.transitionId, to: transition.backendProcessId });
  }
  for (const control of controls) if (control.eventId) relations.push({ kind: 'control.emits_event', from: control.controlId, to: control.eventId });
  for (const screen of screens) for (const object of screen.layout.objects) if (object.procedureId) relations.push({ kind: 'screen_object.invokes_procedure', from: `${screen.screenId}/${object.id}`, to: object.procedureId });
  for (const workflow of workflows) for (const item of workflow.steps) for (const next of item.next) relations.push({ kind: 'workflow_step.next', from: `${workflow.id}/${item.id}`, to: `${workflow.id}/${next}` });

  diagnostics.sort((a, b) => `${a.code}|${a.entityId ?? ''}|${a.workflowId ?? ''}|${a.stepId ?? ''}`.localeCompare(`${b.code}|${b.entityId ?? ''}|${b.workflowId ?? ''}|${b.stepId ?? ''}`));

  return {
    version: 1,
    projectId: project.meta.id,
    ...(project.meta.modelId ? { modelId: project.meta.modelId } : {}),
    screens,
    states,
    transitions,
    controls,
    relations: sortedRelations(relations),
    workflows,
    diagnostics
  };
}

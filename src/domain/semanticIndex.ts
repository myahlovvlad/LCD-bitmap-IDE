export type SemanticDomain = 'startup' | 'navigation' | 'measurement' | 'files' | 'settings' | 'auxiliary' | 'unknown';
export type SemanticMeasurementMode = 'photometry' | 'quantitative' | 'kinetics' | 'multiwave' | null;
export type SemanticPhase = 'diagnostic' | 'warmup' | 'navigation' | 'configuration' | 'zeroing' | 'measurement' | 'results' | 'save' | 'print' | 'file' | 'settings' | 'unknown';
export type SemanticQuantity = 'A' | 'E' | '%T' | 'C' | null;
export type SemanticInputKind =
  | 'numeric.wavelength'
  | 'numeric.parallel_count'
  | 'numeric.gain'
  | 'numeric.coefficient'
  | 'numeric.concentration'
  | 'text.filename'
  | null;

export interface SemanticStateClassification {
  domain: SemanticDomain;
  mode: SemanticMeasurementMode;
  phase: SemanticPhase;
  operation: string;
  quantity: SemanticQuantity;
  inputKind: SemanticInputKind;
  longRunning: boolean;
  confidence: 'exact' | 'derived' | 'unknown';
}

export interface SemanticLayoutObject {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string[];
  procedureId?: string;
  algorithmId?: string;
}

export interface SemanticScreenRecord {
  screenId: string;
  name: string;
  role: string;
  purpose?: string;
  stateIds: string[];
  classification: SemanticStateClassification | null;
  layout: {
    width: number;
    height: number;
    objects: SemanticLayoutObject[];
  };
}

export interface SemanticStateRecord {
  stateId: string;
  title: string;
  screenId: string | null;
  role: string;
  incomingTransitionIds: string[];
  outgoingTransitionIds: string[];
  classification: SemanticStateClassification;
  workflowRefs: Array<{ workflowId: string; stepId: string }>;
}

export interface SemanticTransitionRecord {
  transitionId: string;
  from: string;
  to: string;
  eventId: string;
  mechanism: string;
  controlIds: string[];
  intent: string;
  backendProcessId?: string | null;
}

export interface SemanticControlRecord {
  controlId: string;
  label: string;
  eventId?: string;
  globalIntent: string;
  linkedTransitionIds: string[];
  contextualIntents: Array<{ transitionId: string; fromStateId: string; intent: string }>;
}

export type SemanticRelationKind =
  | 'screen.represents_state'
  | 'state.uses_screen'
  | 'state.next_state'
  | 'transition.triggered_by_event'
  | 'control.emits_event'
  | 'control.triggers_transition'
  | 'transition.invokes_process'
  | 'screen_object.invokes_procedure'
  | 'state.belongs_to_workflow_step'
  | 'workflow_step.next';

export interface SemanticRelation {
  kind: SemanticRelationKind;
  from: string;
  to: string;
  via?: string;
}

export interface SemanticWorkflowStep {
  id: string;
  title: string;
  operation: string;
  stateIds: string[];
  screenIds: string[];
  next: string[];
  branch?: string;
}

export interface SemanticWorkflowDefinition {
  id: string;
  title: string;
  mode: SemanticMeasurementMode;
  steps: SemanticWorkflowStep[];
}

export interface SemanticIndexDiagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  entityId?: string;
  workflowId?: string;
  stepId?: string;
}

export interface ProjectSemanticIndex {
  version: 1;
  projectId: string;
  modelId?: string;
  screens: SemanticScreenRecord[];
  states: SemanticStateRecord[];
  transitions: SemanticTransitionRecord[];
  controls: SemanticControlRecord[];
  relations: SemanticRelation[];
  workflows: SemanticWorkflowDefinition[];
  diagnostics: SemanticIndexDiagnostic[];
}

export interface SemanticStateCandidate {
  id: string;
  title: string;
  subsystem?: string;
  screenId?: string | null;
}

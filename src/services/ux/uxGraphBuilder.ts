/**
 * Pure semantic-extraction layer for UX validation. Normalizes screens, FSM states/transitions,
 * control-panel buttons and the UX contract into one canonical, source-traceable graph. No React
 * or Zustand dependency — safe to call from MCP handlers, tests, or future CLI tooling.
 */
import type {
  ControlPanelButton,
  FsmTransitionMechanism,
  LcdBitmapProject
} from '../../domain/project';
import type { LanguageCode } from '../../domain/localization';
import {
  buildUxContractIdRefs,
  normalizeUxContract,
  type ControlUxMetadata,
  type ProjectUxContract,
  type ScreenRole,
  type ScreenUxMetadata,
  type StateUxMetadata,
  type TransitionUxMetadata,
  type UxControlActionKind,
  type UxRiskLevel,
  type UxUserGoal,
  type UxScenarioDefinition
} from '../../domain/uxContract';

export interface UxScreenNode {
  screenId: string;
  name: string;
  role: ScreenRole;
  stateIds: string[];
  visibleTextObjectIds: string[];
  hasVisibleText: boolean;
  meta: ScreenUxMetadata;
}

export interface UxStateNode {
  stateId: string;
  title: string;
  screenId: string | null;
  role: ScreenRole;
  isInitial: boolean;
  isTerminal: boolean;
  isOverlay: boolean;
  outgoingTransitionIds: string[];
  incomingTransitionIds: string[];
  meta: StateUxMetadata;
}

export interface UxTransitionNode {
  transitionId: string;
  from: string;
  to: string;
  eventId: string;
  mechanism: FsmTransitionMechanism;
  linkedControlIds: string[];
  triggerControlId: string | null;
  intent: string | undefined;
  riskLevel: UxRiskLevel;
  requiresConfirmation: boolean;
  meta: TransitionUxMetadata;
}

export interface UxControlNode {
  controlId: string;
  label: string;
  fsmEventId?: string;
  linkedTransitionIds: string[];
  intent: string | undefined;
  actionKind: UxControlActionKind | undefined;
  riskLevel: UxRiskLevel;
  requiresConfirmation: boolean;
  /** Undefined/empty means available from every state (mirrors ControlPanelButton semantics). */
  allowedStates?: string[];
  disabledStates?: string[];
  meta: ControlUxMetadata;
}

export interface UxVisibleText {
  screenId: string;
  elementId: string;
  locale: LanguageCode;
  text: string;
}

export interface UxIntentUsage {
  kind: 'control' | 'transition';
  id: string;
  label?: string;
}

export interface UxGraphDiagnostic {
  code: string;
  message: string;
}

export interface ProjectUxGraph {
  contract: ProjectUxContract;
  screens: UxScreenNode[];
  screensById: Map<string, UxScreenNode>;
  states: UxStateNode[];
  statesById: Map<string, UxStateNode>;
  transitions: UxTransitionNode[];
  transitionsById: Map<string, UxTransitionNode>;
  controls: UxControlNode[];
  controlsById: Map<string, UxControlNode>;
  visibleTexts: UxVisibleText[];
  intents: Map<string, UxIntentUsage[]>;
  goals: UxUserGoal[];
  scenarios: UxScenarioDefinition[];
  diagnostics: UxGraphDiagnostic[];
}

function inferRoleFromStateType(stateType: string): ScreenRole {
  switch (stateType) {
    case 'initial': return 'navigation';
    case 'success': return 'result';
    case 'failure': return 'error';
    case 'process': return 'operation';
    default: return 'unknown';
  }
}

export function buildProjectUxGraph(project: LcdBitmapProject): ProjectUxGraph {
  const diagnostics: UxGraphDiagnostic[] = [];
  const refs = buildUxContractIdRefs(project);
  const contract = normalizeUxContract(project.uxContract, refs);

  const screens: UxScreenNode[] = project.screenOrder.map((screenId) => {
    const screen = project.screens[screenId];
    const meta = contract.screens[screenId] ?? {};
    const textObjects = screen.objects.filter((object) => object.type === 'text');
    return {
      screenId,
      name: screen.name,
      role: meta.role ?? 'unknown',
      stateIds: project.bindings.statesByScreenId[screenId] ?? [],
      visibleTextObjectIds: textObjects.map((object) => object.id),
      hasVisibleText: textObjects.length > 0,
      meta
    };
  });
  const screensById = new Map(screens.map((s) => [s.screenId, s]));

  const incomingByState = new Map<string, string[]>();
  const outgoingByState = new Map<string, string[]>();
  for (const transitionId of project.fsm.transitionOrder) {
    const transition = project.fsm.transitions[transitionId];
    outgoingByState.set(transition.from, [...(outgoingByState.get(transition.from) ?? []), transitionId]);
    incomingByState.set(transition.to, [...(incomingByState.get(transition.to) ?? []), transitionId]);
  }

  const states: UxStateNode[] = project.fsm.stateOrder.map((stateId) => {
    const state = project.fsm.states[stateId];
    const meta = contract.states[stateId] ?? {};
    return {
      stateId,
      title: state.title,
      screenId: state.screenId,
      role: meta.role ?? inferRoleFromStateType(state.stateType),
      isInitial: state.initial,
      isTerminal: meta.isTerminal ?? state.terminal,
      isOverlay: meta.isOverlay ?? false,
      outgoingTransitionIds: outgoingByState.get(stateId) ?? [],
      incomingTransitionIds: incomingByState.get(stateId) ?? [],
      meta
    };
  });
  const statesById = new Map(states.map((s) => [s.stateId, s]));

  const transitions: UxTransitionNode[] = project.fsm.transitionOrder.map((transitionId) => {
    const transition = project.fsm.transitions[transitionId];
    const meta = contract.transitions[transitionId] ?? {};
    const linkedControlIds = project.bindings.buttonsByEventId[transition.trigger.eventId] ?? [];
    const triggerControlId = meta.userVisibleTriggerControlId ?? linkedControlIds[0] ?? null;
    return {
      transitionId,
      from: transition.from,
      to: transition.to,
      eventId: transition.trigger.eventId,
      mechanism: transition.trigger.mechanism ?? 'event',
      linkedControlIds,
      triggerControlId,
      intent: meta.intent,
      riskLevel: meta.riskLevel ?? 'none',
      requiresConfirmation: meta.requiresConfirmation ?? false,
      meta
    };
  });
  const transitionsById = new Map(transitions.map((t) => [t.transitionId, t]));

  const controls: UxControlNode[] = [];
  for (const controlId of project.controlPanel.elementOrder) {
    const element = project.controlPanel.elements[controlId];
    if (element.type !== 'button') continue;
    const button = element as ControlPanelButton;
    const meta = contract.controls[controlId] ?? {};
    const linkedTransitionIds = button.fsmEventId ? (project.bindings.transitionsByEventId[button.fsmEventId] ?? []) : [];
    if (button.fsmEventId && !project.fsm.events[button.fsmEventId]) {
      diagnostics.push({
        code: 'ux.graph.control-event-missing',
        message: `Control ${controlId} references FSM event ${button.fsmEventId}, which no longer exists.`
      });
    }
    controls.push({
      controlId,
      label: button.label,
      fsmEventId: button.fsmEventId,
      linkedTransitionIds,
      intent: meta.intent,
      actionKind: meta.actionKind,
      riskLevel: meta.riskLevel ?? 'none',
      requiresConfirmation: meta.requiresConfirmation ?? false,
      allowedStates: button.allowedStates,
      disabledStates: button.disabledStates,
      meta
    });
  }
  const controlsById = new Map(controls.map((c) => [c.controlId, c]));

  const visibleTexts: UxVisibleText[] = [];
  for (const screen of Object.values(project.screens)) {
    for (const object of screen.objects) {
      if (object.type !== 'text') continue;
      for (const [locale, text] of Object.entries(object.text) as [LanguageCode, string][]) {
        if (typeof text === 'string' && text.trim()) {
          visibleTexts.push({ screenId: screen.id, elementId: object.id, locale, text });
        }
      }
    }
  }

  const intents = new Map<string, UxIntentUsage[]>();
  const addIntentUsage = (intent: string | undefined, usage: UxIntentUsage) => {
    if (!intent) return;
    intents.set(intent, [...(intents.get(intent) ?? []), usage]);
  };
  for (const control of controls) addIntentUsage(control.intent, { kind: 'control', id: control.controlId, label: control.label });
  for (const transition of transitions) {
    const triggerControl = transition.triggerControlId ? controlsById.get(transition.triggerControlId) : undefined;
    addIntentUsage(transition.intent, { kind: 'transition', id: transition.transitionId, label: triggerControl?.label });
  }

  return {
    contract,
    screens,
    screensById,
    states,
    statesById,
    transitions,
    transitionsById,
    controls,
    controlsById,
    visibleTexts,
    intents,
    goals: contract.userGoals,
    scenarios: contract.scenarios,
    diagnostics
  };
}

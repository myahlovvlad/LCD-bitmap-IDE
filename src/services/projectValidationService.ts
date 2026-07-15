import type {
  ControlPanelButton,
  LcdBitmapProject,
  ValidationDomain,
  ValidationIssue,
  ValidationSeverity
} from '../domain/project';
import { describeTransitionBehavior, parseBackendBehaviorStorage } from '../fsm-behavior';

export function validateProject(project: LcdBitmapProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (
    severity: ValidationSeverity,
    domain: ValidationDomain,
    code: string,
    message: string,
    entityType: string,
    entityId?: string,
    suggestedFix?: string
  ): void => {
    issues.push({
      id: `${domain}:${code}:${entityId ?? issues.length}`,
      severity,
      domain,
      message,
      entityType,
      entityId,
      suggestedFix
    });
  };

  validateRecordIds(project.screens, 'lcd', 'screen', add);
  validateRecordIds(project.fsm.states, 'fsm', 'state', add);
  validateRecordIds(project.fsm.transitions, 'fsm', 'transition', add);
  validateRecordIds(project.fsm.events, 'fsm', 'event', add);
  validateRecordIds(project.backendProcesses, 'fsm', 'backend-process', add);
  validateRecordIds(project.controlPanel.elements, 'control-panel', 'element', add);

  const linkedScreens = new Set<string>();
  for (const state of Object.values(project.fsm.states)) {
    if (!state.screenId) {
      add('error', 'fsm', 'state-screen-missing', `State "${state.id}" has no LCD screen.`, 'state', state.id, 'Bind or create an LCD screen.');
    } else if (!project.screens[state.screenId]) {
      add('error', 'fsm', 'state-screen-invalid', `State "${state.id}" references missing screen "${state.screenId}".`, 'state', state.id);
    } else {
      linkedScreens.add(state.screenId);
    }
  }

  for (const screen of Object.values(project.screens)) {
    if (!linkedScreens.has(screen.id)) {
      add('info', 'lcd', 'screen-unbound', `Screen "${screen.id}" is not linked to an FSM state.`, 'screen', screen.id);
    }
    for (const object of screen.objects) {
      if (object.type === 'icon' && object.iconId && !project.glyphs[object.iconId]) {
        add('error', 'lcd', 'glyph-missing', `Screen "${screen.id}" uses missing glyph "${object.iconId}".`, 'screen-object', object.id);
      }
    }
  }

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const stateId of Object.keys(project.fsm.states)) {
    incoming.set(stateId, 0);
    outgoing.set(stateId, 0);
  }

  for (const transition of Object.values(project.fsm.transitions)) {
    if (!project.fsm.states[transition.from]) {
      add('error', 'fsm', 'transition-from-invalid', `Transition "${transition.id}" has missing source state "${transition.from}".`, 'transition', transition.id);
    } else {
      outgoing.set(transition.from, (outgoing.get(transition.from) ?? 0) + 1);
    }
    if (!project.fsm.states[transition.to]) {
      add('error', 'fsm', 'transition-to-invalid', `Transition "${transition.id}" has missing target state "${transition.to}".`, 'transition', transition.id);
    } else {
      incoming.set(transition.to, (incoming.get(transition.to) ?? 0) + 1);
    }
    if (!project.fsm.events[transition.trigger.eventId]) {
      add('error', 'fsm', 'transition-event-invalid', `Transition "${transition.id}" references missing event "${transition.trigger.eventId}".`, 'transition', transition.id);
    }
    if (transition.trigger.mechanism === 'button' && transition.trigger.buttonId) {
      const button = project.controlPanel.elements[transition.trigger.buttonId];
      if (!button || button.type !== 'button') {
        add('error', 'fsm', 'transition-button-invalid', `Transition "${transition.id}" references missing control-panel button "${transition.trigger.buttonId}".`, 'transition', transition.id);
      }
    }
    const backend = parseBackendBehaviorStorage(transition.backendProcessId);
    if (backend.kind === 'legacy-backend-process' && !project.backendProcesses[backend.processId]) {
      add('error', 'fsm', 'transition-process-invalid', `Transition "${transition.id}" references missing backend process "${backend.processId}".`, 'transition', transition.id);
    }
    if (backend.kind === 'invalid') {
      add('error', 'fsm', 'transition-backend-storage-invalid', `Transition "${transition.id}" has invalid backend behavior storage: ${backend.diagnostics.map((diagnostic) => diagnostic.message).join(' ')}`, 'transition', transition.id);
    }
    const behavior = describeTransitionBehavior(transition);
    if (behavior.guard.kind === 'invalid') {
      add('error', 'fsm', 'transition-guard-invalid', `Transition "${transition.id}" has an invalid typed guard: ${behavior.guard.diagnostics.map((diagnostic) => diagnostic.message).join(' ')}`, 'transition', transition.id);
    }
  }

  const initialStates = Object.values(project.fsm.states).filter((state) => state.initial);
  if (initialStates.length === 0) {
    add('error', 'fsm', 'initial-missing', 'FSM has no initial state.', 'fsm');
  } else if (initialStates.length > 1) {
    add('warning', 'fsm', 'initial-duplicate', 'FSM has more than one initial state.', 'fsm');
  }

  const reachable = findReachableStates(project, initialStates[0]?.id);
  for (const state of Object.values(project.fsm.states)) {
    if (!reachable.has(state.id)) {
      add('warning', 'fsm', 'state-unreachable', `State "${state.id}" is unreachable.`, 'state', state.id);
    }
    if (!state.initial && (incoming.get(state.id) ?? 0) === 0) {
      add('warning', 'fsm', 'state-no-incoming', `State "${state.id}" has no incoming transitions.`, 'state', state.id);
    }
    if (!state.terminal && (outgoing.get(state.id) ?? 0) === 0) {
      add('warning', 'fsm', 'state-no-outgoing', `State "${state.id}" has no outgoing transitions.`, 'state', state.id);
    }
  }

  for (const element of Object.values(project.controlPanel.elements)) {
    if (element.type !== 'button') {
      continue;
    }
    validateButton(project, element, add);
  }

  return issues;
}

export function hasBlockingValidationIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function validateRecordIds(
  record: Record<string, { id: string }>,
  domain: ValidationDomain,
  entityType: string,
  add: (
    severity: ValidationSeverity,
    domain: ValidationDomain,
    code: string,
    message: string,
    entityType: string,
    entityId?: string,
    suggestedFix?: string
  ) => void
): void {
  const seen = new Set<string>();
  for (const [key, entity] of Object.entries(record)) {
    if (seen.has(entity.id)) {
      add('error', domain, 'duplicate-id', `Duplicate ${entityType} ID "${entity.id}".`, entityType, entity.id);
    }
    seen.add(entity.id);
    if (key !== entity.id) {
      add('error', domain, 'record-key-mismatch', `${entityType} key "${key}" does not match ID "${entity.id}".`, entityType, entity.id);
    }
  }
}

function validateButton(
  project: LcdBitmapProject,
  button: ControlPanelButton,
  add: (
    severity: ValidationSeverity,
    domain: ValidationDomain,
    code: string,
    message: string,
    entityType: string,
    entityId?: string,
    suggestedFix?: string
  ) => void
): void {
  if (!button.fsmEventId) {
    add('warning', 'control-panel', 'button-event-missing', `Button "${button.id}" has no FSM event binding.`, 'button', button.id);
  } else if (!project.fsm.events[button.fsmEventId]) {
    add('error', 'control-panel', 'button-event-invalid', `Button "${button.id}" references missing event "${button.fsmEventId}".`, 'button', button.id);
  }

  const allowed = new Set(button.allowedStates ?? []);
  const conflict = (button.disabledStates ?? []).find((stateId) => allowed.has(stateId));
  if (conflict) {
    add('error', 'control-panel', 'button-state-conflict', `Button "${button.id}" both allows and disables state "${conflict}".`, 'button', button.id);
  }

  for (const stateId of [...(button.allowedStates ?? []), ...(button.disabledStates ?? [])]) {
    if (!project.fsm.states[stateId]) {
      add('warning', 'control-panel', 'button-state-invalid', `Button "${button.id}" references missing state "${stateId}".`, 'button', button.id);
    }
  }
}

function findReachableStates(project: LcdBitmapProject, initialStateId?: string): Set<string> {
  const reachable = new Set<string>();
  if (!initialStateId || !project.fsm.states[initialStateId]) {
    return reachable;
  }
  const queue = [initialStateId];
  while (queue.length > 0) {
    const stateId = queue.shift()!;
    if (reachable.has(stateId)) {
      continue;
    }
    reachable.add(stateId);
    for (const transition of Object.values(project.fsm.transitions)) {
      if (transition.from === stateId && project.fsm.states[transition.to] && !reachable.has(transition.to)) {
        queue.push(transition.to);
      }
    }
  }
  return reachable;
}

import type {
  ControlPanelButton,
  FsmTransition,
  LcdBitmapProject,
  LcdScreen
} from '../domain/project';
import { evaluateTypedGuard, parseBackendBehaviorStorage } from '../fsm-behavior';

export type RuntimeLogLevel = 'info' | 'warning' | 'error';

export interface RuntimeEvent {
  id: string;
  timestamp: string;
  level: RuntimeLogLevel;
  type: 'start' | 'button' | 'event' | 'transition' | 'backend' | 'condition' | 'error';
  message: string;
  stateId?: string;
  eventId?: string;
  transitionId?: string;
  backendProcessId?: string;
}

export interface RuntimeEngine {
  readonly currentStateId: string | null;
  readonly eventLog: readonly RuntimeEvent[];
  readonly lastTransition: FsmTransition | null;
  readonly pendingEventIds: readonly string[];
  start(initialStateId?: string): void;
  reset(): void;
  sendEvent(eventId: string): void;
  pressButton(buttonId: string): void;
  step(): void;
  setStepMode(enabled: boolean): void;
  getCurrentScreen(): LcdScreen | null;
  getAvailableButtons(): ControlPanelButton[];
  isButtonAllowed(button: ControlPanelButton): boolean;
  getButtonBlockReason(button: ControlPanelButton): string | null;
}

export interface ProjectRuntimeEngineOptions {
  /** Dynamic instrument values used while evaluating FSM guards. */
  getGuardValues?: () => Readonly<Record<string, string | number | boolean | null>>;
}

export class ProjectRuntimeEngine implements RuntimeEngine {
  currentStateId: string | null = null;
  eventLog: RuntimeEvent[] = [];
  lastTransition: FsmTransition | null = null;
  pendingEventIds: string[] = [];
  private stepMode = false;
  private activeButtonId: string | null = null;

  constructor(
    private readonly project: LcdBitmapProject,
    private readonly options: ProjectRuntimeEngineOptions = {}
  ) {}

  start(initialStateId?: string): void {
    const initial = initialStateId
      ? this.project.fsm.states[initialStateId]
      : Object.values(this.project.fsm.states).find((state) => state.initial);
    this.currentStateId = initial?.id ?? this.project.fsm.stateOrder[0] ?? null;
    this.pendingEventIds = [];
    this.lastTransition = null;
    this.activeButtonId = null;
    this.eventLog = [];
    this.log('info', 'start', this.currentStateId ? `Runtime started at "${this.currentStateId}".` : 'Runtime cannot start: no FSM state.');
  }

  reset(): void {
    this.start();
  }

  setStepMode(enabled: boolean): void {
    this.stepMode = enabled;
    if (!enabled) {
      while (this.pendingEventIds.length > 0) {
        this.executeEvent(this.pendingEventIds.shift()!);
      }
    }
  }

  sendEvent(eventId: string): void {
    if (!this.project.fsm.events[eventId]) {
      this.log('error', 'error', `Unknown FSM event "${eventId}".`, { eventId });
      return;
    }
    this.log('info', 'event', `Event "${eventId}" received.`, { eventId });
    if (this.stepMode) {
      this.pendingEventIds.push(eventId);
      return;
    }
    this.executeEvent(eventId);
  }

  pressButton(buttonId: string): void {
    const element = this.project.controlPanel.elements[buttonId];
    if (!element || element.type !== 'button') {
      this.log('error', 'error', `Unknown control-panel button "${buttonId}".`);
      return;
    }
    this.log('info', 'button', `Button "${element.label || element.id}" pressed.`);
    const blockReason = this.getButtonBlockReason(element);
    if (blockReason) {
      this.log('warning', 'error', blockReason);
      return;
    }
    if (!element.fsmEventId) {
      this.log('warning', 'error', `Button "${element.id}" has no FSM event binding.`);
      return;
    }
    this.activeButtonId = element.id;
    this.sendEvent(element.fsmEventId);
    this.activeButtonId = null;
  }

  step(): void {
    const eventId = this.pendingEventIds.shift();
    if (!eventId) {
      this.log('info', 'event', 'No queued runtime event.');
      return;
    }
    this.executeEvent(eventId);
  }

  getCurrentScreen(): LcdScreen | null {
    const state = this.currentStateId ? this.project.fsm.states[this.currentStateId] : null;
    return state?.screenId ? this.project.screens[state.screenId] ?? null : null;
  }

  getAvailableButtons(): ControlPanelButton[] {
    return this.project.controlPanel.elementOrder
      .map((id) => this.project.controlPanel.elements[id])
      .filter((element): element is ControlPanelButton => element?.type === 'button' && element.visible);
  }

  isButtonAllowed(button: ControlPanelButton): boolean {
    return this.getButtonBlockReason(button) === null;
  }

  getButtonBlockReason(button: ControlPanelButton): string | null {
    if (!this.currentStateId) {
      return 'Button is unavailable: the runtime has no active state.';
    }
    if (button.disabledStates?.includes(this.currentStateId)) {
      return `Button "${button.id}" is disabled in state "${this.currentStateId}".`;
    }
    if (!button.fsmEventId) return `Button "${button.id}" has no FSM event binding.`;
    // A control is enabled only when this state has an executable transition
    // for its event. Empty allowedStates must never mean "enabled everywhere".
    const hasProgrammedTransition = this.project.fsm.transitionOrder.some((id) => {
      const transition = this.project.fsm.transitions[id];
      return transition?.from === this.currentStateId && transition.trigger.eventId === button.fsmEventId;
    });
    if (!hasProgrammedTransition) {
      return `Button "${button.id}" has no programmed transition from state "${this.currentStateId}".`;
    }
    if (button.allowedStates?.length && !button.allowedStates.includes(this.currentStateId)) {
      return `Button "${button.id}" is not enabled for state "${this.currentStateId}".`;
    }
    return null;
  }

  private executeEvent(eventId: string): void {
    if (!this.currentStateId) {
      this.log('error', 'error', 'Runtime has no active state.', { eventId });
      return;
    }
    // Fault transitions always pre-empt a manual or automatic request.  This
    // is intentionally evaluated only against routes declared for the active
    // state: a global event does not invent an unsafe target state when the
    // project has no matching route for that state.
    const faultTransition = eventId === 'SYS.ERR' ? null : this.findTransition('SYS.ERR');
    const transition = faultTransition ?? this.findTransition(eventId);
    if (!transition) {
      this.log('warning', 'error', `No transition from "${this.currentStateId}" for event "${eventId}".`, { eventId });
      return;
    }

    if (transition.condition) {
      this.log('info', 'condition', `Condition "${transition.condition}" accepted.`, {
        eventId,
        transitionId: transition.id
      });
    }
    const previousStateId = this.currentStateId;
    this.currentStateId = transition.to;
    this.lastTransition = transition;
    this.log('info', 'transition', `Transition "${transition.id}": ${previousStateId} -> ${transition.to}.`, {
      eventId: transition.trigger.eventId,
      transitionId: transition.id,
      stateId: transition.to
    });

    const backend = parseBackendBehaviorStorage(transition.backendProcessId);
    if (backend.kind === 'legacy-backend-process') {
      const process = this.project.backendProcesses[backend.processId];
      if (process) {
        this.log('info', 'backend', `Backend process "${process.name}" requested: ${process.commands.join(', ') || 'no commands'}.`, {
          backendProcessId: process.id,
          transitionId: transition.id
        });
      } else {
        this.log('error', 'error', `Missing backend process "${backend.processId}".`, {
          backendProcessId: backend.processId,
          transitionId: transition.id
        });
      }
    } else if (backend.kind === 'typed-effects') {
      this.log('info', 'backend', `Typed effects requested: ${backend.effects.map((effect) => effect.contractId).join(', ') || 'none'}.`, {
        backendProcessId: transition.backendProcessId ?? undefined,
        transitionId: transition.id
      });
    } else if (backend.kind === 'invalid') {
      this.log('error', 'error', `Invalid backend behavior storage on transition "${transition.id}".`, {
        backendProcessId: transition.backendProcessId ?? undefined,
        transitionId: transition.id
      });
    }
  }

  private isMechanismSatisfied(transition: FsmTransition): boolean {
    const mechanism = transition.trigger.mechanism ?? 'event';
    if (mechanism === 'button') {
      if (!transition.trigger.buttonId || transition.trigger.buttonId === this.activeButtonId) return true;
      // Imported FSMs often retain an older panel element id while the event
      // binding is still correct. A real virtual-key press must therefore be
      // accepted when its fsmEventId matches the transition event.
      const active = this.activeButtonId ? this.project.controlPanel.elements[this.activeButtonId] : null;
      return active?.type === 'button' && active.fsmEventId === transition.trigger.eventId;
    }
    return true;
  }

  private isConditionSatisfied(transition: FsmTransition, eventId: string): boolean {
    const expression = transition.condition || transition.trigger.fact;
    const activeButton = this.activeButtonId ? this.project.controlPanel.elements[this.activeButtonId] : null;
    const result = evaluateTypedGuard(expression ?? null, {
      event: eventId,
      button: activeButton?.type === 'button' ? activeButton.label : this.activeButtonId ?? '',
      button_id: this.activeButtonId ?? '',
      status: 'READY',
      value: 1,
      timeout_ms: transition.trigger.timerMs ?? 0,
      values: this.options.getGuardValues?.()
    });
    if (result.behavior.kind === 'invalid') {
      this.log('warning', 'condition', `Invalid typed guard on transition "${transition.id}".`, {
        eventId,
        transitionId: transition.id
      });
    }
    return result.matched;
  }

  private findTransition(eventId: string): FsmTransition | null {
    const candidates = this.project.fsm.transitionOrder
      .map((id) => this.project.fsm.transitions[id])
      .filter((candidate): candidate is FsmTransition =>
        Boolean(candidate) &&
        candidate.from === this.currentStateId &&
        candidate.trigger.eventId === eventId &&
        this.isMechanismSatisfied(candidate)
      );
    return candidates.find((candidate) => this.isConditionSatisfied(candidate, eventId)) ?? null;
  }

  private log(
    level: RuntimeLogLevel,
    type: RuntimeEvent['type'],
    message: string,
    details: Partial<RuntimeEvent> = {}
  ): void {
    this.eventLog.push({
      id: `runtime-${Date.now()}-${this.eventLog.length + 1}`,
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      stateId: details.stateId ?? this.currentStateId ?? undefined,
      eventId: details.eventId,
      transitionId: details.transitionId,
      backendProcessId: details.backendProcessId
    });
  }
}

export function createRuntimeEngine(project: LcdBitmapProject, options?: ProjectRuntimeEngineOptions): ProjectRuntimeEngine {
  return new ProjectRuntimeEngine(project, options);
}

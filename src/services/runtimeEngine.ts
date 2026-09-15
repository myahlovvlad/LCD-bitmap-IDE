import type {
  ControlPanelButton,
  FsmInputConfig,
  FsmTransition,
  LcdBitmapProject,
  LcdScreen
} from '../domain/project';
import { evaluateTypedGuard, parseBackendBehaviorStorage } from '../fsm-behavior';
import { hardwareNotificationKey, resolveHardwareNotification, type HardwareNotification } from './runtimeHardwareNotifications';

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

export interface RuntimeInputSession {
  stateId: string;
  mode: FsmInputConfig['mode'];
  value: string;
  maxLength: number;
}

export interface RuntimeInputCommit extends RuntimeInputSession {
  eventId: 'UI.OK';
}

export interface RuntimeEngine {
  readonly currentStateId: string | null;
  readonly eventLog: readonly RuntimeEvent[];
  readonly lastTransition: FsmTransition | null;
  readonly pendingEventIds: readonly string[];
  readonly inputSession: RuntimeInputSession | null;
  readonly lastInputCommit: RuntimeInputCommit | null;
  /** Active USB/printer/PC overlay, if any. Never reflected in `currentStateId`. */
  readonly hardwareNotification: HardwareNotification | null;
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
  /** Re-evaluates the hardware notification from the current tag snapshot; call after a monitored tag changes. */
  refreshHardwareNotification(): void;
  /** Dismisses the active notification and resumes the interrupted state without an FSM transition. */
  acknowledgeHardwareNotification(): void;
}

export interface ProjectRuntimeEngineOptions {
  /** Dynamic instrument values used while evaluating FSM guards. */
  getGuardValues?: () => Readonly<Record<string, string | number | boolean | null>>;
}

export type RuntimeButtonAvailabilityCode =
  | 'available'
  | 'no-active-state'
  | 'explicitly-disabled'
  | 'missing-event'
  | 'missing-transition'
  | 'state-not-allowed'
  | 'guard-rejected';

export interface RuntimeButtonAvailability {
  allowed: boolean;
  code: RuntimeButtonAvailabilityCode;
  message: string | null;
}

export function resolveRuntimeButtonAvailability(
  project: LcdBitmapProject,
  stateId: string | null,
  button: ControlPanelButton,
  values?: Readonly<Record<string, string | number | boolean | null>>
): RuntimeButtonAvailability {
  if (!stateId || !project.fsm.states[stateId]) {
    return blocked('no-active-state', 'Button is unavailable: the runtime has no active state.');
  }
  if (button.disabledStates?.includes(stateId)) {
    return blocked('explicitly-disabled', `Button "${button.id}" is disabled in state "${stateId}".`);
  }
  const eventId = button.fsmEventId;
  if (!eventId) return blocked('missing-event', `Button "${button.id}" has no FSM event binding.`);
  if (isRuntimeInputEvent(project.fsm.states[stateId].input, eventId)) {
    return { allowed: true, code: 'available', message: null };
  }
  const candidates = project.fsm.transitionOrder
    .map((id) => project.fsm.transitions[id])
    .filter((transition): transition is FsmTransition => (
      Boolean(transition) && transition.from === stateId && transition.trigger.eventId === eventId
    ));
  if (candidates.length === 0) {
    return blocked('missing-transition', `Button "${button.id}" has no programmed transition from state "${stateId}".`);
  }
  if (button.allowedStates?.length && !button.allowedStates.includes(stateId)) {
    return blocked('state-not-allowed', `Button "${button.id}" is not enabled for state "${stateId}".`);
  }
  const evaluations = candidates.map((transition) => {
    const expression = transition.condition || transition.trigger.fact;
    return {
      transition,
      result: evaluateTypedGuard(expression ?? null, {
        event: eventId,
        button: button.label,
        button_id: button.id,
        status: 'READY',
        value: 1,
        timeout_ms: transition.trigger.timerMs ?? 0,
        values
      })
    };
  });
  const invalid = evaluations.find(({ result }) => result.behavior.kind === 'invalid');
  if (invalid) {
    return blocked('guard-rejected', `Invalid typed guard on transition "${invalid.transition.id}".`);
  }
  if (!evaluations.some(({ result }) => result.matched)) {
    return blocked('guard-rejected', `Button "${button.id}" is blocked because every matching transition guard rejected the current values.`);
  }
  return { allowed: true, code: 'available', message: null };
}

function blocked(code: Exclude<RuntimeButtonAvailabilityCode, 'available'>, message: string): RuntimeButtonAvailability {
  return { allowed: false, code, message };
}

function isRuntimeInputEvent(config: FsmInputConfig | undefined, eventId: string): boolean {
  if (!config) return false;
  if (eventId === 'UI.CLR') return true;
  if (eventId === 'UI.DOT') return config.mode === 'numeric' && config.allowDecimal === true;
  if (eventId === 'UI.MINUS') return config.mode === 'numeric' && config.allowNegative === true;
  return phoneDigitForEvent(eventId) !== null;
}

export class ProjectRuntimeEngine implements RuntimeEngine {
  currentStateId: string | null = null;
  eventLog: RuntimeEvent[] = [];
  lastTransition: FsmTransition | null = null;
  pendingEventIds: string[] = [];
  private stepMode = false;
  private activeButtonId: string | null = null;
  inputSession: RuntimeInputSession | null = null;
  lastInputCommit: RuntimeInputCommit | null = null;
  private lastInputEventId: string | null = null;
  private lastInputAt = 0;
  hardwareNotification: HardwareNotification | null = null;
  private lastHardwareNotificationKey: string | null = null;

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
    this.lastInputCommit = null;
    this.openInputSession();
    this.eventLog = [];
    this.hardwareNotification = null;
    this.lastHardwareNotificationKey = null;
    this.log('info', 'start', this.currentStateId ? `Runtime started at "${this.currentStateId}".` : 'Runtime cannot start: no FSM state.');
  }

  /**
   * Re-derives the hardware overlay from the current tag snapshot. A no-op
   * unless the resolved equipment/present pair genuinely changed since the
   * last check, so acknowledging a notification does not immediately reopen
   * it from a tag value that has not moved (see runtimeHardwareNotifications.ts).
   */
  refreshHardwareNotification(): void {
    const resolved = resolveHardwareNotification(this.project, this.options.getGuardValues?.() ?? {}, this.currentStateId);
    const key = hardwareNotificationKey(resolved);
    if (key === this.lastHardwareNotificationKey) return;
    this.lastHardwareNotificationKey = key;
    this.hardwareNotification = resolved;
    if (resolved) {
      this.log('info', 'event', `Hardware notification opened: ${resolved.equipment} ${resolved.present ? 'present' : 'absent'}.`);
    }
  }

  acknowledgeHardwareNotification(): void {
    if (!this.hardwareNotification) return;
    this.log('info', 'event', `Hardware notification acknowledged: ${this.hardwareNotification.equipment}.`);
    this.hardwareNotification = null;
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
    if (this.applyPhoneInput(element.fsmEventId)) return;
    if (element.fsmEventId === 'UI.OK' && this.inputSession) this.commitInput();
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
    return resolveRuntimeButtonAvailability(
      this.project,
      this.currentStateId,
      button,
      this.options.getGuardValues?.()
    ).allowed;
  }

  getButtonBlockReason(button: ControlPanelButton): string | null {
    return resolveRuntimeButtonAvailability(
      this.project,
      this.currentStateId,
      button,
      this.options.getGuardValues?.()
    ).message;
  }

  isInputButtonEvent(eventId: string): boolean {
    return this.canEditWith(eventId);
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
    this.openInputSession();
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

  private openInputSession(): void {
    const config = this.currentStateId ? this.project.fsm.states[this.currentStateId]?.input : undefined;
    this.lastInputEventId = null;
    this.lastInputAt = 0;
    this.inputSession = config
      ? { stateId: this.currentStateId!, mode: config.mode, value: '', maxLength: config.maxLength ?? 16 }
      : null;
  }

  private canEditWith(eventId: string): boolean {
    const config = this.inputSession ? this.project.fsm.states[this.inputSession.stateId]?.input : undefined;
    return isRuntimeInputEvent(config, eventId);
  }

  private applyPhoneInput(eventId: string): boolean {
    const session = this.inputSession;
    if (!session || !this.canEditWith(eventId)) return false;
    if (eventId === 'UI.CLR') {
      session.value = session.value.slice(0, -1);
      this.lastInputEventId = null;
      this.lastInputAt = 0;
      return true;
    }
    if (session.mode === 'numeric') {
      const digit = phoneDigitForEvent(eventId);
      if (digit !== null) this.appendInput(digit);
      else if (eventId === 'UI.DOT' && !session.value.includes('.')) this.appendInput(session.value ? '.' : '0.');
      else if (eventId === 'UI.MINUS' && !session.value) this.appendInput('-');
      this.lastInputEventId = null;
      this.lastInputAt = 0;
      return true;
    }

    const digit = phoneDigitForEvent(eventId);
    if (digit === null) return false;
    const letters = PHONE_TEXT_KEYS[digit];
    const now = Date.now();
    const cycle = this.lastInputEventId === eventId && now - this.lastInputAt < 900 && session.value.length > 0;
    if (cycle) {
      const current = session.value.at(-1) ?? '';
      const next = letters[(letters.indexOf(current) + 1) % letters.length] ?? letters[0];
      session.value = `${session.value.slice(0, -1)}${next}`;
    } else {
      this.appendInput(letters[0]);
    }
    this.lastInputEventId = eventId;
    this.lastInputAt = now;
    return true;
  }

  private appendInput(value: string): void {
    if (!this.inputSession || this.inputSession.value.length >= this.inputSession.maxLength) return;
    this.inputSession.value += value;
  }

  commitInput(): void {
    if (!this.inputSession) return;
    this.lastInputCommit = { ...this.inputSession, eventId: 'UI.OK' };
    this.log('info', 'event', `Input "${this.inputSession.value}" committed.`, { eventId: 'UI.OK' });
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

const PHONE_TEXT_KEYS: Record<string, string> = {
  '0': ' ',
  '1': '1',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ'
};

function phoneDigitForEvent(eventId: string): string | null {
  const match = eventId.match(/^UI\.K([0-9])(?:[AB])?$/);
  return match ? match[1] : null;
}

export function createRuntimeEngine(project: LcdBitmapProject, options?: ProjectRuntimeEngineOptions): ProjectRuntimeEngine {
  return new ProjectRuntimeEngine(project, options);
}

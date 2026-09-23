import type { ControlPanelButton, FsmTransition, LcdBitmapProject, LcdScreen } from '../../domain/project';
import type { BackendProcedure, CliCommandDefinition } from '../../domain/procedure';
import type { ITransport } from './ITransport';
import type { AuditEntry } from './actionExecutor';
import { ProjectRuntimeEngine, type RuntimeEngine, type RuntimeEvent, type RuntimeInputCommit, type RuntimeInputSession } from '../runtimeEngine';
import type { HardwareNotification } from '../runtimeHardwareNotifications';
import { executeProcedure } from './actionExecutor';
import { MutableTagContext, defaultTagValues, type TagContext } from './TagContext';
import { evaluateTypedGuard, parseBackendBehaviorStorage, effectsFromTransition, RUNTIME_TAG_SET_EFFECT, RUNTIME_TAG_SET_FROM_INPUT_EFFECT, RUNTIME_TAG_INCREMENT_EFFECT, RUNTIME_TAG_COPY_EFFECT } from '../../fsm-behavior';
import { resolveLcdScreenBindings } from './resolveLcdBindings';
import { ECROS_5300_FORMULAS } from '../../spectrophotometer';
import { evaluatePortableFormula } from '../../domain/portableFormula';

export type ProcedureStatus = 'idle' | 'running' | 'success' | 'failure';

export interface OrchestratedTransitionState {
  transitionId: string;
  procedureId: string;
  status: ProcedureStatus;
  startedAt: string;
  finishedAt?: string;
  failureReason?: string;
  auditTrail: AuditEntry[];
}

export interface OrchestratedRuntimeOptions {
  transport: ITransport;
  /** Set true to skip procedure execution and commit state immediately (testing / nav-only). */
  bypassProcedures?: boolean;
}

/**
 * Wraps ProjectRuntimeEngine with typed BackendProcedure orchestration.
 *
 * Navigation transitions (no BackendProcedure in project.procedures) delegate
 * to the inner ProjectRuntimeEngine and commit state synchronously.
 *
 * Procedure transitions follow the 7-step flow:
 *   1. find transition  2. evaluate guard  3. build execution plan
 *   4. run procedure via ITransport  5. check postcondition
 *   6. atomically commit target state  7. on failure → failureTargetStateId
 */
export class OrchestratedRuntimeEngine implements RuntimeEngine {
  private readonly inner: ProjectRuntimeEngine;
  private readonly project: LcdBitmapProject;
  private readonly transport: ITransport;
  private readonly bypass: boolean;
  private activeButtonId: string | null = null;
  private inFlightProcedure: Promise<void> | null = null;

  readonly tags: TagContext;
  procedureStatus: ProcedureStatus = 'idle';
  lastProcedureRun: OrchestratedTransitionState | null = null;

  constructor(project: LcdBitmapProject, options: OrchestratedRuntimeOptions) {
    this.project = project;
    this.transport = options.transport;
    this.bypass = options.bypassProcedures ?? false;
    this.tags = new MutableTagContext(defaultTagValues(project.tags ?? {}));
    this.inner = new ProjectRuntimeEngine(project, {
      getGuardValues: () => this.tags.snapshot()
    });
  }

  // ---- RuntimeEngine interface (delegates to inner) ----

  get currentStateId(): string | null { return this.inner.currentStateId; }
  get eventLog(): readonly RuntimeEvent[] { return this.inner.eventLog; }
  get lastTransition(): FsmTransition | null { return this.inner.lastTransition; }
  get pendingEventIds(): readonly string[] { return this.inner.pendingEventIds; }
  get inputSession(): RuntimeInputSession | null { return this.inner.inputSession; }
  get lastInputCommit(): RuntimeInputCommit | null { return this.inner.lastInputCommit; }
  get hardwareNotification(): HardwareNotification | null { return this.inner.hardwareNotification; }

  start(initialStateId?: string): void { this.inner.start(initialStateId); }
  reset(): void { this.inner.reset(); this.procedureStatus = 'idle'; this.lastProcedureRun = null; }
  refreshHardwareNotification(): void { this.inner.refreshHardwareNotification(); }
  acknowledgeHardwareNotification(): void { this.inner.acknowledgeHardwareNotification(); }
  step(): void { this.inner.step(); }
  setStepMode(enabled: boolean): void { this.inner.setStepMode(enabled); }
  getCurrentScreen(): LcdScreen | null {
    this.refreshFormulaTags();
    const screen = this.inner.getCurrentScreen();
    return screen ? resolveLcdScreenBindings(screen, this.tags, this.project.tags ?? {}) : null;
  }
  getAvailableButtons(): ControlPanelButton[] { return this.inner.getAvailableButtons(); }
  isButtonAllowed(button: ControlPanelButton): boolean { return this.inner.isButtonAllowed(button); }
  getButtonBlockReason(button: ControlPanelButton): string | null { return this.inner.getButtonBlockReason(button); }

  /**
   * Synchronous sendEvent for backward compatibility.
   * If a BackendProcedure exists, launches it async-and-forget.
   * For navigation-only transitions, delegates to the inner engine (instant).
   */
  sendEvent(eventId: string): void {
    const { transition, procedure } = this.resolveEventTarget(eventId);
    // Timer/fact transitions represent instrument/runtime completion.  They
    // must advance the FSM immediately; a procedure attached for traceability
    // must not turn an automatic route into a blocked manual operation.
    const automatic = transition?.trigger.mechanism === 'timer' || transition?.trigger.mechanism === 'fact';
    if (procedure && !this.bypass && !automatic) {
      void this.runOrchestrated(transition!, procedure, eventId);
    } else {
      this.applyTypedEffects(transition);
      this.inner.sendEvent(eventId);
    }
  }

  pressButton(buttonId: string): void {
    const element = this.project.controlPanel.elements[buttonId];
    if (!element || element.type !== 'button') { this.inner.pressButton(buttonId); return; }
    if (!this.inner.isButtonAllowed(element)) { this.inner.pressButton(buttonId); return; }
    if (!element.fsmEventId) { this.inner.pressButton(buttonId); return; }
    if (this.inner.isInputButtonEvent(element.fsmEventId)) { this.inner.pressButton(buttonId); return; }
    const { transition, procedure } = this.resolveEventTarget(element.fsmEventId);
    const automatic = transition?.trigger.mechanism === 'timer' || transition?.trigger.mechanism === 'fact';
    // The base engine owns the active physical-button identity used to match
    // button-triggered FSM edges.  Delegate every navigation-only (or bypassed)
    // press to it instead of turning the press into a context-free event.
    if (!procedure || this.bypass || automatic) { this.applyTypedEffects(transition); this.inner.pressButton(buttonId); return; }
    if (element.fsmEventId === 'UI.OK' && this.inner.inputSession) this.inner.commitInput();
    this.activeButtonId = buttonId;
    this.sendEvent(element.fsmEventId);
    this.activeButtonId = null;
  }

  /**
   * Async sendEvent — awaits the full procedure lifecycle.
   * Preferred over sendEvent() when the caller needs to know when the
   * procedure completes and what the outcome was.
   */
  async sendEventAsync(eventId: string): Promise<void> {
    if (this.inFlightProcedure) {
      this.pushLog('warning', 'backend', `Event "${eventId}" dropped — a procedure is already running.`);
      return;
    }
    const { transition, procedure } = this.resolveEventTarget(eventId);
    const automatic = transition?.trigger.mechanism === 'timer' || transition?.trigger.mechanism === 'fact';
    if (procedure && !this.bypass && !automatic) {
      this.inFlightProcedure = this.runOrchestrated(transition!, procedure, eventId);
      try {
        await this.inFlightProcedure;
      } finally {
        this.inFlightProcedure = null;
      }
    } else {
      this.applyTypedEffects(transition);
      this.inner.sendEvent(eventId);
    }
  }

  get isExecutingProcedure(): boolean {
    return this.procedureStatus === 'running';
  }

  /**
   * Async pressButton — mirrors pressButton()'s exact routing (active-button
   * identity for guard evaluation, input-session commit, navigation-only
   * fast path) but awaits the full procedure lifecycle via sendEventAsync()
   * instead of firing it and forgetting. Used where a caller needs the
   * resulting state to be settled before continuing (e.g. scripted scenario
   * runs), the same way sendEventAsync() is preferred over sendEvent() there.
   */
  async pressButtonAsync(buttonId: string): Promise<void> {
    const element = this.project.controlPanel.elements[buttonId];
    if (!element || element.type !== 'button') { this.inner.pressButton(buttonId); return; }
    if (!this.inner.isButtonAllowed(element)) { this.inner.pressButton(buttonId); return; }
    if (!element.fsmEventId) { this.inner.pressButton(buttonId); return; }
    if (this.inner.isInputButtonEvent(element.fsmEventId)) { this.inner.pressButton(buttonId); return; }
    const { transition, procedure } = this.resolveEventTarget(element.fsmEventId);
    const automatic = transition?.trigger.mechanism === 'timer' || transition?.trigger.mechanism === 'fact';
    if (!procedure || this.bypass || automatic) { this.applyTypedEffects(transition); this.inner.pressButton(buttonId); return; }
    if (element.fsmEventId === 'UI.OK' && this.inner.inputSession) this.inner.commitInput();
    this.activeButtonId = buttonId;
    await this.sendEventAsync(element.fsmEventId);
    this.activeButtonId = null;
  }

  private refreshFormulaTags(): void {
    if (!this.project.dataSources?.['ecros.formulas']) {
      return;
    }
    for (const formula of ECROS_5300_FORMULAS) {
      const values: Record<string, number> = {};
      let complete = true;
      for (const dependency of formula.dependencies) {
        const value = this.tags.get(dependency);
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          complete = false;
          break;
        }
        values[dependency] = value;
      }
      if (!complete) continue;
      const result = evaluatePortableFormula(formula.expression, values);
      if (result.value !== null) {
        this.tags.set(formula.targetTagId, result.value);
      }
    }
  }

  // ---- Orchestration internals ----

  private async runOrchestrated(
    transition: FsmTransition,
    procedure: BackendProcedure,
    eventId: string
  ): Promise<void> {
    // Step 2: evaluate guard
    const guardPassed = this.evaluateGuard(transition, eventId);
    if (!guardPassed) {
      this.pushLog('warning', 'condition', `Guard failed for transition "${transition.id}" — event ignored.`);
      return;
    }

    const auditTrail: AuditEntry[] = [];
    const startedAt = new Date().toISOString();
    this.procedureStatus = 'running';
    this.lastProcedureRun = {
      transitionId: transition.id,
      procedureId: procedure.id,
      status: 'running',
      startedAt,
      auditTrail
    };
    this.pushLog('info', 'backend', `Procedure "${procedure.id}" executing (${transition.from} → ${transition.to}).`, { transitionId: transition.id });

    const cliCatalog: Record<string, CliCommandDefinition> = this.project.cliCatalog ?? {};

    // Steps 3–5: build plan, execute, check postcondition
    const result = await executeProcedure(procedure, {
      tags: this.tags,
      transport: this.transport,
      cliCatalog,
      onAudit: (entry) => {
        auditTrail.push(entry);
      }
    });

    const finishedAt = new Date().toISOString();

    if (result.outcome === 'success') {
      // Step 6: atomically commit target state
      this.procedureStatus = 'success';
      this.lastProcedureRun = { ...this.lastProcedureRun, status: 'success', finishedAt, auditTrail: result.auditTrail };
      const previousStateId = this.inner.currentStateId;
      this.inner.currentStateId = transition.to;
      this.inner.lastTransition = transition;
      this.pushLog('info', 'transition', `Committed: "${previousStateId}" → "${transition.to}".`, {
        eventId,
        transitionId: transition.id,
        stateId: transition.to
      });
    } else {
      // Step 7: failure routing
      this.procedureStatus = 'failure';
      this.lastProcedureRun = {
        ...this.lastProcedureRun,
        status: 'failure',
        finishedAt,
        failureReason: result.failureReason,
        auditTrail: result.auditTrail
      };
      const failureStateId = procedure.failureTargetStateId;
      if (failureStateId && this.project.fsm.states[failureStateId]) {
        this.inner.currentStateId = failureStateId;
        this.inner.lastTransition = transition;
        this.pushLog('warning', 'backend', `Procedure failed — routed to "${failureStateId}".`, { transitionId: transition.id });
      } else {
        this.pushLog('error', 'backend', `Procedure "${procedure.id}" failed (${result.failureReason ?? 'unknown'}) — state unchanged.`, { transitionId: transition.id });
      }
    }
  }

  private resolveEventTarget(eventId: string): { transition: FsmTransition | null; procedure: BackendProcedure | null } {
    const currentStateId = this.inner.currentStateId;
    if (!currentStateId) return { transition: null, procedure: null };

    // Multiple transitions can share the same (from, eventId) pair, branching
    // on `condition` (e.g. an io.usb_present true/false pair). Picking the
    // first array match regardless of condition — as this used to do — could
    // select the sibling whose guard doesn't actually hold for the current
    // tag state, silently misattributing that sibling's backendProcessId /
    // typed effects. Mirror the inner engine's findTransition: filter by
    // (from, eventId), then take the first candidate whose guard is satisfied.
    const candidates = this.project.fsm.transitionOrder
      .map((id) => this.project.fsm.transitions[id])
      .filter((t): t is FsmTransition =>
        Boolean(t) && t.from === currentStateId && t.trigger.eventId === eventId
      );
    const transition = candidates.find((t) => this.evaluateGuard(t, eventId)) ?? null;

    if (!transition?.backendProcessId) return { transition, procedure: null };

    const backend = parseBackendBehaviorStorage(transition.backendProcessId);
    if (backend.kind !== 'legacy-backend-process') return { transition, procedure: null };

    const procedure = (this.project.procedures ?? {})[backend.processId] ?? null;
    return { transition, procedure };
  }

  /**
   * Applies a transition's typed effects (currently only `runtime.tag.set`)
   * as it commits. Runs for navigation-only transitions right before the
   * state change is delegated to the inner engine, so a later guard reading
   * `this.tags` (e.g. a condition on the next transition out of the target
   * state) sees the write immediately.
   */
  private applyTypedEffects(transition: FsmTransition | null): void {
    if (!transition) return;
    for (const effect of effectsFromTransition(transition)) {
      if (effect.contractId === RUNTIME_TAG_SET_EFFECT) {
        const tagId = effect.args.tagId;
        const value = effect.args.value;
        if (typeof tagId !== 'string') continue;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
          this.tags.set(tagId, value);
        }
      } else if (effect.contractId === RUNTIME_TAG_SET_FROM_INPUT_EFFECT) {
        const tagId = effect.args.tagId;
        if (typeof tagId !== 'string') continue;
        const raw = this.inner.inputSession?.value;
        if (raw === undefined) continue;
        const parsed = Number(raw);
        this.tags.set(tagId, Number.isFinite(parsed) ? parsed : raw);
      } else if (effect.contractId === RUNTIME_TAG_INCREMENT_EFFECT) {
        const tagId = effect.args.tagId;
        if (typeof tagId !== 'string') continue;
        const by = typeof effect.args.by === 'number' && Number.isFinite(effect.args.by) ? effect.args.by : 1;
        const current = this.tags.get(tagId);
        const base = typeof current === 'number' && Number.isFinite(current) ? current : 0;
        this.tags.set(tagId, base + by);
      } else if (effect.contractId === RUNTIME_TAG_COPY_EFFECT) {
        const tagId = effect.args.tagId;
        const fromTagId = effect.args.fromTagId;
        if (typeof tagId !== 'string' || typeof fromTagId !== 'string') continue;
        this.tags.set(tagId, this.tags.get(fromTagId));
      }
    }
  }

  private evaluateGuard(transition: FsmTransition, eventId: string): boolean {
    const activeButton = this.activeButtonId
      ? this.project.controlPanel.elements[this.activeButtonId]
      : null;
    const expression = transition.condition || transition.trigger.fact;
    const { matched } = evaluateTypedGuard(expression ?? null, {
      event: eventId,
      button: activeButton?.type === 'button' ? activeButton.label : this.activeButtonId ?? '',
      button_id: this.activeButtonId ?? '',
      status: 'READY',
      value: 1,
      timeout_ms: transition.trigger.timerMs ?? 0,
      values: this.tags.snapshot()
    });
    return matched;
  }

  private pushLog(
    level: 'info' | 'warning' | 'error',
    type: RuntimeEvent['type'],
    message: string,
    details: Partial<RuntimeEvent> = {}
  ): void {
    (this.inner.eventLog as RuntimeEvent[]).push({
      id: `orch-${Date.now()}-${this.inner.eventLog.length + 1}`,
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      stateId: details.stateId ?? this.inner.currentStateId ?? undefined,
      eventId: details.eventId,
      transitionId: details.transitionId,
      backendProcessId: details.backendProcessId
    });
  }
}

export function createOrchestratedEngine(
  project: LcdBitmapProject,
  transport: ITransport,
  options: Partial<OrchestratedRuntimeOptions> = {}
): OrchestratedRuntimeEngine {
  return new OrchestratedRuntimeEngine(project, { transport, ...options });
}

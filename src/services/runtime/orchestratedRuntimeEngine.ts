import type { ControlPanelButton, FsmTransition, LcdBitmapProject, LcdScreen } from '../../domain/project';
import type { BackendProcedure, CliCommandDefinition } from '../../domain/procedure';
import type { ITransport } from './ITransport';
import type { AuditEntry } from './actionExecutor';
import { ProjectRuntimeEngine, type RuntimeEngine, type RuntimeEvent } from '../runtimeEngine';
import { executeProcedure } from './actionExecutor';
import { MutableTagContext, defaultTagValues, type TagContext } from './TagContext';
import { evaluateTypedGuard, parseBackendBehaviorStorage } from '../../fsm-behavior';

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
    this.inner = new ProjectRuntimeEngine(project);
    this.tags = new MutableTagContext(defaultTagValues(project.tags ?? {}));
  }

  // ---- RuntimeEngine interface (delegates to inner) ----

  get currentStateId(): string | null { return this.inner.currentStateId; }
  get eventLog(): readonly RuntimeEvent[] { return this.inner.eventLog; }
  get lastTransition(): FsmTransition | null { return this.inner.lastTransition; }
  get pendingEventIds(): readonly string[] { return this.inner.pendingEventIds; }

  start(initialStateId?: string): void { this.inner.start(initialStateId); }
  reset(): void { this.inner.reset(); this.procedureStatus = 'idle'; this.lastProcedureRun = null; }
  step(): void { this.inner.step(); }
  setStepMode(enabled: boolean): void { this.inner.setStepMode(enabled); }
  getCurrentScreen(): LcdScreen | null { return this.inner.getCurrentScreen(); }
  getAvailableButtons(): ControlPanelButton[] { return this.inner.getAvailableButtons(); }
  isButtonAllowed(button: ControlPanelButton): boolean { return this.inner.isButtonAllowed(button); }

  /**
   * Synchronous sendEvent for backward compatibility.
   * If a BackendProcedure exists, launches it async-and-forget.
   * For navigation-only transitions, delegates to the inner engine (instant).
   */
  sendEvent(eventId: string): void {
    const { transition, procedure } = this.resolveEventTarget(eventId);
    if (procedure && !this.bypass) {
      void this.runOrchestrated(transition!, procedure, eventId);
    } else {
      this.inner.sendEvent(eventId);
    }
  }

  pressButton(buttonId: string): void {
    const element = this.project.controlPanel.elements[buttonId];
    if (!element || element.type !== 'button') { this.inner.pressButton(buttonId); return; }
    if (!this.inner.isButtonAllowed(element)) { this.inner.pressButton(buttonId); return; }
    if (!element.fsmEventId) { this.inner.pressButton(buttonId); return; }
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
    if (procedure && !this.bypass) {
      this.inFlightProcedure = this.runOrchestrated(transition!, procedure, eventId);
      try {
        await this.inFlightProcedure;
      } finally {
        this.inFlightProcedure = null;
      }
    } else {
      this.inner.sendEvent(eventId);
    }
  }

  get isExecutingProcedure(): boolean {
    return this.procedureStatus === 'running';
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

    const transition = this.project.fsm.transitionOrder
      .map((id) => this.project.fsm.transitions[id])
      .find((t): t is FsmTransition =>
        Boolean(t) && t.from === currentStateId && t.trigger.eventId === eventId
      ) ?? null;

    if (!transition?.backendProcessId) return { transition, procedure: null };

    const backend = parseBackendBehaviorStorage(transition.backendProcessId);
    if (backend.kind !== 'legacy-backend-process') return { transition, procedure: null };

    const procedure = (this.project.procedures ?? {})[backend.processId] ?? null;
    return { transition, procedure };
  }

  private evaluateGuard(transition: FsmTransition, eventId: string): boolean {
    const activeButton = this.activeButtonId
      ? this.project.controlPanel.elements[this.activeButtonId]
      : null;
    const { matched } = evaluateTypedGuard(transition.condition ?? null, {
      event: eventId,
      button: activeButton?.type === 'button' ? activeButton.label : this.activeButtonId ?? '',
      button_id: this.activeButtonId ?? '',
      status: 'READY',
      value: 1,
      timeout_ms: transition.trigger.timerMs ?? 0
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

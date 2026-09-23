import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  CircleDot,
  HelpCircle,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Printer,
  RotateCcw,
  Route,
  Square,
  StepForward,
  Usb,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { FontRenderer } from '../../renderer/core/fonts';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { OrchestratedRuntimeEngine } from '../../services/runtime/orchestratedRuntimeEngine';
import { SimulationTransport } from '../../services/runtime/SimulationTransport';
import { Ecros5501SimulationTransport } from '../../spectrophotometer';
import type { OrchestratedTransitionState } from '../../services/runtime/orchestratedRuntimeEngine';
import type { RuntimeEvent } from '../../services/runtimeEngine';
import type { ControlPanelButton } from '../../domain/project';
import type { FsmTransition, LcdBitmapProject } from '../../domain/project';
import { ValidationPanel } from '../validation/ValidationPanel';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { registerRuntimeAutomationHandler } from '../../renderer/automation/runtimeAutomation';
import { resolveRuntimeTimerDelay, type RuntimeTimerMode } from './runtimeTimer';
import {
  INITIAL_RUNTIME_ANIMATION_CLOCK,
  advanceRuntimeAnimationClock,
  runtimeAnimationElapsedMs,
  screenHasAnimatedBitmap,
  type RuntimeAnimationClock
} from './runtimeAnimationClock';
import { resolveRuntimeButtonAvailability, type RuntimeButtonAvailabilityCode } from '../../services/runtimeEngine';
import { hardwareNotificationKey, type HardwareNotification } from '../../services/runtimeHardwareNotifications';
import type { HardwareEquipmentKind } from '../../domain/hardwareNotification';
import { RuntimeScenarioPanel } from './RuntimeScenarioPanel';

const HARDWARE_NOTIFICATION_POLL_MS = 200;

function hardwareEquipmentLabel(equipment: HardwareEquipmentKind, labels: UiText): string {
  const labelKey = {
    usb: 'hardwareNotificationUsb',
    printer: 'hardwareNotificationPrinter',
    pc: 'hardwareNotificationPc'
  } as const satisfies Record<HardwareEquipmentKind, keyof UiText>;
  return labels[labelKey[equipment]];
}

function hardwareEquipmentIcon(equipment: HardwareEquipmentKind): React.ReactElement {
  if (equipment === 'usb') return <Usb size={16} />;
  if (equipment === 'printer') return <Printer size={16} />;
  return <Monitor size={16} />;
}

type TransportKind = 'simulation';

function runtimeTransitionLabel(project: LcdBitmapProject, transition: FsmTransition): string {
  if (transition.labelMode === 'auto') return 'Auto';
  const button = transition.trigger.buttonId ? project.controlPanel.elements[transition.trigger.buttonId] : null;
  if (transition.labelMode === 'event') return project.fsm.events[transition.trigger.eventId]?.name ?? 'Auto';
  return button?.type === 'button' && button.label.trim() ? button.label : 'Auto';
}

export function RuntimeWorkspace(): React.ReactElement {
  const { project, language, fontGlyphs } = useProjectStore();
  const labels = UI_TEXT[language];

  const [revision, setRevision] = useState(0);
  const [stepMode, setStepMode] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [timerMode, setTimerMode] = useState<RuntimeTimerMode>('real');
  const [transportKind] = useState<TransportKind>('simulation');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'tags' | 'procedure' | 'scenario'>('log');
  const [showTutorial, setShowTutorial] = useState(false);
  const engineRef = useRef<OrchestratedRuntimeEngine | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const notifiedKeyRef = useRef<string | null>(null);
  const animationClockRef = useRef<RuntimeAnimationClock>(INITIAL_RUNTIME_ANIMATION_CLOCK);
  const animationRafRef = useRef<number | null>(null);
  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);
  const [timerSession, setTimerSession] = useState(0);
  const [timerNow, setTimerNow] = useState(0);
  const timerStartedAtRef = useRef<{ stateId: string; startedAtMs: number } | null>(null);

  const fontRenderer = useMemo(() => project ? new FontRenderer(fontGlyphs) : null, [project, fontGlyphs]);

  const buildEngine = useCallback(() => {
    if (!project) return null;
    const transport = project.dataSources?.['ecros.cli']
      ? new Ecros5501SimulationTransport({ startConnected: true })
      : new SimulationTransport(project.cliCatalog ?? {}, { timeScale: timerMode === 'express' ? 1 / 60 : 1 });
    return new OrchestratedRuntimeEngine(project, { transport, bypassProcedures: bypass });
  }, [project, bypass, timerMode]);

  useEffect(() => {
    const engine = buildEngine();
    if (!engine) return;
    engine.start();
    engineRef.current = engine;
    setRevision((r) => r + 1);
    return () => { engineRef.current = null; };
  }, [buildEngine]);

  useEffect(() => registerRuntimeAutomationHandler({
    fireEvent: (eventId) => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Runtime engine is not initialized');
      engine.sendEvent(eventId);
      setRevision((value) => value + 1);
    },
    setTag: (tagId, value) => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Runtime engine is not initialized');
      engine.tags.set(tagId, value);
      engine.refreshHardwareNotification();
      notifiedKeyRef.current = hardwareNotificationKey(engine.hardwareNotification);
      setRevision((r) => r + 1);
    },
    getState: () => ({
      currentStateId: engineRef.current?.currentStateId ?? null,
      isRunning: Boolean(engineRef.current),
      hardwareNotification: engineRef.current?.hardwareNotification ?? null
    })
  }), []);

  // Poll for hardware notifications (io.*_present tag changes) independent of
  // FSM-driven revisions, since the underlying tags can change outside of any
  // user action (procedures, transport updates). Only re-renders when the
  // resolved notification actually changes identity.
  useEffect(() => {
    const tick = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.refreshHardwareNotification();
      const key = hardwareNotificationKey(engine.hardwareNotification);
      if (key !== notifiedKeyRef.current) {
        notifiedKeyRef.current = key;
        setRevision((r) => r + 1);
      }
    };
    tick();
    const interval = window.setInterval(tick, HARDWARE_NOTIFICATION_POLL_MS);
    return () => window.clearInterval(interval);
  }, [project]);

  const runtimeStateId = engineRef.current?.currentStateId ?? null;

  // Auto-fire timer transitions and expose their remaining instrument time.
  // Timing is anchored to state entry rather than component renders, so a log
  // update or animation frame cannot restart a diagnostic warm-up countdown.
  useEffect(() => {
    const engine = engineRef.current;
    if (!project || !engine || !runtimeStateId || stepMode) {
      timerStartedAtRef.current = null;
      setTimerNow(0);
      return;
    }
    const timers = project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((t) =>
        t?.from === runtimeStateId &&
        t.trigger.mechanism === 'timer' &&
        Number.isFinite(t.trigger.timerMs) &&
        (t.trigger.timerMs ?? 0) > 0
      );
    if (timers.length === 0) {
      timerStartedAtRef.current = null;
      setTimerNow(0);
      return;
    }
    const now = performance.now();
    if (timerStartedAtRef.current?.stateId !== runtimeStateId) {
      timerStartedAtRef.current = { stateId: runtimeStateId, startedAtMs: now };
    }
    const startedAtMs = timerStartedAtRef.current.startedAtMs;
    setTimerNow(now);
    const handles = timers.map((t) =>
      window.setTimeout(() => {
        engine.sendEvent(t.trigger.eventId);
        setRevision((r) => r + 1);
      }, Math.max(0, resolveRuntimeTimerDelay(t.trigger.timerMs ?? 0, timerMode) - (now - startedAtMs)))
    );
    const interval = window.setInterval(() => setTimerNow(performance.now()), 100);
    return () => {
      handles.forEach((h) => window.clearTimeout(h));
      window.clearInterval(interval);
    };
  }, [project, runtimeStateId, stepMode, timerMode, timerSession]);

  // Scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [revision]);

  // Advance bitmap animations while the runtime shows a screen that has one
  // bound (LCDCanvas already knows how to render an animated frame given
  // elapsedMs + the project's animation catalog — see bytesForBitmap() in
  // renderer/utils/render.ts — it just never received a moving clock here).
  // Re-evaluated on every `revision` bump (the same signal every other FSM
  // transition/action already uses in this component) rather than on every
  // animation frame, so screen lookups + formula/tag binding resolution in
  // getCurrentScreen() stay at the app's normal update rate; only the rAF
  // loop itself — a plain elapsed-time tick — runs at frame rate, and only
  // while the current screen actually has something to animate.
  useEffect(() => {
    if (!project) return;
    const activeScreen = engineRef.current?.getCurrentScreen() ?? null;
    animationClockRef.current = advanceRuntimeAnimationClock(animationClockRef.current, activeScreen?.id ?? null, performance.now());
    if (!screenHasAnimatedBitmap(activeScreen, project.animations)) {
      return;
    }
    const tick = (): void => {
      setAnimationElapsedMs(runtimeAnimationElapsedMs(animationClockRef.current, performance.now()));
      animationRafRef.current = requestAnimationFrame(tick);
    };
    animationRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRafRef.current !== null) {
        cancelAnimationFrame(animationRafRef.current);
        animationRafRef.current = null;
      }
    };
  }, [project, revision]);

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const engine = engineRef.current;
  void revision;

  const screen = engine?.getCurrentScreen() ?? null;
  const buttons: ControlPanelButton[] = engine?.getAvailableButtons() ?? [];
  const currentStateId = engine?.currentStateId ?? null;
  const currentState = currentStateId ? project.fsm.states[currentStateId] : null;
  const eventLog: readonly RuntimeEvent[] = engine?.eventLog ?? [];
  const inputSession = engine?.inputSession ?? null;
  const lastProc: OrchestratedTransitionState | null = engine?.lastProcedureRun ?? null;
  const tagValues = Object.entries(engine?.tags?.snapshot() ?? {});
  const hardwareNotification: HardwareNotification | null = engine?.hardwareNotification ?? null;
  const notificationScreen = hardwareNotification ? project.screens[hardwareNotification.screenId] ?? null : null;
  const notificationReturnState = hardwareNotification ? project.fsm.states[hardwareNotification.returnStateId] ?? null : null;

  const refresh = (action: () => void) => { action(); setRevision((r) => r + 1); };

  const startAtState = (stateId?: string): void => {
    const newEngine = buildEngine();
    if (!newEngine) return;
    newEngine.start(stateId);
    engineRef.current = newEngine;
    timerStartedAtRef.current = null;
    setTimerSession((value) => value + 1);
    setRevision((r) => r + 1);
  };

  const handleReset = () => startAtState();

  const activeTimer = currentStateId && !stepMode
    ? project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((transition): transition is FsmTransition => Boolean(transition)
        && transition.from === currentStateId
        && transition.trigger.mechanism === 'timer'
        && (transition.trigger.timerMs ?? 0) > 0)
      .sort((left, right) => (left.trigger.timerMs ?? 0) - (right.trigger.timerMs ?? 0))[0]
    : undefined;
  const timerStartedAt = timerStartedAtRef.current?.stateId === currentStateId ? timerStartedAtRef.current.startedAtMs : null;
  const timerSpeed = timerMode === 'express' ? 60 : 1;
  const timerDurationMs = activeTimer?.trigger.timerMs ?? 0;
  const timerRemainingMs = activeTimer && timerStartedAt !== null
    ? Math.max(0, timerDurationMs - Math.max(0, timerNow - timerStartedAt) * timerSpeed)
    : 0;

  return (
    <section
      className="workspace-root runtime-workspace"
      style={{
        gridTemplateColumns: `${leftCollapsed ? 46 : 260}px 1fr ${rightCollapsed ? 46 : 300}px`
      }}
    >
      {/* Left sidebar: state info + buttons */}
      <aside className={`workspace-sidebar collapsible-sidebar${leftCollapsed ? ' collapsed' : ''}`}>
        <header className="workspace-section-header">
          {!leftCollapsed && <h2>{labels.runtimeCurrentState}</h2>}
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setLeftCollapsed((v) => !v)}
            aria-label={labels.toggleSidebar}
          >
            {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </header>

        {!leftCollapsed && (
          <>
            <div className="sidebar-content runtime-state-card inspector-card">
              <div className="runtime-state-name">
                <CircleDot size={14} className={engine?.isExecutingProcedure ? 'spin' : ''} />
                <strong>{currentState?.title ?? currentStateId ?? labels.runtimeNoState}</strong>
              </div>
              {currentState && (
                <small className="runtime-state-meta">
                  {currentState.stateType} · {currentState.subsystem}
                </small>
              )}
              <div className="runtime-transport-badge">
                {transportKind === 'simulation' ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span>{labels.runtimeTransportSim}</span>
                <span className="badge-dot connected" />
                {labels.runtimeConnected}
              </div>
              {inputSession && (
                <div className="runtime-input-buffer" data-mode={inputSession.mode}>
                  <small>{labels.runtimeInput} · {inputSession.mode === 'numeric' ? labels.runtimeInputNumeric : labels.runtimeInputText}</small>
                  <output>{inputSession.value || '▏'}</output>
                </div>
              )}
            </div>

            <div className="sidebar-content">
              <div className="workspace-section-header" style={{ padding: 0, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ide-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {labels.controlPanel}
                </span>
              </div>
              <div className="runtime-button-grid">
                {buttons.map((btn) => {
                  const availability = resolveRuntimeButtonAvailability(project, currentStateId, btn, engine?.tags.snapshot());
                  const reasonCode = engine?.isExecutingProcedure
                    ? 'procedure-running'
                    : hardwareNotification
                      ? 'hardware-notification'
                      : availability.code;
                  const allowed = availability.allowed && !engine?.isExecutingProcedure && !hardwareNotification;
                  const reason = allowed ? null : runtimeButtonReason(reasonCode, labels);
                  return (
                    <div key={btn.id} className="runtime-button-item" data-availability={reasonCode}>
                      <button
                        type="button"
                        className={`runtime-hw-btn${allowed ? '' : ' disabled'}`}
                        data-active={allowed ? 'true' : 'false'}
                        aria-label={`${btn.label}: ${allowed ? labels.runtimeButtonAvailable : reason}`}
                        disabled={!allowed}
                        onClick={() => allowed && refresh(() => engine?.pressButton(btn.id))}
                        title={reason ?? labels.runtimeButtonAvailable}
                      >
                        {btn.label}
                      </button>
                      {reason ? <small>{reason}</small> : null}
                    </div>
                  );
                })}
                {buttons.length === 0 && (
                  <p className="runtime-empty-hint">{labels.noControlElements}</p>
                )}
              </div>
            </div>

            <div className="sidebar-content">
              <ValidationPanel issues={project.validation.issues} labels={labels} />
            </div>
          </>
        )}
      </aside>

      {/* Main column: LCD display + toolbar */}
      <main className="workspace-canvas-column runtime-canvas-column">
        <header className="workspace-toolbar">
          <button
            type="button"
            className={engine?.isExecutingProcedure ? '' : 'active'}
            onClick={() => refresh(() => engine?.start())}
            disabled={!!engine?.isExecutingProcedure}
          >
            <Play size={15} />{labels.runtimeStart}
          </button>
          <button type="button" onClick={handleReset} disabled={!!engine?.isExecutingProcedure}>
            <RotateCcw size={15} />{labels.runtimeReset}
          </button>
          <button
            type="button"
            className={stepMode ? 'active' : ''}
            onClick={() => { setStepMode((v) => !v); engine?.setStepMode(!stepMode); }}
          >
            <Square size={14} />{labels.runtimeStepMode}
          </button>
          <button
            type="button"
            className={timerMode === 'express' ? 'active' : ''}
            onClick={() => setTimerMode((mode) => mode === 'real' ? 'express' : 'real')}
            title={labels.runtimeExpressTimerHint}
          >
            <Zap size={14} />{timerMode === 'express' ? labels.runtimeExpressTimerOn : labels.runtimeExpressTimer}
          </button>
          <span className="runtime-timer-status" data-testid="runtime-timer-status" data-mode={timerMode}>
            {timerMode === 'express' ? labels.runtimeTimerStatusExpress : labels.runtimeTimerStatusReal}
          </span>
          {stepMode && (
            <button
              type="button"
              onClick={() => refresh(() => engine?.step())}
              disabled={!!engine?.isExecutingProcedure}
            >
              <StepForward size={15} />{labels.runtimeStep}
            </button>
          )}
          <label className="runtime-bypass-toggle">
            <input
              type="checkbox"
              checked={bypass}
              onChange={(e) => setBypass(e.target.checked)}
            />
            <Zap size={13} />{labels.runtimeBypassProcedures}
          </label>
          {engine?.isExecutingProcedure && (
            <span className="runtime-running-badge">
              <Activity size={13} className="spin" /> {labels.runtimeRunning}
            </span>
          )}
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </header>

        <div className="runtime-lcd-stage">
          {screen && fontRenderer ? (
            <LCDCanvas
              canvasData={{
                stateId: screen.id,
                width: screen.width,
                height: screen.height,
                objects: screen.objects,
                selectedObjectIds: screen.selectedObjectIds,
                updatedAt: screen.updatedAt
              }}
              language={project.authoringLanguage ?? 'en'}
              fontRenderer={fontRenderer}
              animationCatalog={project.animations}
              elapsedMs={animationElapsedMs}
            />
          ) : (
            <div className="runtime-no-screen">
              <span>{currentState?.title ?? labels.runtimeNoState}</span>
              <small>{labels.noScreenLinked}</small>
            </div>
          )}

          {hardwareNotification && (
            <div className="runtime-hardware-overlay" role="alertdialog" aria-label={labels.hardwareNotificationAria}>
              {notificationScreen && fontRenderer ? (
                <div className="runtime-hardware-overlay-lcd">
                  <LCDCanvas
                    canvasData={{
                      stateId: notificationScreen.id,
                      width: notificationScreen.width,
                      height: notificationScreen.height,
                      objects: notificationScreen.objects,
                      selectedObjectIds: [],
                      updatedAt: notificationScreen.updatedAt
                    }}
                    language={project.authoringLanguage ?? 'en'}
                    fontRenderer={fontRenderer}
                    animationCatalog={project.animations}
                    elapsedMs={animationElapsedMs}
                  />
                </div>
              ) : null}
              <div className="runtime-hardware-overlay-meta">
                <div className="runtime-hardware-overlay-title">
                  {hardwareEquipmentIcon(hardwareNotification.equipment)}
                  <strong>{hardwareEquipmentLabel(hardwareNotification.equipment, labels)}</strong>
                  <span className={`runtime-hardware-overlay-status${hardwareNotification.present ? ' present' : ' absent'}`}>
                    {hardwareNotification.present ? labels.hardwareNotificationPresent : labels.hardwareNotificationAbsent}
                  </span>
                </div>
                <small>
                  {labels.hardwareNotificationReturnTo}: {notificationReturnState?.title ?? hardwareNotification.returnStateId}
                </small>
                <button
                  type="button"
                  className="runtime-hardware-overlay-ack"
                  onClick={() => refresh(() => engine?.acknowledgeHardwareNotification())}
                >
                  {labels.hardwareNotificationAcknowledge}
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTimer ? (
          <section className="runtime-countdown" aria-live="polite" data-testid="runtime-countdown">
            <div>
              <Route size={14} />
              <strong>{labels.runtimeTimerCountdown}</strong>
              <span>{runtimeTransitionLabel(project, activeTimer)}</span>
            </div>
            <output>{formatRuntimeDuration(timerRemainingMs)}</output>
            <progress value={Math.max(0, timerDurationMs - timerRemainingMs)} max={timerDurationMs} />
          </section>
        ) : null}

        {/* Available FSM events (for keyboard testing) */}
        <div className="runtime-event-chips">
          {project.fsm.transitionOrder
            .map((id) => project.fsm.transitions[id])
            .filter((t) => t?.from === currentStateId)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                className="runtime-event-chip"
                disabled={!!engine?.isExecutingProcedure || !!hardwareNotification}
                onClick={() => refresh(() => engine?.sendEvent(t.trigger.eventId))}
                title={`${labels.fsmEvent}: ${t.trigger.eventId} → ${t.to}`}
              >
                <ChevronRight size={12} />{runtimeTransitionLabel(project, t)}
              </button>
            ))
          }
        </div>
      </main>

      {/* Right panel: logs + tags */}
      <aside className={`workspace-inspector collapsible-sidebar${rightCollapsed ? ' collapsed' : ''}`}>
        <header className="workspace-section-header">
          {!rightCollapsed && (
            <div className="runtime-log-tabs">
              {(['log', 'tags', 'procedure', 'scenario'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'log' ? labels.runtimeEventLog : tab === 'tags' ? labels.runtimeTagValues : tab === 'procedure' ? labels.runtimeProcedureLog : labels.runtimeScenarios}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setRightCollapsed((v) => !v)}
            aria-label={labels.toggleInspector}
          >
            {rightCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </header>

        {!rightCollapsed && (
          <div className="sidebar-content runtime-log-panel">
            {activeTab === 'log' && (
              <div className="runtime-log-scroll">
                {eventLog.length === 0 && <p className="runtime-empty-hint">{labels.noEventsYet}</p>}
                {[...eventLog].reverse().map((entry) => (
                  <div key={entry.id} className={`runtime-log-entry log-${entry.level}`}>
                    <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className="log-type">{entry.type}</span>
                    <span className="log-msg">{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="runtime-tag-table">
                {tagValues.length === 0 && <p className="runtime-empty-hint">{labels.noTagsDefined}</p>}
                {tagValues.map(([id, val]) => (
                  <div key={id} className="runtime-tag-row">
                    <span className="tag-id">{id}</span>
                    <span className="tag-val">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'scenario' ? (
              <RuntimeScenarioPanel project={project} labels={labels} onStartAtState={startAtState} />
            ) : null}

            {activeTab === 'procedure' && (
              <div className="runtime-proc-panel">
                {!lastProc ? (
                  <p className="runtime-empty-hint">{labels.noProcedureExecutedYet}</p>
                ) : (
                  <>
                    <div className="inspector-card" style={{ marginBottom: 8 }}>
                      <div className="proc-status-row">
                        {lastProc.status === 'success' && <CheckCircle size={14} className="text-success" />}
                        {lastProc.status === 'failure' && <AlertTriangle size={14} className="text-danger" />}
                        {lastProc.status === 'running' && <Activity size={14} className="spin" />}
                        <strong>{lastProc.procedureId}</strong>
                        <span className={`proc-badge proc-${lastProc.status}`}>{lastProc.status}</span>
                      </div>
                      {lastProc.failureReason && (
                        <small className="text-danger">{lastProc.failureReason}</small>
                      )}
                      <small>{labels.transitionPrefix}: {lastProc.transitionId}</small>
                    </div>
                    <div className="runtime-log-scroll">
                      {lastProc.auditTrail.map((entry, i) => (
                        <div key={i} className={`runtime-log-entry log-${entry.ok ? 'info' : 'error'}`}>
                          <span className="log-time">#{entry.stepIndex} {entry.type}</span>
                          <span className="log-msg">{entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
      {showTutorial ? (
        <TutorialOverlay workspace="preview" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}

function runtimeButtonReason(
  code: RuntimeButtonAvailabilityCode | 'procedure-running' | 'hardware-notification',
  labels: UiText
): string {
  const reasons: Record<RuntimeButtonAvailabilityCode | 'procedure-running' | 'hardware-notification', string> = {
    available: labels.runtimeButtonAvailable,
    'no-active-state': labels.runtimeButtonNoState,
    'explicitly-disabled': labels.runtimeButtonExplicitlyDisabled,
    'missing-event': labels.runtimeButtonMissingEvent,
    'missing-transition': labels.runtimeButtonMissingTransition,
    'state-not-allowed': labels.runtimeButtonStateNotAllowed,
    'guard-rejected': labels.runtimeButtonGuardRejected,
    'procedure-running': labels.runtimeButtonProcedureRunning,
    'hardware-notification': labels.runtimeButtonHardwareNotification
  };
  return reasons[code];
}

function formatRuntimeDuration(valueMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, valueMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

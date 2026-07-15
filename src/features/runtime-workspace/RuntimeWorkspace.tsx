import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  CircleDot,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Square,
  StepForward,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { FontRenderer } from '../../renderer/core/fonts';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT } from '../../renderer/config/i18n';
import { OrchestratedRuntimeEngine } from '../../services/runtime/orchestratedRuntimeEngine';
import { SimulationTransport } from '../../services/runtime/SimulationTransport';
import type { OrchestratedTransitionState } from '../../services/runtime/orchestratedRuntimeEngine';
import type { RuntimeEvent } from '../../services/runtimeEngine';
import type { ControlPanelButton } from '../../domain/project';
import { ValidationPanel } from '../validation/ValidationPanel';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

type TransportKind = 'simulation';

export function RuntimeWorkspace(): React.ReactElement {
  const { project, language, fontGlyphs } = useProjectStore();
  const labels = UI_TEXT[language];

  const [revision, setRevision] = useState(0);
  const [stepMode, setStepMode] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [transportKind] = useState<TransportKind>('simulation');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'tags' | 'procedure'>('log');
  const [showTutorial, setShowTutorial] = useState(false);
  const engineRef = useRef<OrchestratedRuntimeEngine | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fontRenderer = useMemo(() => project ? new FontRenderer(fontGlyphs) : null, [project, fontGlyphs]);

  const buildEngine = useCallback(() => {
    if (!project) return null;
    const transport = new SimulationTransport(project.cliCatalog ?? {}, { timeScale: 1 });
    return new OrchestratedRuntimeEngine(project, { transport, bypassProcedures: bypass });
  }, [project, bypass]);

  useEffect(() => {
    const engine = buildEngine();
    if (!engine) return;
    engine.start();
    engineRef.current = engine;
    setRevision((r) => r + 1);
    return () => { engineRef.current = null; };
  }, [buildEngine]);

  // Auto-fire timer transitions
  useEffect(() => {
    const engine = engineRef.current;
    if (!project || !engine || !engine.currentStateId || stepMode) return;
    const timers = project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((t) =>
        t?.from === engine.currentStateId &&
        t.trigger.mechanism === 'timer' &&
        Number.isFinite(t.trigger.timerMs) &&
        (t.trigger.timerMs ?? 0) > 0
      );
    if (timers.length === 0) return;
    const handles = timers.map((t) =>
      window.setTimeout(() => {
        engine.sendEvent(t.trigger.eventId);
        setRevision((r) => r + 1);
      }, t.trigger.timerMs ?? 0)
    );
    return () => handles.forEach((h) => window.clearTimeout(h));
  }, [project, revision, stepMode]);

  // Scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [revision]);

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
  const lastProc: OrchestratedTransitionState | null = engine?.lastProcedureRun ?? null;
  const tagValues = Object.entries(engine?.tags?.snapshot() ?? {});

  const refresh = (action: () => void) => { action(); setRevision((r) => r + 1); };

  const handleReset = () => {
    const newEngine = buildEngine();
    if (!newEngine) return;
    newEngine.start();
    engineRef.current = newEngine;
    setRevision((r) => r + 1);
  };

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
            aria-label="Toggle sidebar"
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
            </div>

            <div className="sidebar-content">
              <div className="workspace-section-header" style={{ padding: 0, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ide-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {labels.controlPanel}
                </span>
              </div>
              <div className="runtime-button-grid">
                {buttons.map((btn) => {
                  const allowed = engine?.isButtonAllowed(btn) ?? false;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      className={`runtime-hw-btn${allowed ? '' : ' disabled'}`}
                      disabled={!allowed || engine?.isExecutingProcedure}
                      onClick={() => allowed && refresh(() => engine?.pressButton(btn.id))}
                      title={btn.label}
                    >
                      {btn.label}
                    </button>
                  );
                })}
                {buttons.length === 0 && (
                  <p className="runtime-empty-hint">{labels.noControlElements}</p>
                )}
              </div>
            </div>

            <div className="sidebar-content">
              <ValidationPanel issues={project.validation.issues} />
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
              <Activity size={13} className="spin" /> Running…
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
              language={language}
              fontRenderer={fontRenderer}
            />
          ) : (
            <div className="runtime-no-screen">
              <span>{currentState?.title ?? labels.runtimeNoState}</span>
              <small>{labels.noScreenLinked}</small>
            </div>
          )}
        </div>

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
                disabled={!!engine?.isExecutingProcedure}
                onClick={() => refresh(() => engine?.sendEvent(t.trigger.eventId))}
                title={`Event: ${t.trigger.eventId} → ${t.to}`}
              >
                <ChevronRight size={12} />{t.trigger.eventId}
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
              {(['log', 'tags', 'procedure'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'log' ? labels.runtimeEventLog : tab === 'tags' ? labels.runtimeTagValues : labels.runtimeProcedureLog}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setRightCollapsed((v) => !v)}
            aria-label="Toggle inspector"
          >
            {rightCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </header>

        {!rightCollapsed && (
          <div className="sidebar-content runtime-log-panel">
            {activeTab === 'log' && (
              <div className="runtime-log-scroll">
                {eventLog.length === 0 && <p className="runtime-empty-hint">No events yet.</p>}
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
                {tagValues.length === 0 && <p className="runtime-empty-hint">No tags defined.</p>}
                {tagValues.map(([id, val]) => (
                  <div key={id} className="runtime-tag-row">
                    <span className="tag-id">{id}</span>
                    <span className="tag-val">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'procedure' && (
              <div className="runtime-proc-panel">
                {!lastProc ? (
                  <p className="runtime-empty-hint">No procedure executed yet.</p>
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
                      <small>Transition: {lastProc.transitionId}</small>
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

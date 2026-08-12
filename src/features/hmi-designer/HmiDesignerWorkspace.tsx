import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Monitor, PanelTop, Play, Route, Settings2, Tags, Workflow } from 'lucide-react';
import { useWorkspaceRouter } from '../../app/WorkspaceRouter';
import type { ControlPanelButton } from '../../domain/project';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { FontRenderer } from '../../renderer/core/fonts';
import { UI_TEXT } from '../../renderer/config/i18n';
import { useProjectStore } from '../../renderer/store/projectStore';
import { createRuntimeEngine } from '../../services/runtimeEngine';

type HmiMode = 'design' | 'simulate' | 'runtime';

export function HmiDesignerWorkspace({ requestedStateId, requestedElementId }: { requestedStateId?: string; requestedElementId?: string }): React.ReactElement {
  const { project, language, fontGlyphs, selectedScreenId, selectScreen } = useProjectStore();
  const labels = UI_TEXT[language];
  const { navigate } = useWorkspaceRouter();
  const [mode, setMode] = useState<HmiMode>('design');
  const [activeStateId, setActiveStateId] = useState<string | null>(requestedStateId ?? null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(requestedElementId ?? null);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [contextButtonId, setContextButtonId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedStateId && project?.fsm.states[requestedStateId]) setActiveStateId(requestedStateId);
  }, [project, requestedStateId]);

  useEffect(() => {
    if (!project || activeStateId) return;
    setActiveStateId(project.fsm.stateOrder.find((id) => project.fsm.states[id]?.initial) ?? project.fsm.stateOrder[0] ?? null);
  }, [project, activeStateId]);

  // Runtime engine — recreated only when the project changes.
  const engine = useMemo(() => (project ? createRuntimeEngine(project) : null), [project]);

  const activeState = activeStateId && project ? project.fsm.states[activeStateId] : null;
  const screen = project && (activeState?.screenId ? project.screens[activeState.screenId] : project.screens[selectedScreenId ?? '']);
  const selectedElement = project?.controlPanel.elements[selectedElementId ?? ''] ?? null;

  const panelElements = useMemo(
    () => project?.controlPanel.elementOrder.map((id) => project.controlPanel.elements[id]).filter(Boolean) ?? [],
    [project],
  );
  const buttons = useMemo(
    () => panelElements.filter((element): element is ControlPanelButton => element.type === 'button' && element.visible),
    [panelElements],
  );

  // Allowed buttons — pure FSM-table lookup, no engine side-effects during render.
  const allowedButtonIds = useMemo<Set<string>>(() => {
    if (!project || !activeStateId) return new Set();
    const set = new Set<string>();
    for (const button of buttons) {
      if (!button.fsmEventId) continue;
      if (button.disabledStates?.includes(activeStateId)) continue;
      const hasRoute = project.fsm.transitionOrder.some((tid) => {
        const t = project.fsm.transitions[tid];
        return t?.from === activeStateId && t.trigger.eventId === button.fsmEventId;
      });
      if (hasRoute && (!button.allowedStates?.length || button.allowedStates.includes(activeStateId))) {
        set.add(button.id);
      }
    }
    return set;
  }, [project, activeStateId, buttons]);

  const relatedTransitions = useMemo(
    () =>
      !project || !selectedElement || selectedElement.type !== 'button'
        ? []
        : project.fsm.transitionOrder.map((id) => project.fsm.transitions[id]).filter((t) => t?.trigger.eventId === selectedElement.fsmEventId),
    [project, selectedElement],
  );
  const activeTransitions = useMemo(
    () => !project || !activeStateId
      ? []
      : project.fsm.transitionOrder
        .map((id) => project.fsm.transitions[id])
        .filter((transition) => transition?.from === activeStateId || transition?.to === activeStateId),
    [project, activeStateId]
  );
  const contextButton = contextButtonId ? buttons.find((button) => button.id === contextButtonId) ?? null : null;

  const fontRenderer = useMemo(() => new FontRenderer(fontGlyphs), [fontGlyphs]);

  if (!project) return <section className="workspace-empty">{labels.noProjectLoaded}</section>;

  const simulatePress = (button: ControlPanelButton): void => {
    if (!engine) return;
    // Sync engine to the currently displayed state before acting.
    engine.start(activeStateId ?? undefined);
    const blockReason = engine.getButtonBlockReason(button);
    if (blockReason) {
      setTimeline((items) => [`${button.label}: ${blockReason}`, ...items].slice(0, 32));
      return;
    }
    engine.pressButton(button.id);
    const completed = engine.lastTransition;
    if (completed) {
      const target = project.fsm.states[completed.to];
      setActiveStateId(completed.to);
      if (target?.screenId) selectScreen(target.screenId);
      const procedure = completed.backendProcessId ? project.backendProcesses[completed.backendProcessId] : null;
      setTimeline((items) => [
        `${button.label} → ${target?.title ?? completed.to}${procedure ? ` → ${procedure.name}` : ''}`,
        ...items,
      ].slice(0, 32));
    } else {
      setTimeline((items) => [`${button.label}: ${labels.hmiButtonNoTransition}`, ...items].slice(0, 32));
    }
  };

  // design: click=select only, dblclick=simulate
  // simulate: click=select+simulate
  const handleButtonClick = (button: ControlPanelButton): void => {
    setSelectedElementId(button.id);
    if (mode === 'simulate') simulatePress(button);
  };

  const handleButtonDoubleClick = (button: ControlPanelButton): void => {
    if (mode === 'design') simulatePress(button);
  };

  return (
    <section className={`workspace-root hmi-designer-workspace${rightCollapsed ? ' right-collapsed' : ''}`} aria-label={labels.hmiDesigner}>
      <header className="workspace-toolbar hmi-designer-toolbar">
        <strong>{labels.hmiDesigner}</strong>
        <button type="button" className={mode === 'design' ? 'active' : ''} onClick={() => setMode('design')}>
          <Settings2 size={15} />{labels.hmiDesignMode}
        </button>
        <button type="button" className={mode === 'simulate' ? 'active' : ''} onClick={() => setMode('simulate')}>
          <Play size={15} />{labels.hmiSimulateMode}
        </button>
        <button type="button" className={mode === 'runtime' ? 'active' : ''} onClick={() => { setMode('runtime'); navigate({ mode: 'runtime' }); }}>
          <Monitor size={15} />{labels.hmiRuntimeMode}
        </button>
        <button type="button" className={`hmi-coverage-btn${showCoverage ? ' active' : ''}`} onClick={() => setShowCoverage((v) => !v)} title={labels.hmiCoverageModeHint}>
          <Eye size={15} />{labels.hmiCoverageMode}
        </button>
        <span className="hmi-mode-hint">{mode === 'design' ? labels.hmiDesignModeHint : labels.hmiSelectToTrace}</span>
      </header>

      <aside className="hmi-designer-left inspector-card">
        <header><h2><PanelTop size={16} /> {labels.hmiInstrumentPanel}</h2></header>
        <div className="hmi-device-panel" style={{ background: project.controlPanel.backgroundColor }}>
          <div className="hmi-device-display">
            {screen
              ? <LCDCanvas canvasData={{ stateId: screen.id, width: screen.width, height: screen.height, objects: screen.objects, selectedObjectIds: [], updatedAt: screen.updatedAt }} language={language} scale={2} fontRenderer={fontRenderer} />
              : <span>{labels.hmiScreenNotAssigned}</span>}
          </div>
          <div className="hmi-device-buttons">
            {buttons.map((button) => {
              const allowed = allowedButtonIds.has(button.id);
              const disabledInMode = mode !== 'design' && !allowed;
              const coverageCls = showCoverage ? (allowed ? 'hmi-covered' : 'hmi-uncovered') : '';
              return (
                <button
                  key={button.id}
                  type="button"
                  className={[
                    button.id === selectedElementId ? 'active' : '',
                    coverageCls,
                    disabledInMode ? 'hmi-btn-disabled' : '',
                  ].filter(Boolean).join(' ')}
                  style={{
                    background: button.fillColor ?? project.controlPanel.tokens.buttonFill,
                    color: button.textColor ?? project.controlPanel.tokens.buttonText,
                    borderColor: button.strokeColor ?? project.controlPanel.tokens.buttonStroke,
                  }}
                  onClick={() => handleButtonClick(button)}
                  onDoubleClick={() => handleButtonDoubleClick(button)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedElementId(button.id);
                    setContextButtonId(button.id);
                  }}
                  aria-disabled={disabledInMode}
                  title={disabledInMode ? labels.hmiButtonDisabled : (button.description ?? button.label)}
                >
                  {button.label}
                </button>
              );
            })}
          </div>
        </div>
        <section className="hmi-state-strip">
          <strong>{activeState?.title ?? labels.hmiNoState}</strong>
          <small>{labels.hmiLayerLabel} {activeState?.subsystem ?? '—'}</small>
          <button type="button" onClick={() => activeState && navigate({ mode: 'fsm', stateId: activeState.id })}>
            <Workflow size={14} />{labels.hmiOpenFsm}
          </button>
        </section>
      </aside>

      <main className="hmi-designer-main inspector-card">
        <header><h2><Route size={16} /> {labels.hmiScenario}</h2></header>
        <ol className="hmi-timeline" aria-live="polite">
          {timeline.length
            ? timeline.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
            : <li>{labels.hmiSelectToTrace}</li>}
        </ol>
        <section className="hmi-tag-overview">
          <header><Tags size={15} /> {labels.hmiScreenTags}</header>
          {Object.values(project.tags ?? {}).slice(0, 12).map((tag) => (
            <span key={tag.id}>{tag.id}{tag.unit ? ` · ${tag.unit}` : ''}</span>
          ))}
          {!Object.keys(project.tags ?? {}).length ? <small>{labels.hmiNoTagsYet}</small> : null}
        </section>
      </main>

      <aside className={`hmi-designer-right inspector-card${rightCollapsed ? ' collapsed' : ''}`}>
        <header>
          <h2>{labels.hmiElementBindings}</h2>
          <button
            type="button"
            className="hmi-inspector-toggle"
            onClick={() => setRightCollapsed((v) => !v)}
            title={rightCollapsed ? labels.hmiInspectorExpand : labels.hmiInspectorCollapse}
          >
            {rightCollapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        </header>
        {!rightCollapsed && (
          selectedElement ? (
            <>
              <strong>{selectedElement.type === 'button' ? selectedElement.label : selectedElement.id}</strong>
              <small>{selectedElement.type}</small>
              {selectedElement.type === 'button' ? (
                <>
                  <p>{labels.hmiEventLabel} <code>{selectedElement.fsmEventId ?? labels.hmiNotAssigned}</code></p>
                  <p>{labels.hmipressTypeLabel} {selectedElement.pressType ?? 'short'}</p>
                  <button type="button" onClick={() => navigate({ mode: 'control-panel', elementId: selectedElement.id })}>
                    <PanelTop size={14} />{labels.hmiEditPanel}
                  </button>
                </>
              ) : null}
              <h3>{labels.hmiTransitions}</h3>
              {relatedTransitions.length
                ? relatedTransitions.map((transition) => (
                  <button key={transition.id} type="button" onClick={() => navigate({ mode: 'fsm', transitionId: transition.id })}>
                    {project.fsm.states[transition.from]?.title ?? transition.from} → {project.fsm.states[transition.to]?.title ?? transition.to}
                  </button>
                ))
                : <p>{labels.hmiNoRelatedTransitions}</p>}
              <h3>{activeState?.title ?? labels.hmiNoState}</h3>
              {activeTransitions.map((transition) => (
                <button key={`state-${transition.id}`} type="button" onClick={() => navigate({ mode: 'fsm', transitionId: transition.id })}>
                  <code>{transition.trigger.eventId}</code> · {transition.from === activeStateId ? transition.to : transition.from} · {transition.condition ?? transition.trigger.fact ?? '—'}
                </button>
              ))}
              {activeState?.screenId
                ? <button type="button" onClick={() => navigate({ mode: 'lcd', screenId: activeState.screenId! })}>
                  <ExternalLink size={14} />{labels.hmiOpenLcdScreen}
                </button>
                : null}
            </>
          ) : <p>{labels.hmiSelectElement}</p>
        )}
      </aside>
      {contextButton ? (
        <div className="hmi-context-menu" role="menu">
          <button type="button" onClick={() => { simulatePress(contextButton); setContextButtonId(null); }}>
            <Play size={14} />{labels.hmiSimulateMode}
          </button>
          <button type="button" onClick={() => { navigate({ mode: 'control-panel', elementId: contextButton.id }); setContextButtonId(null); }}>
            <PanelTop size={14} />{labels.hmiEditPanel}
          </button>
          <button type="button" onClick={() => setContextButtonId(null)}>{labels.cancel}</button>
        </div>
      ) : null}
    </section>
  );
}

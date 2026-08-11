import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  ReactFlow,
  getBezierPath,
  getSmoothStepPath,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes
} from '@xyflow/react';
import { Copy, Expand, HelpCircle, LayoutGrid, Minimize2, Monitor, Plus, Search, Trash2 } from 'lucide-react';
import { useWorkspaceRouter } from '../../app/WorkspaceRouter';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { StateNode } from '../../renderer/components/StateNode';
import { FontRenderer } from '../../renderer/core/fonts';
import { buildCompactGraphLayout } from '../../renderer/core/compactGraphLayout';
import { computeElkLayout, computeSwimlaneBounds, getSubsystemColor, getSubsystemLabel, type SubsystemBand } from '../../renderer/core/elkLayout';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { copyToClipboard } from '../../renderer/utils/clipboard';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { ControlPanelButton, FsmEvent, FsmState, FsmTransition, LcdBitmapProject } from '../../domain/project';
import { ValidationPanel } from '../validation/ValidationPanel';
import { FsmScriptStudio } from '../fsm-script/FsmScriptStudio';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { FsmWebGlGraph } from './FsmWebGlGraph';

/** Swimlane background band — rendered as a ReactFlow node at zIndex -1. */
function SwimlaneBandNode({ data }: { data: SubsystemBand }): React.ReactElement {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        background: data.color,
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 10,
        position: 'relative',
        pointerEvents: 'none'
      }}
    >
      <span style={{
        position: 'absolute',
        top: 8,
        left: 12,
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(148,163,184,0.7)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}>
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = { stateNode: StateNode, swimlaneBand: SwimlaneBandNode as unknown as NodeTypes[string] };
/** Right-angle (orthogonal) edge for ELK-laid-out graphs. */
function FsmTransitionOrthoEdge(props: EdgeProps): React.ReactElement {
  return <FsmTransitionEdge {...props} ortho />;
}

const edgeTypes: EdgeTypes = {
  fsmTransition: FsmTransitionEdge,
  fsmTransitionOrtho: FsmTransitionOrthoEdge,
};
const FSM_LAYOUT_KEY = 'lcd-bitmap-ide.workspace.fsm-layout.v1';
type CanvasPresentation = '2d' | '3d';
type LayoutTemplate = 'hierarchy' | 'tree' | 'lanes';

function edgeDisplayLabel(project: LcdBitmapProject, transition: FsmTransition): string {
  if (transition.labelMode === 'auto') return 'Auto';
  const button = transition.trigger.buttonId
    ? project.controlPanel.elements[transition.trigger.buttonId]
    : null;
  if (transition.labelMode === 'event') return project.fsm.events[transition.trigger.eventId]?.name ?? 'Auto';
  return button?.type === 'button' && button.label.trim() ? button.label : 'Auto';
}

interface FsmWorkspaceLayout {
  leftWidth: number;
  rightWidth: number;
}

interface SidebarResize {
  side: 'left' | 'right';
  startX: number;
  startWidth: number;
}

interface FsmContextMenu {
  x: number;
  y: number;
  stateId?: string;
  transitionId?: string;
}

export function FsmWorkspace({ requestedStateId }: { requestedStateId?: string }): React.ReactElement {
  const {
    project,
    session,
    selectedStateId,
    selectedTransitionId,
    fontGlyphs,
    language,
    selectState,
    selectTransition,
    addFsmState,
    updateFsmState,
    deleteFsmState,
    addFsmTransition,
    updateFsmTransition,
    deleteFsmTransition,
    addFsmEvent,
    updateFsmEvent,
    updateBackendProcess,
    updateGraphPosition,
    updateGraphPositions,
    ensureStateScreen,
    applyFsmScriptPreview
  } = useProjectStore();
  const { navigate } = useWorkspaceRouter();
  const [editing, setEditing] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [layout, setLayout] = useState<FsmWorkspaceLayout>(readFsmWorkspaceLayout);
  const [sidebarResize, setSidebarResize] = useState<SidebarResize | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [elkRunning, setElkRunning] = useState(false);
  const [swimlaneBands, setSwimlaneBands] = useState<SubsystemBand[]>([]);
  const [showSwimlanes, setShowSwimlanes] = useState(true);
  const [presentation, setPresentation] = useState<CanvasPresentation>('2d');
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>('hierarchy');
  const [contextMenu, setContextMenu] = useState<FsmContextMenu | null>(null);
  const [focusedSubsystem, setFocusedSubsystem] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { padding?: number; duration?: number }) => void } | null>(null);

  const toggleFullscreen = async (): Promise<void> => {
    const target = workspaceRef.current;
    if (!target) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen();
  };

  /** Run ELK LAYERED layout and apply positions + swimlane bands. */
  const runElkLayout = async (template: LayoutTemplate = layoutTemplate): Promise<void> => {
    if (!project || elkRunning) return;
    setElkRunning(true);
    try {
      const subsystemOf = (id: string): string =>
        project.fsm.states[id]?.subsystem ?? 'user';

      const flowNodes = project.fsm.stateOrder.map((id) => ({
        id,
        type: 'stateNode',
        position: project.fsm.graphLayout[id] ?? { x: 0, y: 0 },
        data: {}
      }));
      const flowEdges = project.fsm.transitionOrder.map((tid) => {
        const t = project.fsm.transitions[tid];
        return { id: tid, source: t.from, target: t.to };
      });

      const positions = await computeElkLayout(flowNodes, flowEdges, subsystemOf, {
        direction: template === 'tree' ? 'TB' : 'LR',
        nodeWidth: 220,
        nodeHeight: 72,
        paddingX: 80,
        paddingY: 60,
      });

      const layoutMap: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of positions) {
        layoutMap[id] = pos;
      }
      updateGraphPositions(layoutMap);

      const bands = computeSwimlaneBounds(positions, project.fsm.stateOrder, subsystemOf, 220, 72, 24);
      setSwimlaneBands(bands);
      setShowSwimlanes(true);
      // Fit viewport to show all nodes after layout
      globalThis.setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.1, duration: 600 }), 100);
    } catch (err) {
      console.error('ELK layout failed:', err);
    } finally {
      setElkRunning(false);
    }
  };

  const assign3dDepths = (): void => {
    if (!project) return;
    const subsystems = [...new Set(project.fsm.stateOrder.map((id) => project.fsm.states[id]?.subsystem ?? 'user'))].sort();
    const depthBySubsystem = new Map(subsystems.map((subsystem, index) => [subsystem, (index - (subsystems.length - 1) / 2) * 54]));
    const next = Object.fromEntries(project.fsm.stateOrder.map((id, index) => {
      const current = project.fsm.graphLayout[id] ?? { x: 0, y: 0 };
      const state = project.fsm.states[id];
      const typeOffset = state?.stateType === 'failure' ? 26 : state?.stateType === 'success' ? -18 : 0;
      return [id, { ...current, z: Math.round((depthBySubsystem.get(state?.subsystem ?? 'user') ?? 0) + typeOffset + ((index % 3) - 1) * 7) }];
    }));
    updateGraphPositions(next);
  };

  useEffect(() => {
    if (requestedStateId && project?.fsm.states[requestedStateId]) {
      selectState(requestedStateId);
    }
  }, [project, requestedStateId, selectState]);

  // Imported layouts are rendered with the same orthogonal routing as a newly
  // applied ELK template.  This avoids a visually different, crossing-prone
  // first render before the operator presses the layout command.
  useEffect(() => {
    if (!project) return;
    const positions = new Map<string, { x: number; y: number }>();
    for (const id of project.fsm.stateOrder) {
      const position = project.fsm.graphLayout[id];
      if (position) positions.set(id, position);
    }
    const subsystemOf = (id: string): string => project.fsm.states[id]?.subsystem ?? 'user';
    setSwimlaneBands(computeSwimlaneBounds(positions, project.fsm.stateOrder, subsystemOf, 220, 72, 24));
  }, [project]);

  useEffect(() => {
    localStorage.setItem(FSM_LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F11') return;
      event.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  const isVisibleOnCanvas = (stateId: string): boolean => !focusedSubsystem
    || project?.fsm.states[stateId]?.subsystem === focusedSubsystem
    || project?.fsm.states[stateId]?.initial === true;

  const calculatedNodes = useMemo<Node[]>(() => project
    ? project.fsm.stateOrder.filter(isVisibleOnCanvas).map((stateId) => {
        const state = project.fsm.states[stateId];
        const position = project.fsm.graphLayout[stateId] ?? { x: 80, y: 80 };
        return {
          id: stateId,
          type: 'stateNode',
          position: { x: position.x, y: position.y },
          selected: stateId === selectedStateId,
          data: { compact: true, showPreview: false, label: state.title }
        };
      })
    : [], [project, selectedStateId, focusedSubsystem]);
  const swimlaneNodes = useMemo<Node[]>(() => showSwimlanes
    ? swimlaneBands.filter((band) => !focusedSubsystem || band.subsystem === focusedSubsystem).map((band) => ({
        id: `__swimlane_${band.subsystem}`,
        type: 'swimlaneBand',
        position: { x: band.x, y: band.y },
        data: band as unknown as Record<string, unknown>,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: -1,
        style: { zIndex: -1 },
        width: band.width,
        height: band.height,
      }))
    : [], [showSwimlanes, swimlaneBands, focusedSubsystem]);

  const allNodes = useMemo<Node[]>(() => [...swimlaneNodes, ...calculatedNodes], [swimlaneNodes, calculatedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(allNodes);
  useEffect(() => setNodes(allNodes), [allNodes, setNodes]);

  const edges = useMemo<Edge[]>(() => {
    if (!project) {
      return [];
    }
    const transitions = project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((transition): transition is FsmTransition => Boolean(transition) && isVisibleOnCanvas(transition.from) && isVisibleOnCanvas(transition.to));
    // Pairs of opposite-direction transitions between the same two states would
    // otherwise render on top of each other (identical smoothstep geometry).
    // Detect mirrored pairs so each direction can be curved apart visually.
    const pairKey = (a: string, b: string): string => [a, b].sort().join('::');
    const pairCounts = new Map<string, number>();
    for (const transition of transitions) {
      if (transition.from === transition.to) {
        continue;
      }
      const key = pairKey(transition.from, transition.to);
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
    return transitions.map((transition) => {
      const isBidirectionalPair = transition.from !== transition.to
        && (pairCounts.get(pairKey(transition.from, transition.to)) ?? 0) > 1;
      return {
        id: transition.id,
        source: transition.from,
        target: transition.to,
        label: [
          edgeDisplayLabel(project, transition),
          transition.condition ? `[${transition.condition}]` : ''
        ].filter(Boolean).join(' '),
        type: 'fsmTransition',
        data: { curveSign: isBidirectionalPair ? (transition.from < transition.to ? 1 : -1) : 0 },
        sourceHandle: transition.sourceHandle ?? (transition.from === transition.to ? 's-right' : 's-right'),
        targetHandle: transition.targetHandle ?? (transition.from === transition.to ? 't-right' : 't-left'),
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: transition.id === selectedTransitionId
      };
    });
  }, [project, selectedTransitionId, focusedSubsystem]);

  const labels = UI_TEXT[language];
  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const selectedState = selectedStateId ? project.fsm.states[selectedStateId] : null;
  const selectedTransition = selectedTransitionId ? project.fsm.transitions[selectedTransitionId] : null;
  const selectedScreen = selectedState?.screenId ? project.screens[selectedState.screenId] : null;
  const activeButtons = Object.values(project.controlPanel.elements).filter((element): element is ControlPanelButton => {
    if (element.type !== 'button' || !element.fsmEventId) {
      return false;
    }
    return project.fsm.transitionOrder.some((id) => {
      const transition = project.fsm.transitions[id];
      return transition.from === selectedStateId && transition.trigger.eventId === element.fsmEventId;
    });
  });

  const handleConnect = (connection: Connection): void => {
    if (connection.source && connection.target) {
      const eventId = project.fsm.eventOrder.find((id) => {
        const candidate = project.fsm.events[id];
        return candidate?.scope !== 'state' || candidate.sourceStateId === connection.source;
      });
      addFsmTransition(connection.source, connection.target, eventId, {
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle
      });
    }
  };
  const duplicateState = (state: FsmState): void => {
    addFsmState();
    const newStateId = useProjectStore.getState().selectedStateId;
    if (!newStateId) return;
    updateFsmState(newStateId, {
      title: `${state.title} — копия`, subsystem: state.subsystem,
      stateType: state.stateType, screenId: null, initial: false, terminal: false
    });
    selectState(newStateId);
  };
  const visibleStateIds = project.fsm.stateOrder.filter((stateId) => {
    const state = project.fsm.states[stateId];
    const query = stateSearch.trim().toLowerCase();
    return !query || state.title.toLowerCase().includes(query) || state.id.toLowerCase().includes(query);
  });
  const updateSidebarResize = (event: React.PointerEvent<HTMLElement>): void => {
    if (!sidebarResize) {
      return;
    }
    const delta = event.clientX - sidebarResize.startX;
    setLayout((current) => sidebarResize.side === 'left'
      ? { ...current, leftWidth: clampSidebarWidth(sidebarResize.startWidth + delta, 190, 520) }
      : { ...current, rightWidth: clampSidebarWidth(sidebarResize.startWidth - delta, 260, 620) });
  };

  return (
    <section
      ref={workspaceRef}
      className={`workspace-root fsm-workspace fsm-workspace-resizable${isFullscreen ? ' fsm-fullscreen' : ''}`}
      aria-label={labels.fsmEditor}
      data-testid="fsm-workspace"
      style={{ gridTemplateColumns: `${layout.leftWidth}px 6px minmax(430px, 1fr) 6px ${layout.rightWidth}px` }}
      onPointerMove={updateSidebarResize}
      onPointerUp={() => setSidebarResize(null)}
      onPointerCancel={() => setSidebarResize(null)}
    >
      <aside className="workspace-sidebar">
        <header className="workspace-section-header">
          <h2>{labels.states}</h2>
          <button type="button" onClick={addFsmState} title={labels.addState} data-testid="fsm-add-state"><Plus size={16} /></button>
        </header>
        <div className="sidebar-search">
          <Search size={14} />
          <input
            value={stateSearch}
            onChange={(event) => setStateSearch(event.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
          />
        </div>
        <div className="entity-list">
          {visibleStateIds.map((stateId) => {
            const state = project.fsm.states[stateId];
            return (
              <article key={stateId} className={stateId === selectedStateId ? 'entity-card active' : 'entity-card'} data-testid={`fsm-state-card-${stateId}`}>
                <button
                  type="button"
                  className="entity-row"
                  data-testid={`fsm-state-select-${stateId}`}
                  onClick={() => selectState(stateId)}
                >
                  <strong>{state.title}</strong>
                  <small>{state.id}</small>
                </button>
                <div>
                  <button type="button" onClick={() => void copyToClipboard(state.id)} title={labels.copyId}>
                    <Copy size={14} />
                  </button>
                  <button type="button" onClick={() => deleteFsmState(stateId)} title={labels.delete}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <button type="button" className={showScripts ? 'workspace-tool active' : 'workspace-tool'} onClick={() => setShowScripts((value) => !value)} data-testid="fsm-open-script-studio">
          {labels.fsmScripts}
        </button>
        <ValidationPanel
          issues={project.validation.issues}
          domain="fsm"
          title={labels.fsmValidation}
          labels={labels}
          defaultCollapsed
          onSelectEntity={(entityType, entityId) => {
            if (entityType === 'state') {
              selectState(entityId);
            } else if (entityType === 'transition') {
              selectTransition(entityId);
            }
          }}
          onFixInitialState={() => {
            const candidateId =
              project.fsm.stateOrder.find((id) => /main|home|init|start/i.test(id)) ?? project.fsm.stateOrder[0];
            if (candidateId) {
              updateFsmState(candidateId, { initial: true });
              selectState(candidateId);
            }
          }}
        />
      </aside>

      <div
        className="workspace-splitter"
        role="separator"
        aria-label={labels.resizeFsmStates}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'left', startX: event.clientX, startWidth: layout.leftWidth });
        }}
      />

      <main className="workspace-canvas-column">
        <header className="workspace-toolbar">
          <button type="button" className={editing ? 'active' : ''} onClick={() => setEditing((value) => !value)}>
            {labels.editGraph}
          </button>
          <button
            type="button"
            onClick={() => updateGraphPositions(buildCompactGraphLayout(project.fsm.stateOrder, legacyStateMap(project.fsm.states)))}
          >
            <LayoutGrid size={16} /> {labels.autoArrange}
          </button>
          <button
            type="button"
            className={elkRunning ? 'active' : ''}
            disabled={elkRunning}
            onClick={() => void runElkLayout(layoutTemplate)}
            title={labels.elkLayoutTip}
          >
            <LayoutGrid size={16} />
            {elkRunning ? 'ELK…' : 'ELK Layout'}
          </button>
          <label className="fsm-layout-template">
            <span>Шаблон</span>
            <select value={layoutTemplate} onChange={(event) => setLayoutTemplate(event.target.value as LayoutTemplate)}>
              <option value="hierarchy">Иерархия L→R</option>
              <option value="tree">Дерево T→B</option>
              <option value="lanes">Дорожки модулей</option>
            </select>
          </label>
          <button type="button" className={presentation === '3d' ? 'active' : ''} onClick={() => {
            if (presentation === '2d') { assign3dDepths(); setPresentation('3d'); }
            else setPresentation('2d');
          }}>
            {presentation === '2d' ? '3D' : '2D'}
          </button>
          {presentation === '3d' ? <button type="button" onClick={assign3dDepths} title="Распределить подсистемы по оси Z">Глубина Z</button> : null}
          <button type="button" onClick={() => void toggleFullscreen()} title="На весь экран (F11)" data-testid="fsm-fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Expand size={16} />}
            {isFullscreen ? 'Окно' : 'На весь экран'}
          </button>
          {focusedSubsystem ? (
            <button type="button" onClick={() => setFocusedSubsystem(null)}>Все ветви</button>
          ) : null}
          {showSwimlanes ? (
            <button type="button" className="active" onClick={() => setShowSwimlanes(false)} title={labels.hideSubsystems}>
              {labels.swimlanes} ✓
            </button>
          ) : null}
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </header>
        {showScripts ? (
          session ? (
            <FsmScriptStudio
              session={session}
              language={language}
              onApplyPreview={applyFsmScriptPreview}
            />
          ) : null
        ) : (
          <section className={`fsm-canvas fsm-canvas-${presentation}`}>
            {presentation === '3d' ? (
              <>
                <FsmWebGlGraph
                  states={project.fsm.states}
                  stateIds={project.fsm.stateOrder.filter(isVisibleOnCanvas)}
                  transitions={project.fsm.transitionOrder.map((id) => project.fsm.transitions[id]).filter((transition): transition is FsmTransition => Boolean(transition) && isVisibleOnCanvas(transition.from) && isVisibleOnCanvas(transition.to))}
                  positions={project.fsm.graphLayout}
                  selectedStateId={selectedStateId}
                  onSelectState={selectState}
                />
                {selectedState ? (
                  <label className="fsm-webgl-depth-control">
                    <span>Z · {selectedState.title}</span>
                    <input
                      type="number"
                      step={1}
                      value={project.fsm.graphLayout[selectedState.id]?.z ?? 0}
                      onChange={(event) => updateGraphPosition(selectedState.id, { ...(project.fsm.graphLayout[selectedState.id] ?? { x: 0, y: 0 }), z: Number(event.target.value) || 0 })}
                    />
                  </label>
                ) : null}
              </>
            ) : <ReactFlow
              nodes={nodes}
              edges={edges.map((e) => ({ ...e, type: showSwimlanes ? 'fsmTransitionOrtho' : 'fsmTransition' }))}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              onNodesChange={onNodesChange}
              onConnect={handleConnect}
              onNodeClick={(_, node) => selectState(node.id)}
              onEdgeClick={(_, edge) => selectTransition(edge.id)}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY, stateId: node.id });
              }}
              onEdgeContextMenu={(event, edge) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY, transitionId: edge.id });
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY });
              }}
              onPaneClick={() => setContextMenu(null)}
              onInit={(instance) => { reactFlowInstanceRef.current = instance as { fitView: (opts?: { padding?: number; duration?: number }) => void }; }}
              onNodeDragStop={(_, node) => updateGraphPosition(node.id, node.position)}
              nodesConnectable={editing}
              nodesDraggable
              fitView
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(node) => getSubsystemColor(project.fsm.states[node.id]?.subsystem ?? 'user')} />
            </ReactFlow>}
          </section>
        )}
      </main>

      {contextMenu ? (
        <div
          className="fsm-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenu.stateId && project.fsm.states[contextMenu.stateId] ? (() => {
            const state = project.fsm.states[contextMenu.stateId];
            return <>
              <button type="button" role="menuitem" onClick={() => { selectState(state.id); setContextMenu(null); }}>Изменить состояние</button>
              <button type="button" role="menuitem" onClick={() => { ensureStateScreen(state.id); selectState(state.id); setContextMenu(null); }}>Создать/открыть экран</button>
              <button type="button" role="menuitem" onClick={() => { void copyToClipboard(state.id); setContextMenu(null); }}>Копировать ID</button>
              <button type="button" role="menuitem" onClick={() => { duplicateState(state); setContextMenu(null); }}>Дублировать</button>
              <button type="button" role="menuitem" onClick={() => { setFocusedSubsystem(state.subsystem); setContextMenu(null); }}>Показать ветвь «{state.subsystem}»</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { deleteFsmState(state.id); setContextMenu(null); }}>Удалить</button>
            </>;
          })() : null}
          {contextMenu.transitionId && project.fsm.transitions[contextMenu.transitionId] ? (
            <>
              <button type="button" role="menuitem" onClick={() => { selectTransition(contextMenu.transitionId!); setContextMenu(null); }}>Изменить переход и подпись</button>
              <button type="button" role="menuitem" onClick={() => { void copyToClipboard(contextMenu.transitionId!); setContextMenu(null); }}>Копировать ID</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { deleteFsmTransition(contextMenu.transitionId!); setContextMenu(null); }}>Удалить</button>
            </>
          ) : null}
          {!contextMenu.stateId && !contextMenu.transitionId ? (
            <>
              <button type="button" role="menuitem" onClick={() => { addFsmState(); setContextMenu(null); }}>Добавить состояние</button>
              <button type="button" role="menuitem" onClick={() => { void runElkLayout('tree'); setContextMenu(null); }}>Выстроить вертикальное дерево</button>
              <button type="button" role="menuitem" onClick={() => { setFocusedSubsystem(null); setContextMenu(null); }}>Показать все ветви</button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className="workspace-splitter"
        role="separator"
        aria-label={labels.resizeFsmInspector}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'right', startX: event.clientX, startWidth: layout.rightWidth });
        }}
      />

      <aside className="workspace-inspector">
        {selectedTransition ? (
          <TransitionInspector
            transition={selectedTransition}
            labels={labels}
            onUpdate={(updates) => updateFsmTransition(selectedTransition.id, updates)}
            onDelete={() => deleteFsmTransition(selectedTransition.id)}
            onCreateEvent={(name) => {
              addFsmEvent(name, { scope: 'state', sourceStateId: selectedTransition.from });
              const newEventId = useProjectStore.getState().project?.fsm.eventOrder.at(-1);
              if (newEventId) {
                updateFsmTransition(selectedTransition.id, { trigger: { ...selectedTransition.trigger, eventId: newEventId } });
              }
            }}
            onRenameEvent={(eventId, name) => updateFsmEvent(eventId, { name })}
            onUpdateEvent={(eventId, updates) => updateFsmEvent(eventId, updates)}
            onUpdateBackendDescription={(processId, description) => updateBackendProcess(processId, { description })}
          />
        ) : selectedState ? (
          <>
            <StateInspector
              state={selectedState}
              labels={labels}
              onUpdate={(updates) => updateFsmState(selectedState.id, updates)}
              onDelete={() => deleteFsmState(selectedState.id)}
            />
            <RouteEditor
              labels={labels}
              currentStateId={selectedState.id}
              states={project.fsm.states}
              stateOrder={project.fsm.stateOrder}
              eventOrder={project.fsm.eventOrder.filter((eventId) => {
                const event = project.fsm.events[eventId];
                return event?.scope !== 'state' || event.sourceStateId === selectedState.id;
              })}
              eventNames={Object.fromEntries(project.fsm.eventOrder.map((eventId) => [
                eventId,
                project.fsm.events[eventId]?.name ?? eventId
              ]))}
              onAddRoute={(targetStateId, eventId, direction, condition) => {
                addFsmTransition(selectedState.id, targetStateId, eventId);
                const created = useProjectStore.getState().project?.fsm.transitionOrder.at(-1);
                if (created) {
                  updateFsmTransition(created, { kind: condition ? 'guarded' : 'navigation', condition: condition || null });
                }
                if (direction === 'two-way') {
                  addFsmTransition(targetStateId, selectedState.id, eventId);
                  const reverse = useProjectStore.getState().project?.fsm.transitionOrder.at(-1);
                  if (reverse) {
                    updateFsmTransition(reverse, { kind: condition ? 'guarded' : 'navigation', condition: condition || null });
                  }
                }
              }}
            />
            <section className="reference-preview">
              <header>
                <h3>{labels.linkedLcdScreen}</h3>
                <button
                  type="button"
                  onClick={() => {
                    const screenId = ensureStateScreen(selectedState.id);
                    if (screenId) {
                      navigate({ mode: 'lcd', screenId });
                    }
                  }}
                >
                  <Monitor size={15} /> {labels.editLayout}
                </button>
              </header>
              {selectedScreen ? (
                <div className="lcd-editor-frame">
                  <LCDCanvas
                    canvasData={{
                      stateId: selectedScreen.id,
                      width: selectedScreen.width,
                      height: selectedScreen.height,
                      objects: selectedScreen.objects,
                      selectedObjectIds: [],
                      updatedAt: selectedScreen.updatedAt
                    }}
                    language={language}
                    scale={3}
                    fontRenderer={new FontRenderer(fontGlyphs)}
                    className="lcd-canvas"
                  />
                </div>
              ) : <p>{labels.noScreenLinked}</p>}
              <div className="reference-buttons">
                <strong>{labels.activeButtons}</strong>
                {activeButtons.length > 0
                  ? activeButtons.map((button) => <span key={button.id}>{button.label}</span>)
                  : <small>{labels.noButtonsTrigger}</small>}
              </div>
            </section>
          </>
        ) : <p>{labels.selectStateOrTransition}</p>}
      </aside>
      {showTutorial ? (
        <TutorialOverlay workspace="fsm" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}

function FsmTransitionEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  label,
  data,
  ortho = false,
}: EdgeProps & { ortho?: boolean }): React.ReactElement {
  const isSelfLoop = source === target;
  const curveSign = (data as { curveSign?: number } | undefined)?.curveSign ?? 0;
  const [edgePath, labelX, labelY] = isSelfLoop
    ? [buildSelfLoopPath(sourceX, sourceY), sourceX + 86, sourceY - 64]
    : ortho
      ? getSmoothStepPath({
          sourceX, sourceY, sourcePosition,
          targetX, targetY, targetPosition,
          borderRadius: 0   // 0 = fully orthogonal right-angle turns
        })
      : curveSign !== 0
        ? getBezierPath({
            sourceX, sourceY, sourcePosition,
            targetX, targetY, targetPosition,
            curvature: 0.35 * curveSign
          })
        : getSmoothStepPath({
            sourceX, sourceY, sourcePosition,
            targetX, targetY, targetPosition,
            borderRadius: 16
          });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={selected ? 'fsm-edge fsm-edge-selected' : 'fsm-edge'}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="fsm-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function buildSelfLoopPath(sourceX: number, sourceY: number): string {
  const right = sourceX + 92;
  const top = sourceY - 72;
  const bottom = sourceY + 44;
  return `M ${sourceX} ${sourceY} C ${right} ${sourceY}, ${right} ${top}, ${sourceX + 18} ${top} C ${right + 32} ${top}, ${right + 32} ${bottom}, ${sourceX} ${bottom}`;
}

function StateInspector({
  state,
  labels,
  onUpdate,
  onDelete
}: {
  state: FsmState;
  labels: UiText;
  onUpdate: (updates: Partial<FsmState>) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <section className="inspector-card">
      <h3>{labels.stateProperties}</h3>
      <label>{labels.title}<input value={state.title} onChange={(event) => onUpdate({ title: event.target.value })} /></label>
      <label>{labels.subsystem}<input value={state.subsystem} onChange={(event) => onUpdate({ subsystem: event.target.value })} /></label>
      <label>
        {labels.stateMark}
        <select value={state.stateType} onChange={(event) => onUpdate({ stateType: event.target.value })}>
          <option value="initial">{labels.initialState}</option>
          <option value="process">{labels.processState}</option>
          <option value="success">{labels.successState}</option>
          <option value="failure">{labels.failureState}</option>
        </select>
      </label>
      <label className="checkbox-line"><input type="checkbox" checked={state.initial} onChange={(event) => onUpdate({ initial: event.target.checked })} />{labels.initialState}</label>
      <label className="checkbox-line"><input type="checkbox" checked={state.terminal} onChange={(event) => onUpdate({ terminal: event.target.checked })} />{labels.terminalState}</label>
      <button type="button" className="delete-button" onClick={onDelete}><Trash2 size={15} />{labels.deleteState}</button>
    </section>
  );
}

function RouteEditor({
  labels,
  currentStateId,
  states,
  stateOrder,
  eventOrder,
  eventNames,
  onAddRoute
}: {
  labels: UiText;
  currentStateId: string;
  states: Record<string, FsmState>;
  stateOrder: string[];
  eventOrder: string[];
  eventNames: Record<string, string>;
  onAddRoute: (targetStateId: string, eventId: string, direction: 'one-way' | 'two-way', condition: string) => void;
}): React.ReactElement {
  const targetOptions = stateOrder.filter((stateId) => stateId !== currentStateId);
  const [targetStateId, setTargetStateId] = useState(targetOptions[0] ?? '');
  const [eventId, setEventId] = useState(eventOrder[0] ?? '');
  const [direction, setDirection] = useState<'one-way' | 'two-way'>('one-way');
  const [condition, setCondition] = useState('');

  useEffect(() => {
    if (!targetOptions.includes(targetStateId)) {
      setTargetStateId(targetOptions[0] ?? '');
    }
  }, [targetOptions, targetStateId]);

  return (
    <section className="inspector-card">
      <h3>{labels.routeEditor}</h3>
      <label>
        {labels.targetState}
        <select value={targetStateId} onChange={(event) => setTargetStateId(event.target.value)}>
          {targetOptions.map((stateId) => <option key={stateId} value={stateId}>{states[stateId]?.title ?? stateId}</option>)}
        </select>
      </label>
      <label>
        {labels.event}
        <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
          {eventOrder.map((id) => <option key={id} value={id}>{eventNames[id]}</option>)}
        </select>
      </label>
      <label>
        {labels.routeDirection}
        <select value={direction} onChange={(event) => setDirection(event.target.value as 'one-way' | 'two-way')}>
          <option value="one-way">{labels.oneWay}</option>
          <option value="two-way">{labels.twoWay}</option>
        </select>
      </label>
      <label>{labels.transitionCondition}<input value={condition} onChange={(event) => setCondition(event.target.value)} /></label>
      <button type="button" disabled={!targetStateId || !eventId} onClick={() => onAddRoute(targetStateId, eventId, direction, condition)}>
        {labels.addRoute}
      </button>
    </section>
  );
}

const NEW_EVENT_SENTINEL = '__new-event__';

function TransitionInspector({
  transition,
  labels,
  onUpdate,
  onDelete,
  onCreateEvent,
  onRenameEvent,
  onUpdateEvent,
  onUpdateBackendDescription
}: {
  transition: FsmTransition;
  labels: UiText;
  onUpdate: (updates: Partial<FsmTransition>) => void;
  onDelete: () => void;
  onCreateEvent: (name?: string) => void;
  onRenameEvent: (eventId: string, name: string) => void;
  onUpdateEvent: (eventId: string, updates: Partial<Pick<FsmEvent, 'scope' | 'sourceStateId'>>) => void;
  onUpdateBackendDescription: (processId: string, description: string) => void;
}): React.ReactElement {
  const project = useProjectStore((state) => state.project)!;
  const panelButtons = Object.values(project.controlPanel.elements)
    .filter((element): element is ControlPanelButton => element.type === 'button');
  const mechanism = transition.trigger.mechanism ?? 'event';
  const currentEvent = project.fsm.events[transition.trigger.eventId];
  const boundButton = transition.trigger.buttonId
    ? project.controlPanel.elements[transition.trigger.buttonId]
    : null;
  const boundButtonLabel = boundButton?.type === 'button' ? boundButton.label : null;
  const updateFsmEvent = useProjectStore((state) => state.updateFsmEvent);
  const currentBackendProcess = transition.backendProcessId
    ? project.backendProcesses[transition.backendProcessId]
    : null;
  const availableEventIds = project.fsm.eventOrder.filter((eventId) => {
    const event = project.fsm.events[eventId];
    return event?.scope !== 'state' || event.sourceStateId === transition.from || eventId === transition.trigger.eventId;
  });
  const currentEventUsedByOtherSource = currentEvent
    ? Object.values(project.fsm.transitions).some((candidate) => (
        candidate.id !== transition.id &&
        candidate.trigger.eventId === currentEvent.id &&
        candidate.from !== transition.from
      ))
    : false;
  return (
    <section className="inspector-card">
      <h3>{labels.transitionProperties}</h3>
      <label>
        {labels.event}
        <select
          value={transition.trigger.eventId}
          onChange={(event) => {
            if (event.target.value === NEW_EVENT_SENTINEL) {
              const name = globalThis.prompt(labels.newEventPrompt, '')?.trim();
              if (name) {
                onCreateEvent(name);
              }
              return;
            }
            onUpdate({ trigger: { ...transition.trigger, eventId: event.target.value } });
          }}
        >
          {availableEventIds.map((eventId) => (
            <option key={eventId} value={eventId}>
              {project.fsm.events[eventId].name} · {project.fsm.events[eventId].scope === 'state' ? labels.localEvent : labels.globalEvent}
            </option>
          ))}
          <option value={NEW_EVENT_SENTINEL}>{labels.newEventOption}</option>
        </select>
      </label>
      {currentEvent ? (
        <>
          <label>
            {labels.eventNameLabel}
            <input
              value={boundButtonLabel ?? currentEvent.name}
              readOnly={Boolean(boundButtonLabel)}
              onChange={(event) => onRenameEvent(currentEvent.id, event.target.value)}
            />
          </label>
          <label>
            {labels.eventScope}
            <select
              value={currentEvent.scope ?? 'global'}
              onChange={(event) => {
                const scope = event.target.value as 'global' | 'state';
                onUpdateEvent(currentEvent.id, {
                  scope,
                  sourceStateId: scope === 'state' ? transition.from : null
                });
              }}
            >
              <option value="global">{labels.globalEvent}</option>
              <option value="state" disabled={currentEventUsedByOtherSource}>{labels.localEvent}</option>
            </select>
          </label>
          <small>
            {currentEventUsedByOtherSource
              ? labels.sharedEventScopeHint
              : currentEvent.scope === 'state'
                ? labels.localEventHint
                : labels.globalEventHint}
          </small>
        </>
      ) : null}
      <label>
        {labels.transitionMechanism}
        <select
          value={mechanism}
          onChange={(event) => onUpdate({
            trigger: {
              ...transition.trigger,
              mechanism: event.target.value as FsmTransition['trigger']['mechanism']
            }
          })}
        >
          <option value="event">{labels.event}</option>
          <option value="button">{labels.buttonTrigger}</option>
          <option value="timer">{labels.timerTrigger}</option>
          <option value="fact">{labels.factTrigger}</option>
        </select>
      </label>
      {mechanism === 'button' ? (
        <label>
          {labels.boundButton}
          <select
            value={transition.trigger.buttonId ?? ''}
            onChange={(event) => {
              const button = panelButtons.find((item) => item.id === event.target.value);
              if (button?.fsmEventId) {
                // The event registry is an operator-facing vocabulary.  A
                // button-triggered event therefore always uses the exact keycap
                // label, rather than an internal mnemonic such as UI.OK.
                updateFsmEvent(button.fsmEventId, { name: button.label });
              }
              onUpdate({
                trigger: {
                  ...transition.trigger,
                  mechanism: 'button',
                  buttonId: button?.id ?? null,
                  eventId: button?.fsmEventId ?? transition.trigger.eventId
                },
                labelMode: button ? 'button' : 'auto'
              });
            }}
          >
            <option value="">{labels.none}</option>
            {panelButtons.map((button) => (
              <option key={button.id} value={button.id}>{button.label} ({button.fsmEventId ?? labels.unbound})</option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Подпись на ребре
        <select
          value={transition.labelMode ?? (boundButtonLabel ? 'button' : 'auto')}
          onChange={(event) => onUpdate({ labelMode: event.target.value as FsmTransition['labelMode'] })}
        >
          <option value="button" disabled={!boundButtonLabel}>Название кнопки{boundButtonLabel ? `: ${boundButtonLabel}` : ''}</option>
          <option value="event">Название события</option>
          <option value="auto">Auto</option>
        </select>
      </label>
      {mechanism === 'timer' ? (
        <label>
          {labels.timerMs}
          <input
            type="number"
            min={1}
            value={transition.trigger.timerMs ?? 1000}
            onChange={(event) => onUpdate({
              trigger: {
                ...transition.trigger,
                mechanism: 'timer',
                timerMs: Math.max(1, Number(event.target.value) || 1)
              }
            })}
          />
        </label>
      ) : null}
      {mechanism === 'fact' ? (
        <label>
          {labels.factExpression}
          <input
            value={transition.trigger.fact ?? ''}
            onChange={(event) => onUpdate({
              trigger: {
                ...transition.trigger,
                mechanism: 'fact',
                fact: event.target.value || null
              }
            })}
          />
        </label>
      ) : null}
      <label>
        {labels.transitionKind}
        <select value={transition.kind} onChange={(event) => onUpdate({ kind: event.target.value })}>
          <option value="navigation">{labels.transitionKindNavigation}</option>
          <option value="guarded">{labels.transitionKindGuarded}</option>
          <option value="timeout">{labels.transitionKindTimeout}</option>
          <option value="backend">{labels.transitionKindBackend}</option>
        </select>
      </label>
      <label>{labels.transitionCondition}<input value={transition.condition ?? ''} onChange={(event) => onUpdate({ condition: event.target.value || null })} /></label>
      <div className="condition-snippets" role="group" aria-label={labels.conditionSnippets}>
        {['button == OK', 'value > 0', 'timeout_ms >= 1000', 'status == READY'].map((snippet) => (
          <button
            key={snippet}
            type="button"
            title={labels.insertSnippet}
            onClick={() => {
              const existing = transition.condition?.trim();
              const nextCondition = existing ? `${existing} && ${snippet}` : snippet;
              onUpdate({ kind: 'guarded', condition: nextCondition });
            }}
          >
            {snippet}
          </button>
        ))}
      </div>
      <label>
        {labels.backendProcess}
        <select value={transition.backendProcessId ?? ''} onChange={(event) => onUpdate({ backendProcessId: event.target.value || null })}>
          <option value="">{labels.none}</option>
          {Object.values(project.backendProcesses).map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}
        </select>
      </label>
      {currentBackendProcess ? (
        <BackendDescriptionInput
          key={currentBackendProcess.id}
          label={labels.backendProcessDescription}
          placeholder={labels.backendProcessDescriptionPlaceholder}
          value={currentBackendProcess.description ?? ''}
          onCommit={(description) => onUpdateBackendDescription(currentBackendProcess.id, description)}
        />
      ) : null}
      <button type="button" className="delete-button" onClick={onDelete}><Trash2 size={15} />{labels.deleteTransition}</button>
    </section>
  );
}

function BackendDescriptionInput({
  label,
  placeholder,
  value,
  onCommit
}: {
  label: string;
  placeholder: string;
  value: string;
  onCommit: (description: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <label>
      {label}
      <textarea
        rows={5}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) {
            onCommit(draft);
          }
        }}
      />
    </label>
  );
}

function legacyStateMap(states: Record<string, FsmState>): Record<string, {
  id: string;
  runtimeId: string | null;
  legacyIds: string[];
  title: string;
  subsystem: string;
  stateType: string;
  origin: string;
  sourceLcd: string[];
  initial: boolean;
  final: boolean;
}> {
  return Object.fromEntries(Object.values(states).map((state) => [state.id, {
    ...state,
    sourceLcd: [],
    final: state.terminal
  }]));
}

function readFsmWorkspaceLayout(): FsmWorkspaceLayout {
  try {
    const value = JSON.parse(localStorage.getItem(FSM_LAYOUT_KEY) ?? '{}') as Partial<FsmWorkspaceLayout>;
    return {
      leftWidth: clampSidebarWidth(value.leftWidth ?? 270, 190, 520),
      rightWidth: clampSidebarWidth(value.rightWidth ?? 390, 260, 620)
    };
  } catch {
    return { leftWidth: 270, rightWidth: 390 };
  }
}

function clampSidebarWidth(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

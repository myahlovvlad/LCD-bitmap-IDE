import type React from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  ReactFlow,
  getBezierPath,
  getSmoothStepPath,
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
import { StateNode, type FsmStateNodeData } from '../../renderer/components/StateNode';
import { FontRenderer } from '../../renderer/core/fonts';
import { computeElkLayoutWithRoutes, computeSwimlaneBounds, getSubsystemColor, getSubsystemLabel, type SubsystemBand } from '../../renderer/core/elkLayout';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { copyToClipboard } from '../../renderer/utils/clipboard';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { ControlPanelButton, FsmEvent, FsmLayer, FsmState, FsmTransition, LcdBitmapProject } from '../../domain/project';
import type { LanguageCode } from '../../domain/localization';
import { ValidationPanel } from '../validation/ValidationPanel';
import { FsmScriptStudio } from '../fsm-script/FsmScriptStudio';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { ScreenLayerManager } from './ScreenLayerManager';
const FsmWebGlGraph = lazy(() => import('./FsmWebGlGraph').then((module) => ({ default: module.FsmWebGlGraph })));

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

/** One entry state per subsystem makes the default canvas a readable system map. */
function collectOverviewStateIds(project: LcdBitmapProject): Set<string> {
  const incoming = new Map<string, FsmTransition[]>();
  for (const transition of Object.values(project.fsm.transitions)) {
    const routes = incoming.get(transition.to) ?? [];
    routes.push(transition);
    incoming.set(transition.to, routes);
  }
  const result = new Set(project.fsm.stateOrder.filter((id) => project.fsm.states[id]?.initial));
  const groups = new Map<string, string[]>();
  for (const id of project.fsm.stateOrder) {
    const subsystem = project.fsm.states[id]?.subsystem;
    if (!subsystem) continue;
    const group = groups.get(subsystem) ?? [];
    group.push(id);
    groups.set(subsystem, group);
  }
  for (const [subsystem, ids] of groups) {
    const entry = ids.find((id) => (incoming.get(id) ?? []).some((route) => project.fsm.states[route.from]?.subsystem !== subsystem))
      ?? [...ids].sort((a, b) => (project.fsm.graphLayout[a]?.y ?? 0) - (project.fsm.graphLayout[b]?.y ?? 0))[0];
    if (entry) result.add(entry);
  }
  return result;
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
    updateFsmStates,
    updateFsmLayers,
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
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>('tree');
  const [contextMenu, setContextMenu] = useState<FsmContextMenu | null>(null);
  const [focusedSubsystem, setFocusedSubsystem] = useState<string | null>(null);
  // The catalogue and the canvas must agree: all imported states are visible
  // by default.  "Overview" is a deliberate, optional simplification.
  const [overviewMode, setOverviewMode] = useState(false);
  const [overviewOverrides, setOverviewOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenInspectorOpen, setFullscreenInspectorOpen] = useState(false);
  const [visibleSubsystems, setVisibleSubsystems] = useState<string[]>([]);
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const [edgeRoutes, setEdgeRoutes] = useState<Map<string, Array<{ x: number; y: number }>>>(new Map());
  const workspaceRef = useRef<HTMLElement | null>(null);
  const groupDragRef = useRef<{ stateIds: string[]; anchorId: string; anchorPosition: { x: number; y: number }; positions: Record<string, { x: number; y: number }> } | null>(null);
  const fsmClipboardRef = useRef<Array<{ state: FsmState; position: { x: number; y: number } }>>([]);
  const reactFlowInstanceRef = useRef<{ fitView: (opts?: { padding?: number; duration?: number; nodes?: Node[] }) => void } | null>(null);
  const labels = UI_TEXT[language];

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

      const candidateStateIds = focusedSubsystem
        ? project.fsm.stateOrder.filter((id) => project.fsm.states[id]?.subsystem === focusedSubsystem || project.fsm.states[id]?.initial)
        : overviewMode ? [...collectOverviewStateIds(project)] : project.fsm.stateOrder;
      const layoutStateIds = candidateStateIds.filter((id) => activeSubsystems.has(project.fsm.states[id]?.subsystem ?? 'user'));
      const included = new Set(layoutStateIds);
      const flowNodes = layoutStateIds.map((id) => ({
        id,
        type: 'stateNode',
        position: project.fsm.graphLayout[id] ?? { x: 0, y: 0 },
        data: {}
      }));
      const flowEdges = project.fsm.transitionOrder
        .map((tid) => project.fsm.transitions[tid])
        .filter((transition) => included.has(transition.from) && included.has(transition.to))
        .map((transition) => ({ id: transition.id, source: transition.from, target: transition.to }));

      const { positions: elkPositions, routes } = await computeElkLayoutWithRoutes(flowNodes, flowEdges, subsystemOf, {
        direction: template === 'tree' ? 'TB' : 'LR',
        nodeWidth: 220,
        nodeHeight: 112,
        paddingX: 80,
        paddingY: 60,
      });

      const positions = template === 'lanes'
        ? arrangePositionsInLanes(elkPositions, layoutStateIds, subsystemOf)
        : elkPositions;

      const layoutMap: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of positions) {
        layoutMap[id] = pos;
      }
      updateGraphPositions(layoutMap);
      setEdgeRoutes(new Map([...routes].map(([id, route]) => [id, route.points])));

      const bands = computeSwimlaneBounds(positions, layoutStateIds, subsystemOf, 220, 112, 24);
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
      setSelectedStateIds([requestedStateId]);
    }
  }, [project, requestedStateId, selectState]);

  useEffect(() => {
    if (!selectedStateId) return;
    setSelectedStateIds((current) => current.includes(selectedStateId) ? current : [selectedStateId]);
  }, [selectedStateId]);

  useEffect(() => {
    const isTextInput = (target: EventTarget | null): boolean => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!project || isTextInput(event.target)) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedStateIds(project.fsm.stateOrder);
        return;
      }
      if (event.key === 'Escape') {
        setSelectedStateIds([]);
        selectState(null);
        selectTransition(null);
        return;
      }
      if (command && event.key.toLowerCase() === 'c' && selectedStateIds.length) {
        event.preventDefault();
        fsmClipboardRef.current = selectedStateIds.flatMap((stateId) => {
          const state = project.fsm.states[stateId];
          const position = project.fsm.graphLayout[stateId];
          return state && position ? [{ state, position }] : [];
        });
        return;
      }
      if (command && event.key.toLowerCase() === 'v' && fsmClipboardRef.current.length && editing) {
        event.preventDefault();
        const createdIds: string[] = [];
        const positions: Record<string, { x: number; y: number }> = {};
        for (const entry of fsmClipboardRef.current) {
          addFsmState();
          const id = useProjectStore.getState().selectedStateId;
          if (!id) continue;
          createdIds.push(id);
          updateFsmState(id, { ...entry.state, id, title: `${entry.state.title} — копия`, screenId: null, initial: false, terminal: false });
          positions[id] = { x: entry.position.x + 36, y: entry.position.y + 36 };
        }
        if (createdIds.length) {
          updateGraphPositions(positions);
          setSelectedStateIds(createdIds);
          selectState(createdIds.at(-1) ?? null);
        }
        return;
      }
      if (editing && event.key === 'Delete' && selectedStateIds.length) {
        event.preventDefault();
        if (confirmFsmDelete('state', selectedStateIds.length)) {
          selectedStateIds.forEach((stateId) => deleteFsmState(stateId));
          setSelectedStateIds([]);
        }
        return;
      }
      if (editing && event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selectedStateIds.length) {
        event.preventDefault();
        const delta = event.key === 'ArrowLeft' ? { x: -10, y: 0 } : event.key === 'ArrowRight' ? { x: 10, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: -10 } : { x: 0, y: 10 };
        updateGraphPositions(Object.fromEntries(selectedStateIds.map((stateId) => {
          const position = project.fsm.graphLayout[stateId] ?? { x: 0, y: 0 };
          return [stateId, { ...position, x: position.x + delta.x, y: position.y + delta.y }];
        })));
        setEdgeRoutes(new Map());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addFsmState, deleteFsmState, editing, project, selectState, selectTransition, selectedStateIds, updateFsmState, updateGraphPositions]);

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
    setSwimlaneBands(computeSwimlaneBounds(positions, project.fsm.stateOrder, subsystemOf, 220, 112, 24));
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

  // Fullscreen changes the grid width after the browser fires
  // `fullscreenchange`.  Fit on the next two frames so React Flow measures the
  // final canvas, not the old zero-height/zero-width intermediate rectangle.
  useEffect(() => {
    if (!isFullscreen || presentation !== '2d') return;
    let first = 0;
    let second = 0;
    const refreshViewport = (): void => {
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => reactFlowInstanceRef.current?.fitView({ padding: 0.12, duration: 0 }));
      });
    };
    refreshViewport();
    window.addEventListener('resize', refreshViewport);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.removeEventListener('resize', refreshViewport);
    };
  }, [isFullscreen, fullscreenInspectorOpen, presentation]);

  const overviewStateIds = useMemo(() => project ? collectOverviewStateIds(project) : new Set<string>(), [project]);
  const layerList = useMemo<FsmLayer[]>(() => {
    if (!project) return [];
    const catalog = project.fsm.layers ?? {};
    const ids = [...new Set([...(project.fsm.layerOrder ?? []), ...project.fsm.stateOrder.map((id) => project.fsm.states[id]?.subsystem ?? 'user')])];
    return ids.map((id) => catalog[id] ?? { id, name: getSubsystemLabel(id), color: getSubsystemColor(id), icon: 'layers' });
  }, [project]);
  const subsystems = useMemo(() => layerList.map((layer) => layer.id), [layerList]);
  const activeSubsystems = useMemo(() => new Set(visibleSubsystems.length ? visibleSubsystems : subsystems), [subsystems, visibleSubsystems]);
  const overviewLayout = useMemo(() => {
    const layout = new Map<string, { x: number; y: number }>();
    if (!project) return layout;
    const ids = project.fsm.stateOrder.filter((id) => overviewStateIds.has(id));
    const initial = ids.filter((id) => project.fsm.states[id]?.initial);
    initial.forEach((id, index) => layout.set(id, { x: 70 + index * 245, y: 55 }));
    const remaining = ids.filter((id) => !initial.includes(id));
    const groups = [...new Set(remaining.map((id) => project.fsm.states[id]?.subsystem ?? 'user'))];
    groups.forEach((subsystem, row) => {
      remaining
        .filter((id) => (project.fsm.states[id]?.subsystem ?? 'user') === subsystem)
        .forEach((id, column) => layout.set(id, { x: 70 + column * 245, y: 210 + row * 165 }));
    });
    return layout;
  }, [project, overviewStateIds]);
  const isVisibleOnCanvas = (stateId: string): boolean => {
    const subsystem = project?.fsm.states[stateId]?.subsystem ?? 'user';
    if (focusedSubsystem) return subsystem === focusedSubsystem;
    if (!activeSubsystems.has(subsystem)) return false;
    return !overviewMode || overviewStateIds.has(stateId);
  };
  const canvasStateIds = useMemo(
    () => project?.fsm.stateOrder.filter(isVisibleOnCanvas) ?? [],
    [project, focusedSubsystem, overviewMode, overviewStateIds, activeSubsystems]
  );
  // Position updates happen for every drag.  A fitView must respond only to a
  // change in the represented graph, not to a node changing x/y.
  const canvasStateSignature = useMemo(
    () => canvasStateIds.join('\u0000'),
    [canvasStateIds]
  );

  const stateNodeData = useMemo(() => {
    if (!project) return new Map<string, FsmStateNodeData>();
    const buttonsByEvent = new Map<string, string[]>();
    for (const element of Object.values(project.controlPanel.elements)) {
      if (element.type === 'button' && element.fsmEventId) {
        const labels = buttonsByEvent.get(element.fsmEventId) ?? [];
        labels.push(element.label);
        buttonsByEvent.set(element.fsmEventId, labels);
      }
    }
    const eventIdsByState = new Map<string, Set<string>>();
    for (const transition of Object.values(project.fsm.transitions)) {
      const ids = eventIdsByState.get(transition.from) ?? new Set<string>();
      ids.add(transition.trigger.eventId);
      eventIdsByState.set(transition.from, ids);
    }
    return new Map(project.fsm.stateOrder.map((id) => {
      const state = project.fsm.states[id];
      const eventIds = eventIdsByState.get(id) ?? new Set<string>();
      const allowedButtons = [...eventIds].flatMap((eventId) => buttonsByEvent.get(eventId) ?? []);
      const stateMark = state.initial || state.stateType === 'initial'
        ? { kind: 'initial', label: labels.initialState }
        : state.stateType === 'failure'
          ? { kind: 'failure', label: labels.failureState }
          : state.terminal || state.stateType === 'success'
            ? { kind: 'success', label: labels.successState }
            : { kind: 'process', label: labels.processState };
      return [id, {
        compact: true,
        state,
        screenName: state.screenId ? project.screens[state.screenId]?.name ?? null : null,
        allowedButtons: [...new Set(allowedButtons)],
        stateMark,
        editingEnabled: editing,
      } satisfies FsmStateNodeData];
    }));
  }, [editing, project, labels]);

  const calculatedNodes = useMemo<Node[]>(() => project
    ? canvasStateIds.map((stateId) => {
        const state = project.fsm.states[stateId];
        const position = (!focusedSubsystem && overviewMode ? overviewOverrides[stateId] ?? overviewLayout.get(stateId) : undefined)
          ?? project.fsm.graphLayout[stateId] ?? { x: 80, y: 80 };
        return {
          id: stateId,
          type: 'stateNode',
          position: { x: position.x, y: position.y },
          // React Flow owns the transient selection flag.  Feeding a new
          // selected value back into the controlled node list from
          // onSelectionChange creates a selection -> nodes -> selection loop
          // for marquee and multi-select gestures.
          zIndex: 1,
          data: stateNodeData.get(stateId) ?? { compact: true, state, allowedButtons: [], stateMark: { kind: 'process', label: labels.processState } }
        };
      })
    : [], [project, canvasStateIds, focusedSubsystem, overviewMode, overviewLayout, overviewOverrides, stateNodeData, labels.processState]);

  // Swimlane bands are intentionally excluded from fitView: a tall layer
  // background must never push every actual state node outside the viewport.
  // The delayed resize fit also covers fullscreen and sidebar changes.
  useEffect(() => {
    if (presentation !== '2d' || !calculatedNodes.length) return;
    let first = 0;
    let second = 0;
    let delayed: ReturnType<typeof globalThis.setTimeout> | undefined;
    const fit = (): void => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => reactFlowInstanceRef.current?.fitView({ padding: 0.12, duration: 0, nodes: calculatedNodes }));
      });
    };
    fit();
    // React Flow receives controlled nodes one render after the workspace;
    // retry after they have dimensions, otherwise fitView sees an empty box.
    delayed = globalThis.setTimeout(fit, 260);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (delayed !== undefined) globalThis.clearTimeout(delayed);
      window.removeEventListener('resize', fit);
    };
  }, [presentation, canvasStateSignature]);
  const swimlaneNodes = useMemo<Node[]>(() => showSwimlanes && !overviewMode
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
    : [], [showSwimlanes, swimlaneBands, focusedSubsystem, overviewMode]);

  const allNodes = useMemo<Node[]>(() => [...swimlaneNodes, ...calculatedNodes], [swimlaneNodes, calculatedNodes]);

  const canvasTransitions = useMemo(() => {
    if (!project) return [] as FsmTransition[];
    const included = new Set(canvasStateIds);
    return project.fsm.transitionOrder
      .map((id) => project.fsm.transitions[id])
      .filter((transition): transition is FsmTransition => Boolean(transition) && included.has(transition.from) && included.has(transition.to));
  }, [project, canvasStateIds]);

  const edges = useMemo<Edge[]>(() => {
    if (!project) {
      return [];
    }
    const transitions = canvasTransitions;
    // Never drop a real transition to make the drawing look cleaner.  The
    // router and the selected-edge foreground treatment carry dense routes.
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
          data: {
          curveSign: isBidirectionalPair ? (transition.from < transition.to ? 1 : -1) : 0,
          reverse: transition.trigger.eventId === 'UI.ESC',
          route: edgeRoutes.get(transition.id)
        },
        sourceHandle: transition.sourceHandle ?? (transition.from === transition.to ? 's-right' : 's-right'),
        targetHandle: transition.targetHandle ?? (transition.from === transition.to ? 't-right' : 't-left'),
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: transition.id === selectedTransitionId,
        zIndex: transition.id === selectedTransitionId ? 90 : 0
      };
    });
  }, [project, selectedTransitionId, canvasTransitions, edgeRoutes]);

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
      className={`workspace-root fsm-workspace fsm-workspace-resizable ${editing ? 'fsm-edit-mode' : 'fsm-readonly-mode'}${isFullscreen ? ' fsm-fullscreen' : ''}${isFullscreen && fullscreenInspectorOpen ? ' fsm-fullscreen-inspector-open' : ''}`}
      aria-label={labels.fsmEditor}
      data-testid="fsm-workspace"
      style={{ gridTemplateColumns: `${layout.leftWidth}px 6px minmax(430px, 1fr) 6px ${layout.rightWidth}px` }}
      onPointerMove={updateSidebarResize}
      onPointerUp={() => setSidebarResize(null)}
      onPointerCancel={() => setSidebarResize(null)}
    >
      <aside className="workspace-sidebar fsm-state-catalog">
        <header className="workspace-section-header">
          <h2>{labels.states}</h2>
          <button type="button" onClick={addFsmState} title={labels.addState} data-testid="fsm-add-state" disabled={!editing}><Plus size={16} /></button>
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
                  onClick={() => {
                    const subsystem = state.subsystem ?? 'user';
                    setVisibleSubsystems((current) => current.length && !current.includes(subsystem) ? [...current, subsystem] : current);
                    setFocusedSubsystem(null);
                    setOverviewMode(false);
                    setSelectedStateIds([stateId]);
                    selectState(stateId);
                  }}
                >
                  <strong>{state.title}</strong>
                  <small>{state.id}</small>
                </button>
                <div>
                  <button type="button" onClick={() => void copyToClipboard(state.id)} title={labels.copyId}>
                    <Copy size={14} />
                  </button>
                  <button type="button" onClick={() => { if (confirmFsmDelete('state', 1, state.title)) deleteFsmState(stateId); }} title={labels.delete} disabled={!editing}>
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
        className="workspace-splitter fsm-left-splitter"
        role="separator"
        aria-label={labels.resizeFsmStates}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'left', startX: event.clientX, startWidth: layout.leftWidth });
        }}
      />

      <main className="workspace-canvas-column fsm-graph-column">
        <header className="workspace-toolbar">
          <button type="button" className={editing ? 'active' : ''} onClick={() => setEditing((value) => !value)} aria-pressed={editing} data-testid="fsm-edit-mode">
            {labels.editGraph}
          </button>
          <button
            type="button"
            className={elkRunning ? 'active' : ''}
            disabled={elkRunning}
            onClick={() => void runElkLayout(layoutTemplate)}
            title={`${labels.rebuildWithoutCrossings} · ${labels.elkLayoutTip}`}
          >
            <LayoutGrid size={16} />
            {elkRunning ? 'ELK…' : labels.autoArrange}
          </button>
          <label className="fsm-layout-template">
            <span>{labels.layoutTemplate}</span>
            <select value={layoutTemplate} onChange={(event) => setLayoutTemplate(event.target.value as LayoutTemplate)}>
              <option value="hierarchy">{labels.layoutHierarchy}</option>
              <option value="tree">{labels.layoutTree}</option>
              <option value="lanes">{labels.layoutLanes}</option>
            </select>
          </label>
          <details className="fsm-layer-filter">
            <summary>{labels.screenLayersFilter} · {activeSubsystems.size}/{subsystems.length}</summary>
            <div role="group" aria-label={labels.subsystemsOnCanvas}>
              <button type="button" onClick={() => setVisibleSubsystems([])}>{labels.allSubsystems}</button>
              {subsystems.map((subsystem, index) => {
                const visible = activeSubsystems.has(subsystem);
                return <label key={subsystem}>
                  <input
                    type="checkbox"
                    // Keep the accessible control name stable even when a
                    // user calls a layer "Project".  The project-name field
                    // must remain the unique form control named "Project".
                    aria-label={`Layer visibility ${index + 1}`}
                    checked={visible}
                    onChange={() => setVisibleSubsystems((current) => {
                      const base = current.length ? current : subsystems;
                      const next = visible ? base.filter((item) => item !== subsystem) : [...base, subsystem];
                      return next.length ? next : base;
                    })}
                  />
                  {layerList.find((layer) => layer.id === subsystem)?.name ?? getSubsystemLabel(subsystem)}
                </label>;
              })}
              <ScreenLayerManager
                layers={layerList}
                selectedStateIds={selectedStateIds.length ? selectedStateIds : selectedStateId ? [selectedStateId] : []}
                states={project.fsm.states}
                presets={project.fsm.visibilityPresets ?? {}}
                labels={labels}
                onUpdateStates={updateFsmStates}
                onUpdateLayers={(layers, presets) => updateFsmLayers(Object.fromEntries(layers.map((layer) => [layer.id, layer])), layers.map((layer) => layer.id), presets)}
              />
              {Object.values(project.fsm.visibilityPresets ?? {}).map((preset) => <button
                key={preset.id}
                type="button"
                onClick={() => setVisibleSubsystems(preset.layerIds)}
              >{preset.name}</button>)}
            </div>
          </details>
          <span className="fsm-selection-hint" title={labels.fsmSelectionHintTitle}>
            {selectedStateIds.length > 1 ? `Группа: ${selectedStateIds.length}` : 'Shift + щелчок / рамка'}
          </span>
          <button type="button" className={overviewMode && !focusedSubsystem ? 'active' : ''} onClick={() => { setFocusedSubsystem(null); setOverviewMode(true); }} title={labels.overviewButtonTitle}>
            {labels.overviewButton}
          </button>
          <button type="button" className={!overviewMode && !focusedSubsystem ? 'active' : ''} onClick={() => { setFocusedSubsystem(null); setOverviewMode(false); }} title={labels.allScreensButtonTitle}>
            {labels.allScreensButton}
          </button>
          <button type="button" className={presentation === '3d' ? 'active' : ''} onClick={() => {
            if (presentation === '2d') { assign3dDepths(); setPresentation('3d'); }
            else setPresentation('2d');
          }}>
            {presentation === '2d' ? '3D' : '2D'}
          </button>
          {presentation === '3d' ? <button type="button" onClick={assign3dDepths} title={labels.distributeSubsystemsZ}>{labels.depthZButton}</button> : null}
          <button type="button" onClick={() => void toggleFullscreen()} title={labels.fullscreenButtonTitle} data-testid="fsm-fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Expand size={16} />}
            {isFullscreen ? 'Окно' : 'На весь экран'}
          </button>
          {isFullscreen ? (
            <button
              type="button"
              className={fullscreenInspectorOpen ? 'active' : ''}
              onClick={() => setFullscreenInspectorOpen((value) => !value)}
              aria-expanded={fullscreenInspectorOpen}
            >
              {fullscreenInspectorOpen ? 'Скрыть свойства' : 'Свойства'}
            </button>
          ) : null}
          {focusedSubsystem ? (
            <button type="button" onClick={() => { setFocusedSubsystem(null); setOverviewMode(true); }}>{labels.backToOverviewButton}</button>
          ) : null}
          <button type="button" className={showSwimlanes ? 'active' : ''} onClick={() => setShowSwimlanes((value) => !value)} title={showSwimlanes ? labels.hideSubsystems : labels.swimlanes} aria-pressed={showSwimlanes}>
            {labels.swimlanes}{showSwimlanes ? ' ✓' : ''}
          </button>
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
                <Suspense fallback={<div className="fsm-webgl-loading">{labels.loading3dView}</div>}>
                  <FsmWebGlGraph
                    states={project.fsm.states}
                    stateIds={canvasStateIds}
                    transitions={canvasTransitions}
                    positions={project.fsm.graphLayout}
                    selectedStateId={selectedStateId}
                    onSelectState={selectState}
                    ariaLabel={labels.webGlFsmGraphAria}
                  />
                </Suspense>
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
              nodes={allNodes}
              edges={edges.map((e) => ({ ...e, type: showSwimlanes ? 'fsmTransitionOrtho' : 'fsmTransition' }))}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              onSelectionChange={({ nodes: selectedNodes }) => {
                const stateIds = selectedNodes
                  .filter((node) => !node.id.startsWith('__swimlane_') && Boolean(project.fsm.states[node.id]))
                  .map((node) => node.id);
                setSelectedStateIds((current) => sameStateSelection(current, stateIds) ? current : stateIds);
              }}
              onConnect={handleConnect}
              onNodeClick={(_, node) => {
                if (!selectedStateIds.includes(node.id)) setSelectedStateIds([node.id]);
                selectState(node.id);
                if (isFullscreen) setFullscreenInspectorOpen(true);
              }}
              onEdgeClick={(_, edge) => {
                selectTransition(edge.id);
                if (isFullscreen) setFullscreenInspectorOpen(true);
              }}
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
              onPaneClick={() => { setContextMenu(null); setSelectedStateIds([]); }}
              onInit={(instance) => {
                reactFlowInstanceRef.current = instance as { fitView: (opts?: { padding?: number; duration?: number; nodes?: Node[] }) => void };
                globalThis.setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.12, duration: 0, nodes: calculatedNodes }), 260);
              }}
              onNodeDragStart={(_, node) => {
                const stateIds = selectedStateIds.includes(node.id) ? selectedStateIds : [node.id];
                if (!selectedStateIds.includes(node.id)) setSelectedStateIds([node.id]);
                const positions = Object.fromEntries(stateIds.map((stateId) => {
                  const position = (overviewMode && !focusedSubsystem ? overviewOverrides[stateId] : undefined)
                    ?? project.fsm.graphLayout[stateId]
                    ?? { x: 80, y: 80 };
                  return [stateId, { x: position.x, y: position.y }];
                }));
                groupDragRef.current = { stateIds, anchorId: node.id, anchorPosition: { ...node.position }, positions };
              }}
              onNodeDragStop={(_, node) => {
                const drag = groupDragRef.current;
                const delta = drag && drag.anchorId === node.id
                  ? { x: node.position.x - drag.anchorPosition.x, y: node.position.y - drag.anchorPosition.y }
                  : { x: 0, y: 0 };
                const positions = drag
                  ? Object.fromEntries(drag.stateIds.map((stateId) => {
                    const origin = drag.positions[stateId];
                    return [stateId, { ...origin, x: origin.x + delta.x, y: origin.y + delta.y }];
                  }))
                  : { [node.id]: node.position };
                if (overviewMode && !focusedSubsystem) {
                  setOverviewOverrides((current) => ({ ...current, ...positions }));
                }
                setEdgeRoutes(new Map());
                updateGraphPositions(positions);
                groupDragRef.current = null;
              }}
              nodesConnectable={editing}
              nodesDraggable={editing}
              selectionOnDrag
              panOnDrag={[1, 2]}
              minZoom={0.03}
              fitView
            >
              <Background />
              <Controls />
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
              <button type="button" role="menuitem" onClick={() => { selectState(state.id); setContextMenu(null); }}>{labels.ctxEditState}</button>
              <button type="button" role="menuitem" onClick={() => { ensureStateScreen(state.id); selectState(state.id); setContextMenu(null); }}>{labels.ctxCreateOpenScreen}</button>
              <button type="button" role="menuitem" onClick={() => { void copyToClipboard(state.id); setContextMenu(null); }}>{labels.copyId}</button>
              <button type="button" role="menuitem" onClick={() => { duplicateState(state); setContextMenu(null); }}>{labels.duplicate}</button>
              <button type="button" role="menuitem" onClick={() => { setOverviewMode(false); setFocusedSubsystem(state.subsystem); setContextMenu(null); }}>{labels.ctxShowBranch} «{state.subsystem}»</button>
              <button type="button" role="menuitem" className="danger" disabled={!editing} onClick={() => { if (confirmFsmDelete('state', 1, state.title)) deleteFsmState(state.id); setContextMenu(null); }}>{labels.delete}</button>
            </>;
          })() : null}
          {contextMenu.transitionId && project.fsm.transitions[contextMenu.transitionId] ? (
            <>
              <button type="button" role="menuitem" onClick={() => { selectTransition(contextMenu.transitionId!); setContextMenu(null); }}>{labels.ctxEditTransition}</button>
              <button type="button" role="menuitem" onClick={() => { void copyToClipboard(contextMenu.transitionId!); setContextMenu(null); }}>{labels.copyId}</button>
              <button type="button" role="menuitem" className="danger" disabled={!editing} onClick={() => { if (confirmFsmDelete('transition', 1)) deleteFsmTransition(contextMenu.transitionId!); setContextMenu(null); }}>{labels.delete}</button>
            </>
          ) : null}
          {!contextMenu.stateId && !contextMenu.transitionId ? (
            <>
              <button type="button" role="menuitem" onClick={() => { addFsmState(); setContextMenu(null); }}>{labels.addState}</button>
              <button type="button" role="menuitem" onClick={() => { void runElkLayout('tree'); setContextMenu(null); }}>{labels.ctxArrangeTree}</button>
              <button type="button" role="menuitem" onClick={() => { setFocusedSubsystem(null); setOverviewMode(true); setContextMenu(null); }}>{labels.ctxShowOverview}</button>
              <button type="button" role="menuitem" onClick={() => { setFocusedSubsystem(null); setOverviewMode(false); setContextMenu(null); }}>{labels.ctxShowAllScreens}</button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className="workspace-splitter fsm-right-splitter"
        role="separator"
        aria-label={labels.resizeFsmInspector}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'right', startX: event.clientX, startWidth: layout.rightWidth });
        }}
      />

      <aside className="workspace-inspector fsm-transition-sidebar">
        {selectedTransition ? (
          <>
            <TransitionLinkPreview transition={selectedTransition} language={language} fontGlyphs={fontGlyphs} labels={labels} />
            <TransitionValidation transition={selectedTransition} project={project} />
            <TransitionInspector
              transition={selectedTransition}
              labels={labels}
              editing={editing}
              onUpdate={(updates) => updateFsmTransition(selectedTransition.id, updates)}
              onDelete={() => { if (confirmFsmDelete('transition', 1)) deleteFsmTransition(selectedTransition.id); }}
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
          </>
        ) : selectedState ? (
          <>
            <StateInspector
              state={selectedState}
              labels={labels}
              layers={layerList}
              editing={editing}
              onUpdate={(updates) => updateFsmState(selectedState.id, updates)}
              onDelete={() => { if (confirmFsmDelete('state', 1, selectedState.title)) deleteFsmState(selectedState.id); }}
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
              editing={editing}
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
                    language={project.authoringLanguage ?? 'en'}
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
  const isReverse = (data as { reverse?: boolean } | undefined)?.reverse ?? false;
  const route = (data as { route?: Array<{ x: number; y: number }> } | undefined)?.route;
  const [edgePath, labelX, labelY] = route && route.length > 1 && !isSelfLoop
    ? routePath(route)
    : isSelfLoop
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
        className={`${selected ? 'fsm-edge fsm-edge-selected' : 'fsm-edge'}${isReverse ? ' fsm-edge-reverse' : ''}`}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={isReverse ? 'fsm-edge-label fsm-edge-label-reverse' : 'fsm-edge-label'}
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

function routePath(points: Array<{ x: number; y: number }>): [string, number, number] {
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const middle = points[Math.floor(points.length / 2)];
  return [path, middle.x, middle.y];
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
  layers,
  editing,
  onUpdate,
  onDelete
}: {
  state: FsmState;
  labels: UiText;
  layers: FsmLayer[];
  editing: boolean;
  onUpdate: (updates: Partial<FsmState>) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <section className="inspector-card">
      <h3>{labels.stateProperties}</h3>
      <label>{labels.title}<DraftTextInput value={state.title} disabled={!editing} onCommit={(title) => onUpdate({ title })} /></label>
      <label>
        {labels.screenLayerAssignment}
        <select disabled={!editing} aria-label={labels.screenLayerAssignment} value={state.subsystem || 'user'} onChange={(event) => onUpdate({ subsystem: event.target.value })}>
          <option value="user">{labels.generalLayerOption}</option>
          {layers.filter((layer) => layer.id !== 'user').map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
        </select>
      </label>
      <label>
        {labels.stateMark}
        <select disabled={!editing} value={state.stateType} onChange={(event) => onUpdate({ stateType: event.target.value })}>
          <option value="initial">{labels.initialState}</option>
          <option value="process">{labels.processState}</option>
          <option value="success">{labels.successState}</option>
          <option value="failure">{labels.failureState}</option>
        </select>
      </label>
      <label className="checkbox-line"><input disabled={!editing} type="checkbox" checked={state.initial} onChange={(event) => onUpdate({ initial: event.target.checked })} />{labels.initialState}</label>
      <label className="checkbox-line"><input disabled={!editing} type="checkbox" checked={state.terminal} onChange={(event) => onUpdate({ terminal: event.target.checked })} />{labels.terminalState}</label>
      <button type="button" className="delete-button" onClick={onDelete} disabled={!editing}><Trash2 size={15} />{labels.deleteState}</button>
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
  editing,
  onAddRoute
}: {
  labels: UiText;
  currentStateId: string;
  states: Record<string, FsmState>;
  stateOrder: string[];
  eventOrder: string[];
  eventNames: Record<string, string>;
  editing: boolean;
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
      <button type="button" disabled={!editing || !targetStateId || !eventId} onClick={() => onAddRoute(targetStateId, eventId, direction, condition)}>
        {labels.addRoute}
      </button>
    </section>
  );
}

const NEW_EVENT_SENTINEL = '__new-event__';

/** Visual verification aid: selecting an arrow always reveals both linked
 * display states, rather than forcing the operator to locate them on a large
 * FSM canvas. */
function TransitionLinkPreview({
  transition,
  language,
  fontGlyphs,
  labels
}: {
  transition: FsmTransition;
  language: LanguageCode;
  fontGlyphs: ReturnType<typeof useProjectStore.getState>['fontGlyphs'];
  labels: UiText;
}): React.ReactElement {
  const project = useProjectStore((state) => state.project)!;
  const selectState = useProjectStore((state) => state.selectState);
  const from = project.fsm.states[transition.from];
  const to = project.fsm.states[transition.to];
  const button = transition.trigger.buttonId ? project.controlPanel.elements[transition.trigger.buttonId] : null;
  const caption = button?.type === 'button'
    ? button.label
    : transition.labelMode === 'auto' ? 'Auto' : project.fsm.events[transition.trigger.eventId]?.name ?? 'Auto';
  const backendProcess = transition.backendProcessId ? project.backendProcesses[transition.backendProcessId] : null;
  const cliCommands = backendProcess?.commands.map((command) => project.cliCatalog?.[command]?.command ?? command) ?? [];
  const cards = [
    { title: 'Исходное состояние', state: from },
    { title: 'Целевое состояние', state: to }
  ];
  return (
    <section className="transition-link-preview" aria-label={labels.transitionLinkedScreensAria}>
      <header>
        <h3>{labels.transitionCheck}</h3>
        <span className="transition-link-event">{caption}</span>
      </header>
      <p className="transition-link-direction">{from?.title ?? transition.from} <b>→</b> {to?.title ?? transition.to}</p>
      <div className="transition-link-screens">
        {cards.map(({ title, state }) => {
          const screen = state?.screenId ? project.screens[state.screenId] : null;
          return (
            <article key={title}>
              <small>{title}</small>
              <button type="button" onClick={() => state && selectState(state.id)} title={labels.selectStateOnCanvas}>
                <strong>{state?.title ?? 'Состояние отсутствует'}</strong>
                {screen ? (
                  <LCDCanvas
                    canvasData={{ stateId: screen.id, width: screen.width, height: screen.height, objects: screen.objects, selectedObjectIds: [], updatedAt: screen.updatedAt }}
                    language={project.authoringLanguage ?? 'en'}
                    scale={1}
                    className="transition-link-lcd"
                    fontRenderer={new FontRenderer(fontGlyphs)}
                  />
                ) : <em>{labels.lcdNotLinked}</em>}
              </button>
            </article>
          );
        })}
      </div>
      <small className="transition-link-meta">{transition.kind} · {transition.trigger.mechanism ?? 'event'}{transition.condition ? ` · ${transition.condition}` : ''}</small>
      {cliCommands.length ? (
        <section className="transition-cli-command" aria-label={labels.cliTransitionCommandsAria}>
          <strong>{labels.cliPrefixLabel} {backendProcess?.name}</strong>
          {cliCommands.map((command) => <code key={command}>{command}</code>)}
        </section>
      ) : null}
    </section>
  );
}

function TransitionValidation({ transition, project }: { transition: FsmTransition; project: LcdBitmapProject }): React.ReactElement {
  const checks = [
    { label: 'Исходное состояние', valid: Boolean(project.fsm.states[transition.from]) },
    { label: 'Целевое состояние', valid: Boolean(project.fsm.states[transition.to]) },
    { label: 'Событие', valid: Boolean(project.fsm.events[transition.trigger.eventId]) },
    { label: 'Условие', valid: transition.kind !== 'guarded' || Boolean(transition.condition?.trim()) },
    { label: 'Backend-процесс', valid: transition.kind !== 'backend' || Boolean(transition.backendProcessId && project.backendProcesses[transition.backendProcessId]) },
  ];
  const valid = checks.every((check) => check.valid);
  return (
    <section className={`transition-validation ${valid ? 'valid' : 'invalid'}`} aria-live="polite">
      <header><strong>{valid ? 'Переход готов' : 'Требуется проверка'}</strong><span>{checks.filter((check) => check.valid).length}/{checks.length}</span></header>
      <ul>{checks.map((check) => <li key={check.label}>{check.valid ? '✓' : '!' } {check.label}</li>)}</ul>
    </section>
  );
}

function TransitionInspector({
  transition,
  labels,
  editing,
  onUpdate,
  onDelete,
  onCreateEvent,
  onRenameEvent,
  onUpdateEvent,
  onUpdateBackendDescription
}: {
  transition: FsmTransition;
  labels: UiText;
  editing: boolean;
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
        {labels.transitionSourceState}
        <select
          value={transition.from}
          onChange={(event) => {
            const from = event.target.value;
            onUpdate({ from });
            if (currentEvent?.scope === 'state') {
              onUpdateEvent(currentEvent.id, { scope: 'state', sourceStateId: from });
            }
          }}
        >
          {project.fsm.stateOrder.map((stateId) => (
            <option key={stateId} value={stateId}>{project.fsm.states[stateId]?.title ?? stateId}</option>
          ))}
        </select>
      </label>
      <label>
        {labels.transitionTargetState}
        <select value={transition.to} onChange={(event) => onUpdate({ to: event.target.value })}>
          {project.fsm.stateOrder.map((stateId) => (
            <option key={stateId} value={stateId}>{project.fsm.states[stateId]?.title ?? stateId}</option>
          ))}
        </select>
      </label>
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
        {labels.edgeLabelSelect}
        <select
          value={transition.labelMode ?? (boundButtonLabel ? 'button' : 'auto')}
          onChange={(event) => onUpdate({ labelMode: event.target.value as FsmTransition['labelMode'] })}
        >
          <option value="button" disabled={!boundButtonLabel}>{labels.edgeLabelButton}{boundButtonLabel ? `: ${boundButtonLabel}` : ''}</option>
          <option value="event">{labels.edgeLabelEvent}</option>
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
      <button type="button" className="delete-button" onClick={onDelete} disabled={!editing}><Trash2 size={15} />{labels.deleteTransition}</button>
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

function DraftTextInput({
  value,
  disabled,
  onCommit
}: {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          cancelledRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
        } else if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function arrangePositionsInLanes(
  positions: Map<string, { x: number; y: number }>,
  stateIds: string[],
  subsystemOf: (stateId: string) => string
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const subsystems = [...new Set(stateIds.map(subsystemOf))];
  subsystems.forEach((subsystem, laneIndex) => {
    const laneIds = stateIds
      .filter((stateId) => subsystemOf(stateId) === subsystem)
      .sort((left, right) => (positions.get(left)?.x ?? 0) - (positions.get(right)?.x ?? 0));
    laneIds.forEach((stateId, columnIndex) => {
      result.set(stateId, { x: 80 + columnIndex * 310, y: 80 + laneIndex * 190 });
    });
  });
  return result;
}

function confirmFsmDelete(kind: 'state' | 'transition', count: number, title?: string): boolean {
  const entity = kind === 'state'
    ? count === 1 ? `состояние${title ? ` «${title}»` : ''}` : `состояния (${count})`
    : count === 1 ? 'переход' : `переходы (${count})`;
  return window.confirm(`Удалить ${entity}? Операцию можно отменить через Undo.`);
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

function sameStateSelection(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

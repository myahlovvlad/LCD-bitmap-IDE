/**
 * ELK-based FSM layout engine.
 *
 * Produces an orthogonal, crossing-minimised, hierarchical layout for
 * the FSM graph using the Eclipse Layout Kernel (elkjs).
 *
 * Algorithm: ELK LAYERED
 *   - Direction: LEFT → RIGHT (standard FSM reading direction)
 *   - Edge routing: ORTHOGONAL (no diagonal lines)
 *   - Crossing minimisation: enabled
 *   - Hierarchical grouping: subsystems become ELK "sections"
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';

export interface SubsystemMeta {
  id: string;
  label: string;
  color: string;
}

const SUBSYSTEM_PALETTE: Record<string, string> = {
  'diagnostic':   'rgba(239, 68,  68,  0.08)',
  'main-menu':    'rgba(99,  102, 241, 0.10)',
  'photometry':   'rgba(34,  197, 94,  0.08)',
  'quantitative': 'rgba(20,  184, 166, 0.08)',
  'kinetics':     'rgba(251, 191, 36,  0.08)',
  'multiwave':    'rgba(168, 85,  247, 0.08)',
  'settings':     'rgba(107, 114, 128, 0.10)',
  'files':        'rgba(245, 158, 11,  0.08)',
  'shared':       'rgba(148, 163, 184, 0.06)',
  'user':         'rgba(100, 116, 139, 0.06)',
  'system':       'rgba(239, 68,  68,  0.06)',

  // Scenario-stage sub-layers — one per functional phase within a subsystem,
  // so a branch (e.g. "Кинетика: измерение") can be isolated in the FSM
  // diagram independently of the rest of that subsystem. Same base hue as
  // the parent subsystem above, to keep the family visually recognisable.
  'diagnostic-selftest':         'rgba(239, 68,  68,  0.08)',
  'diagnostic-warmup':           'rgba(239, 68,  68,  0.08)',
  'photometry-zeroing':          'rgba(34,  197, 94,  0.08)',
  'photometry-parameters':       'rgba(34,  197, 94,  0.08)',
  'photometry-measurement':      'rgba(34,  197, 94,  0.08)',
  'photometry-save-print':       'rgba(34,  197, 94,  0.08)',
  'quantitative-curves-setup':   'rgba(20,  184, 166, 0.08)',
  'quantitative-curves-measure': 'rgba(20,  184, 166, 0.08)',
  'quantitative-curves-save':    'rgba(20,  184, 166, 0.08)',
  'quantitative-analysis':       'rgba(20,  184, 166, 0.08)',
  'quantitative-coefficients':   'rgba(20,  184, 166, 0.08)',
  'kinetics-parameters':         'rgba(251, 191, 36,  0.08)',
  'kinetics-measurement':        'rgba(251, 191, 36,  0.08)',
  'kinetics-save':               'rgba(251, 191, 36,  0.08)',
  'multiwave-parameters':        'rgba(168, 85,  247, 0.08)',
  'multiwave-measurement':       'rgba(168, 85,  247, 0.08)',
  'multiwave-save':              'rgba(168, 85,  247, 0.08)',
  'settings-lamps':              'rgba(107, 114, 128, 0.10)',
  'settings-diagnostics':        'rgba(107, 114, 128, 0.10)',
  'settings-system':             'rgba(107, 114, 128, 0.10)',
  'files-photometry':            'rgba(245, 158, 11,  0.08)',
  'files-other':                 'rgba(245, 158, 11,  0.08)',
};

const SUBSYSTEM_LABELS: Record<string, string> = {
  'diagnostic':   '1 · Диагностика',
  'main-menu':    '2 · Главное меню',
  'photometry':   '3 · Фотометрия',
  'quantitative': '4 · Количественный анализ',
  'kinetics':     '5 · Кинетика',
  'multiwave':    '6 · Многоволновый режим',
  'settings':     '7 · Настройки',
  'files':        '8 · Файлы',
  'shared':       'Общие состояния',
  'user':         'Прочие',
  'system':       'Система',

  'diagnostic-selftest':         '1 · Диагностика: самотестирование',
  'diagnostic-warmup':           '1 · Диагностика: прогрев',
  'photometry-zeroing':          '3 · Фотометрия: обнуление',
  'photometry-parameters':       '3 · Фотометрия: параметры',
  'photometry-measurement':      '3 · Фотометрия: измерение',
  'photometry-save-print':       '3 · Фотометрия: сохранение/печать',
  'quantitative-curves-setup':   '4 · Кол. анализ: градуировка — настройка',
  'quantitative-curves-measure': '4 · Кол. анализ: градуировка — измерение',
  'quantitative-curves-save':    '4 · Кол. анализ: градуировка — сохранение',
  'quantitative-analysis':       '4 · Кол. анализ: анализ пробы',
  'quantitative-coefficients':   '4 · Кол. анализ: метод коэффициентов',
  'kinetics-parameters':         '5 · Кинетика: параметры',
  'kinetics-measurement':        '5 · Кинетика: измерение',
  'kinetics-save':               '5 · Кинетика: сохранение/печать',
  'multiwave-parameters':        '6 · Многоволновый: параметры',
  'multiwave-measurement':       '6 · Многоволновый: измерение',
  'multiwave-save':              '6 · Многоволновый: сохранение/печать',
  'settings-lamps':              '7 · Настройки: лампы',
  'settings-diagnostics':        '7 · Настройки: диагностика/калибровка',
  'settings-system':             '7 · Настройки: система',
  'files-photometry':            '8 · Файлы: фотометрия',
  'files-other':                 '8 · Файлы: прочее',
};

export interface ELKLayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  paddingX?: number;
  paddingY?: number;
}

export interface ElkEdgeRoute {
  id: string;
  points: Array<{ x: number; y: number }>;
}

export interface ElkLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  routes: Map<string, ElkEdgeRoute>;
}

const elk = new ELK();

export async function computeElkLayoutWithRoutes(
  nodes: Node[],
  edges: Edge[],
  subsystemField: (nodeId: string) => string,
  opts: ELKLayoutOptions = {}
): Promise<ElkLayoutResult> {
  const {
    direction = 'LR',
    nodeWidth = 220,
    nodeHeight = 72,
    paddingX = 80,
    paddingY = 60,
  } = opts;

  // Group nodes by subsystem
  const groups: Record<string, string[]> = {};
  for (const node of nodes) {
    const sub = subsystemField(node.id) || 'user';
    (groups[sub] ??= []).push(node.id);
  }

  // Build ELK children (flat, no nested groups — ELK handles placement)
  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: nodeWidth,
    height: nodeHeight,
    layoutOptions: {
      'elk.portConstraints': 'FIXED_SIDE',
    }
  }));

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm':                    'layered',
      'elk.direction':                    direction,
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.edgeRouting':                  'ORTHOGONAL',
      'elk.layered.unnecessaryBendpoints': 'true',
      'elk.spacing.nodeNode':             String(paddingX),
      'elk.spacing.edgeNode':             '20',
      'elk.spacing.edgeEdge':             '8',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(paddingX * 1.5),
      'elk.padding':                      `[top=${paddingY},left=${paddingX},bottom=${paddingY},right=${paddingX}]`,
      // Keeping components in one layout pass avoids the very tall, sparse
      // columns that result when every isolated screen gets its own canvas.
      'elk.separateConnectedComponents':  'false',
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    if (child.x !== undefined && child.y !== undefined) {
      positions.set(child.id, { x: child.x, y: child.y });
    }
  }
  const routes = new Map<string, ElkEdgeRoute>();
  for (const edge of result.edges ?? []) {
    const section = edge.sections?.[0];
    if (!section?.startPoint || !section?.endPoint) continue;
    routes.set(edge.id, {
      id: edge.id,
      points: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
        .map((point) => ({ x: point.x, y: point.y }))
    });
  }
  return { positions, routes };
}

/** Compatibility helper for callers that only persist node coordinates. */
export async function computeElkLayout(
  nodes: Node[],
  edges: Edge[],
  subsystemField: (nodeId: string) => string,
  opts: ELKLayoutOptions = {}
): Promise<Map<string, { x: number; y: number }>> {
  return (await computeElkLayoutWithRoutes(nodes, edges, subsystemField, opts)).positions;
}

export function getSubsystemColor(subsystem: string): string {
  return SUBSYSTEM_PALETTE[subsystem] ?? 'rgba(100, 116, 139, 0.06)';
}

export function getSubsystemLabel(subsystem: string): string {
  return SUBSYSTEM_LABELS[subsystem] ?? subsystem;
}

/** Compute per-subsystem bounding boxes from laid-out node positions. */
export function computeSwimlaneBounds(
  nodePositions: Map<string, { x: number; y: number }>,
  nodeIds: string[],
  subsystemField: (id: string) => string,
  nodeWidth = 220,
  nodeHeight = 72,
  padding = 24,
): SubsystemBand[] {
  const grouped: Record<string, Array<{ x: number; y: number }>> = {};
  for (const id of nodeIds) {
    const pos = nodePositions.get(id);
    if (!pos) continue;
    const sub = subsystemField(id) || 'user';
    (grouped[sub] ??= []).push(pos);
  }

  return Object.entries(grouped).map(([sub, positions]) => {
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...xs) + nodeWidth + padding;
    const maxY = Math.max(...ys) + nodeHeight + padding;
    return {
      subsystem: sub,
      label: getSubsystemLabel(sub),
      color: getSubsystemColor(sub),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  });
}

export interface SubsystemBand {
  subsystem: string;
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

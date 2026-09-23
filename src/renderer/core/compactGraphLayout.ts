import type { FsmState, GraphPosition } from '../types/domain';

const subsystemOrder = [
  'system',
  // legacy single-layer-per-subsystem names, kept for projects that don't split scenario stages
  'diagnostic',
  'photometry',
  'quant',
  'quantitative',
  'kinetics',
  'multiwave',
  'settings',
  'files',
  // scenario-stage sub-layers (see elkLayout.ts SUBSYSTEM_LABELS for the matching Russian names)
  'diagnostic-selftest',
  'diagnostic-warmup',
  'main-menu',
  'photometry-zeroing',
  'photometry-parameters',
  'photometry-measurement',
  'photometry-save-print',
  'quantitative-curves-setup',
  'quantitative-curves-measure',
  'quantitative-curves-save',
  'quantitative-analysis',
  'quantitative-coefficients',
  'kinetics-parameters',
  'kinetics-measurement',
  'kinetics-save',
  'multiwave-parameters',
  'multiwave-measurement',
  'multiwave-save',
  'settings-lamps',
  'settings-diagnostics',
  'settings-system',
  'files-photometry',
  'files-other',
  'shared'
];

export function buildCompactGraphLayout(
  stateOrder: string[],
  states: Record<string, FsmState>
): Record<string, GraphPosition> {
  const grouped = new Map<string, string[]>();

  for (const stateId of stateOrder) {
    const subsystem = states[stateId]?.subsystem ?? 'unknown';
    const bucket = grouped.get(subsystem) ?? [];
    bucket.push(stateId);
    grouped.set(subsystem, bucket);
  }

  const sortedSubsystems = [...grouped.keys()].sort((a, b) => {
    const aIndex = subsystemOrder.indexOf(a);
    const bIndex = subsystemOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  });

  const layout: Record<string, GraphPosition> = {};
  sortedSubsystems.forEach((subsystem, columnIndex) => {
    grouped.get(subsystem)?.forEach((stateId, rowIndex) => {
      layout[stateId] = {
        x: columnIndex * 210,
        y: rowIndex * 82
      };
    });
  });

  return layout;
}

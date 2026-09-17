import type { WorkspaceMode } from '../../domain/project';

export type WorkspaceGroupId = 'interface' | 'logic' | 'hardware' | 'delivery';

export interface WorkspaceGroup {
  id: WorkspaceGroupId;
  modes: readonly WorkspaceMode[];
}

export const WORKSPACE_GROUPS: readonly WorkspaceGroup[] = [
  { id: 'interface', modes: ['lcd', 'control-panel', 'text-registry', 'screen-dsl'] },
  { id: 'logic', modes: ['fsm', 'alarms'] },
  { id: 'hardware', modes: ['tags', 'procedures'] },
  { id: 'delivery', modes: ['hmi', 'preview', 'runtime', 'handoff', 'ux-validation'] }
];

export function groupForWorkspace(mode: WorkspaceMode): WorkspaceGroupId {
  return WORKSPACE_GROUPS.find((group) => group.modes.includes(mode))?.id ?? 'logic';
}

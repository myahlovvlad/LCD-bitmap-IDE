import type { LcdBitmapProject, WorkspaceMode } from '../../domain/project';

export const EDITOR_WORKSPACE_MODES = [
  'lcd',
  'control-panel',
  'text-registry',
  'screen-dsl',
  'tags',
  'procedures',
  'alarms'
] as const satisfies readonly WorkspaceMode[];

export type EditorWorkspaceMode = typeof EDITOR_WORKSPACE_MODES[number];

export function isEditorWorkspaceMode(mode: WorkspaceMode): mode is EditorWorkspaceMode {
  return EDITOR_WORKSPACE_MODES.includes(mode as EditorWorkspaceMode);
}

export function editorEntityCount(project: LcdBitmapProject, mode: EditorWorkspaceMode): number {
  switch (mode) {
    case 'lcd':
    case 'screen-dsl':
      return project.screenOrder.length;
    case 'control-panel':
      return project.controlPanel.elementOrder.length;
    case 'text-registry':
      return project.screenOrder.reduce((total, screenId) => (
        total + (project.screens[screenId]?.objects.filter((object) => object.type === 'text').length ?? 0)
      ), 0);
    case 'tags':
      return Object.keys(project.tags ?? {}).length;
    case 'procedures':
      return Object.keys(project.procedures ?? {}).length;
    case 'alarms':
      return Object.keys(project.alarms ?? {}).length;
  }
}

export function editorBlockingIssueCount(project: LcdBitmapProject, mode: EditorWorkspaceMode): number {
  return project.validation.issues.filter((issue) => {
    if (issue.severity !== 'error') return false;
    if (mode === 'lcd' || mode === 'text-registry' || mode === 'screen-dsl') return issue.domain === 'lcd';
    if (mode === 'control-panel') return issue.domain === 'control-panel';
    if (mode === 'tags') return issue.entityType === 'tag';
    if (mode === 'procedures') return issue.entityType === 'procedure' || issue.entityType === 'backend-process';
    return issue.entityType === 'alarm';
  }).length;
}

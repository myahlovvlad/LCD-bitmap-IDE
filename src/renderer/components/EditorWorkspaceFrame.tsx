import type React from 'react';
import type { LcdBitmapProject } from '../../domain/project';
import type { UiText } from '../config/i18n';
import {
  editorBlockingIssueCount,
  editorEntityCount,
  type EditorWorkspaceMode
} from '../navigation/editorWorkspaces';

export function EditorWorkspaceFrame({
  mode,
  project,
  labels,
  children
}: {
  mode: EditorWorkspaceMode;
  project: LcdBitmapProject;
  labels: UiText;
  children: React.ReactNode;
}): React.ReactElement {
  const errors = editorBlockingIssueCount(project, mode);
  return (
    <section className="editor-workspace-frame" data-testid="editor-workspace-frame" data-editor-mode={mode}>
      <header className="editor-context-bar">
        <div className="editor-context-copy">
          <span className="editor-context-stage">{stageLabel(mode, labels)}</span>
          <strong>{titleLabel(mode, labels)}</strong>
          <span>{purposeLabel(mode, labels)}</span>
        </div>
        <div className="editor-context-metrics" aria-label={labels.editorWorkspaceStatus}>
          <span><b>{editorEntityCount(project, mode)}</b> {labels.editorEntities}</span>
          <span className={errors ? 'editor-context-errors' : 'editor-context-valid'}>
            {errors ? labels.editorBlockingIssues.replace('{count}', String(errors)) : labels.editorValidationClear}
          </span>
        </div>
      </header>
      <div className="editor-workspace-body">{children}</div>
    </section>
  );
}

function stageLabel(mode: EditorWorkspaceMode, labels: UiText): string {
  if (mode === 'lcd' || mode === 'control-panel' || mode === 'text-registry' || mode === 'screen-dsl') {
    return labels.workspaceGroupInterface;
  }
  if (mode === 'alarms') return labels.workspaceGroupLogic;
  return labels.workspaceGroupHardware;
}

function titleLabel(mode: EditorWorkspaceMode, labels: UiText): string {
  const titles: Record<EditorWorkspaceMode, string> = {
    lcd: labels.lcdEditor,
    'control-panel': labels.controlPanelEditor,
    'text-registry': labels.textRegistryWorkspace,
    'screen-dsl': labels.screenDslWorkspace,
    tags: labels.tagsWorkspace,
    procedures: labels.proceduresWorkspace,
    alarms: labels.alarmsWorkspace
  };
  return titles[mode];
}

function purposeLabel(mode: EditorWorkspaceMode, labels: UiText): string {
  const purposes: Record<EditorWorkspaceMode, string> = {
    lcd: labels.editorPurposeLcd,
    'control-panel': labels.editorPurposePanel,
    'text-registry': labels.editorPurposeTexts,
    'screen-dsl': labels.editorPurposeDsl,
    tags: labels.editorPurposeTags,
    procedures: labels.editorPurposeProcedures,
    alarms: labels.editorPurposeAlarms
  };
  return purposes[mode];
}

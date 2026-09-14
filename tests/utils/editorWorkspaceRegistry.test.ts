import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import {
  EDITOR_WORKSPACE_MODES,
  editorEntityCount,
  isEditorWorkspaceMode
} from '../../src/renderer/navigation/editorWorkspaces';

describe('editor workspace registry', () => {
  it('contains every model editor exactly once', () => {
    expect(EDITOR_WORKSPACE_MODES).toEqual([
      'lcd',
      'control-panel',
      'text-registry',
      'screen-dsl',
      'tags',
      'procedures',
      'alarms'
    ]);
    expect(new Set(EDITOR_WORKSPACE_MODES).size).toBe(EDITOR_WORKSPACE_MODES.length);
    expect(isEditorWorkspaceMode('runtime')).toBe(false);
    expect(isEditorWorkspaceMode('lcd')).toBe(true);
  });

  it('reports the domain entity count shown by the shared context header', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.tags = { sample: { id: 'sample', name: { en: 'Sample', ru: 'Проба', zh: '样品' }, dataType: 'string' } };
    project.procedures = { measure: { id: 'measure', name: { en: 'Measure', ru: 'Измерение', zh: '测量' }, services: [], steps: [] } };
    project.alarms = { lamp: { id: 'lamp', name: { en: 'Lamp', ru: 'Лампа', zh: '灯' }, severity: 'warning', condition: { kind: 'literal', value: false }, message: { en: 'Lamp', ru: 'Лампа', zh: '灯' } } };

    expect(editorEntityCount(project, 'lcd')).toBe(project.screenOrder.length);
    expect(editorEntityCount(project, 'control-panel')).toBe(project.controlPanel.elementOrder.length);
    expect(editorEntityCount(project, 'text-registry')).toBeGreaterThan(0);
    expect(editorEntityCount(project, 'screen-dsl')).toBe(project.screenOrder.length);
    expect(editorEntityCount(project, 'tags')).toBe(1);
    expect(editorEntityCount(project, 'procedures')).toBe(1);
    expect(editorEntityCount(project, 'alarms')).toBe(1);
  });
});

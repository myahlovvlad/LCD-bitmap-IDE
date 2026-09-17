import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { LcdBitmapProject } from '../../src/domain/project';
import { buildProjectSemanticIndex } from '../../src/services/semantic/semanticIndexBuilder';

function loadDemoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

describe('buildProjectSemanticIndex', () => {
  it('indexes every executable screen/state/transition/control exactly once', () => {
    const project = loadDemoProject();
    const index = buildProjectSemanticIndex(project);

    expect(index.screens.map((item) => item.screenId).sort()).toEqual(Object.keys(project.screens).sort());
    expect(index.states.map((item) => item.stateId).sort()).toEqual(Object.keys(project.fsm.states).sort());
    expect(index.transitions.map((item) => item.transitionId).sort()).toEqual(Object.keys(project.fsm.transitions).sort());
    expect(index.controls.map((item) => item.controlId).sort()).toEqual(Object.keys(project.controlPanel.elements).sort());
  });

  it('emits explicit state/screen, state/state, transition/event and control/event relations', () => {
    const index = buildProjectSemanticIndex(loadDemoProject());
    expect(index.relations.some((relation) => relation.kind === 'state.uses_screen')).toBe(true);
    expect(index.relations.some((relation) => relation.kind === 'screen.represents_state')).toBe(true);
    expect(index.relations.some((relation) => relation.kind === 'state.next_state')).toBe(true);
    expect(index.relations.some((relation) => relation.kind === 'transition.triggered_by_event')).toBe(true);
    expect(index.relations.some((relation) => relation.kind === 'control.emits_event')).toBe(true);
  });

  it('summarizes screen layout objects without duplicating bitmap payloads', () => {
    const project = loadDemoProject();
    const index = buildProjectSemanticIndex(project);
    const first = index.screens.find((item) => item.screenId === project.screenOrder[0])!;
    expect(first.layout.width).toBe(project.screens[first.screenId].width);
    expect(first.layout.height).toBe(project.screens[first.screenId].height);
    expect(first.layout.objects).toHaveLength(project.screens[first.screenId].objects.length);
    expect(first.layout.objects.every((object) => typeof object.id === 'string' && typeof object.type === 'string')).toBe(true);
  });

  it('is deterministic for an unchanged project', () => {
    const project = loadDemoProject();
    expect(buildProjectSemanticIndex(project)).toEqual(buildProjectSemanticIndex(project));
  });

  it('reports states without a screen instead of dropping them', () => {
    const project = loadDemoProject();
    project.fsm.states['glyph-test'].screenId = null;
    const index = buildProjectSemanticIndex(project);
    expect(index.states.some((state) => state.stateId === 'glyph-test')).toBe(true);
    expect(index.diagnostics.some((item) => item.code === 'semantic.state-screen-missing' && item.entityId === 'glyph-test')).toBe(true);
  });
});

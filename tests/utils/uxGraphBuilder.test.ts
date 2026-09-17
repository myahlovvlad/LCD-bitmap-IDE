import { describe, expect, it } from 'vitest';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import { rebuildProjectBindings, type ControlPanelButton, type LcdBitmapProject } from '../../src/domain/project';
import { buildUxContractIdRefs, normalizeUxContract } from '../../src/domain/uxContract';
import { buildProjectUxGraph } from '../../src/services/ux/uxGraphBuilder';

function loadDemoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

/** The demo project's migration auto-provisions one default control-panel button per FSM
 *  event; clear it so a test's own button is the unambiguous, deterministic trigger. */
function clearControlPanel(project: LcdBitmapProject): void {
  project.controlPanel.elements = {};
  project.controlPanel.elementOrder = [];
}

function syncBindings(project: LcdBitmapProject): void {
  project.bindings = rebuildProjectBindings(project);
}

describe('buildProjectUxGraph', () => {
  it('extracts every screen, state and transition from the demo project', () => {
    const graph = buildProjectUxGraph(loadDemoProject());
    expect(graph.states.map((s) => s.stateId).sort()).toEqual(['error', 'glyph-test', 'main-menu', 'measure', 'save-result'].sort());
    expect(graph.transitions).toHaveLength(4);
    expect(graph.screens.length).toBeGreaterThan(0);
  });

  it('computes outgoing/incoming transition ids per state', () => {
    const graph = buildProjectUxGraph(loadDemoProject());
    const mainMenu = graph.statesById.get('main-menu')!;
    expect(mainMenu.outgoingTransitionIds).toEqual(['tr-main-measure']);
    const error = graph.statesById.get('error')!;
    expect(error.incomingTransitionIds).toEqual(['tr-measure-error']);
    expect(error.outgoingTransitionIds).toEqual(['tr-error-main']);
  });

  it('leaves a state with no transitions isolated in both directions', () => {
    const graph = buildProjectUxGraph(loadDemoProject());
    const glyphTest = graph.statesById.get('glyph-test')!;
    expect(glyphTest.outgoingTransitionIds).toEqual([]);
    expect(glyphTest.incomingTransitionIds).toEqual([]);
  });

  it('links a control-panel button to the transition its fsmEventId fires', () => {
    const project = loadDemoProject();
    clearControlPanel(project);
    const button: ControlPanelButton = {
      id: 'btn-start', type: 'button', x: 0, y: 0, width: 40, height: 20, rotation: 0, locked: false, visible: true,
      label: 'Start', shape: 'rect', fsmEventId: 'START', allowedStates: ['main-menu']
    };
    project.controlPanel.elements[button.id] = button;
    project.controlPanel.elementOrder.push(button.id);
    syncBindings(project);

    const graph = buildProjectUxGraph(project);
    const control = graph.controlsById.get('btn-start')!;
    expect(control.linkedTransitionIds).toEqual(['tr-main-measure']);
    const transition = graph.transitionsById.get('tr-main-measure')!;
    expect(transition.triggerControlId).toBe('btn-start');
  });

  it('extracts visible text per locale from text canvas objects', () => {
    const graph = buildProjectUxGraph(loadDemoProject());
    const mainScreen = graph.screensById.get(graph.statesById.get('main-menu')!.screenId!)!;
    const texts = graph.visibleTexts.filter((t) => t.screenId === mainScreen.screenId);
    expect(texts.some((t) => t.locale === 'en' && t.text === 'UNIVERSAL LCD')).toBe(true);
    expect(texts.some((t) => t.locale === 'ru' && t.text === 'LCD СИМУЛЯТОР')).toBe(true);
  });

  it('records a diagnostic when a control references a deleted FSM event', () => {
    const project = loadDemoProject();
    const button: ControlPanelButton = {
      id: 'btn-ghost', type: 'button', x: 0, y: 0, width: 40, height: 20, rotation: 0, locked: false, visible: true,
      label: 'Ghost', shape: 'rect', fsmEventId: 'DOES_NOT_EXIST'
    };
    project.controlPanel.elements[button.id] = button;
    project.controlPanel.elementOrder.push(button.id);

    const graph = buildProjectUxGraph(project);
    expect(graph.diagnostics.some((d) => d.code === 'ux.graph.control-event-missing')).toBe(true);
  });

  it('normalizes a raw, unmigrated uxContract on the fly', () => {
    const project = loadDemoProject();
    project.uxContract = normalizeUxContract({ states: { 'main-menu': { role: 'navigation' } } }, buildUxContractIdRefs(project));
    const graph = buildProjectUxGraph(project);
    expect(graph.statesById.get('main-menu')!.role).toBe('navigation');
  });
});

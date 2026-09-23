import { describe, expect, it } from 'vitest';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import { rebuildProjectBindings, type ControlPanelButton, type LcdBitmapProject } from '../../src/domain/project';
import { buildUxContractIdRefs, normalizeUxContract, type ProjectUxContract } from '../../src/domain/uxContract';
import { buildProjectUxGraph } from '../../src/services/ux/uxGraphBuilder';
import { evaluateStructureRules } from '../../src/services/ux/uxRules/structureRules';
import { evaluateNavigationRules } from '../../src/services/ux/uxRules/navigationRules';
import { evaluateSemanticsRules } from '../../src/services/ux/uxRules/semanticsRules';
import { evaluateSafetyRules } from '../../src/services/ux/uxRules/safetyRules';
import { evaluateScenarioRules } from '../../src/services/ux/uxRules/scenarioRules';
import { runUxScenario } from '../../src/services/ux/uxScenarioRunner';
import { analyzeProjectUx } from '../../src/services/ux/uxValidator';
import type { UxValidationFinding } from '../../src/services/ux/uxTypes';

function loadDemoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

function setUxContract(project: LcdBitmapProject, patch: Partial<ProjectUxContract>): void {
  project.uxContract = normalizeUxContract(patch, buildUxContractIdRefs(project));
}

function syncBindings(project: LcdBitmapProject): void {
  project.bindings = rebuildProjectBindings(project);
}

/** The demo project's migration auto-provisions one default control-panel button per FSM
 *  event; clear it so a test's own button is the unambiguous, deterministic trigger. */
function clearControlPanel(project: LcdBitmapProject): void {
  project.controlPanel.elements = {};
  project.controlPanel.elementOrder = [];
}

function addButton(project: LcdBitmapProject, id: string, fsmEventId: string | undefined, opts: Partial<ControlPanelButton> = {}): void {
  const button: ControlPanelButton = {
    id,
    type: 'button',
    x: 0, y: 0, width: 40, height: 20, rotation: 0, locked: false, visible: true,
    label: id,
    shape: 'rect',
    fsmEventId,
    ...opts
  };
  project.controlPanel.elements[id] = button;
  project.controlPanel.elementOrder.push(id);
  syncBindings(project);
}

/** glyph-test is intentionally orphaned in the demo project (for orphan-state coverage), which
 *  makes it the demo project's only source of deterministic 'error' findings. Some tests need a
 *  project with zero deterministic errors as a clean baseline. */
function withoutOrphanState(project: LcdBitmapProject): LcdBitmapProject {
  delete project.fsm.states['glyph-test'];
  project.fsm.stateOrder = project.fsm.stateOrder.filter((id) => id !== 'glyph-test');
  syncBindings(project);
  return project;
}

function ruleIds(findings: readonly UxValidationFinding[]): string[] {
  return findings.map((f) => f.ruleId);
}

describe('UX structure rules', () => {
  it('flags a state with no bound screen (ux.screen-state-binding-missing)', () => {
    const project = loadDemoProject();
    project.fsm.states['main-menu'].screenId = null;
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.screen-state-binding-missing');
  });

  it('flags a state referencing a missing screen (ux.state-screen-binding-invalid)', () => {
    const project = loadDemoProject();
    project.fsm.states['main-menu'].screenId = 'does-not-exist';
    const graph = buildProjectUxGraph(project);
    const finding = evaluateStructureRules(graph).find((f) => f.ruleId === 'ux.state-screen-binding-invalid');
    expect(finding?.severity).toBe('error');
  });

  it('flags a button-mechanism transition with no bound control (ux.user-transition-without-visible-trigger)', () => {
    const project = loadDemoProject();
    clearControlPanel(project);
    project.fsm.transitions['tr-main-measure'].trigger.mechanism = 'button';
    syncBindings(project);
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.user-transition-without-visible-trigger');
  });

  it('does not flag a transition once a control fires its event', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).not.toContain('ux.user-transition-without-visible-trigger');
  });

  it('flags an interactive control without a declared intent (ux.visible-control-without-intent)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.visible-control-without-intent');
  });

  it('flags a mismatch between a transition intent and its trigger control intent', () => {
    const project = loadDemoProject();
    clearControlPanel(project);
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'] });
    setUxContract(project, {
      controls: { 'btn-start': { intent: 'begin-measurement' } },
      transitions: { 'tr-main-measure': { intent: 'start-workflow' } }
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.transition-intent-mismatch-with-control');
  });

  it('flags a control bound to an event with no matching transition (ux.control-event-missing-transition)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-orphan', 'NOPE');
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.control-event-missing-transition');
  });

  it('flags a transition originating from an unreachable state (ux.transition-to-unreachable-state)', () => {
    const project = loadDemoProject();
    project.fsm.events['BACK'] = { id: 'BACK', name: 'Back' };
    project.fsm.eventOrder.push('BACK');
    project.fsm.transitions['tr-glyph-loop'] = {
      id: 'tr-glyph-loop', from: 'glyph-test', to: 'main-menu',
      trigger: { eventId: 'BACK', mechanism: 'event', buttonId: null, timerMs: null, fact: null },
      kind: 'navigation', condition: null, source: null, backendProcessId: null
    };
    project.fsm.transitionOrder.push('tr-glyph-loop');
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).toContain('ux.transition-to-unreachable-state');
  });

  it('exempts an overlay state\'s transitions from ux.transition-to-unreachable-state', () => {
    const project = loadDemoProject();
    project.fsm.events['BACK'] = { id: 'BACK', name: 'Back' };
    project.fsm.eventOrder.push('BACK');
    project.fsm.transitions['tr-glyph-loop'] = {
      id: 'tr-glyph-loop', from: 'glyph-test', to: 'main-menu',
      trigger: { eventId: 'BACK', mechanism: 'event', buttonId: null, timerMs: null, fact: null },
      kind: 'navigation', condition: null, source: null, backendProcessId: null
    };
    project.fsm.transitionOrder.push('tr-glyph-loop');
    setUxContract(project, { states: { 'glyph-test': { isOverlay: true } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateStructureRules(graph))).not.toContain('ux.transition-to-unreachable-state');
  });
});

describe('UX navigation and recovery rules', () => {
  it('flags a non-terminal state with no outgoing transition (ux.nonterminal-state-without-exit)', () => {
    const project = loadDemoProject();
    project.fsm.states['save-result'].terminal = false;
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.nonterminal-state-without-exit');
  });

  it('does not flag a terminal state with no outgoing transition', () => {
    const project = loadDemoProject();
    const graph = buildProjectUxGraph(project);
    const finding = evaluateNavigationRules(graph).find((f) => f.ruleId === 'ux.nonterminal-state-without-exit');
    // glyph-test (an orphan, non-terminal state) legitimately triggers this rule; the
    // terminal 'save-result' state must never be among the affected states.
    expect(finding?.affected.stateIds).not.toContain('save-result');
  });

  it('flags an error state with no path back to an initial state (ux.error-state-without-recovery)', () => {
    const project = loadDemoProject();
    delete project.fsm.transitions['tr-error-main'];
    project.fsm.transitionOrder = project.fsm.transitionOrder.filter((id) => id !== 'tr-error-main');
    setUxContract(project, { states: { error: { role: 'error' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.error-state-without-recovery');
  });

  it('does not flag an error state that can already reach an initial state', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { error: { role: 'error' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.error-state-without-recovery');
  });

  it('flags a warning state with no outgoing transition (ux.warning-state-without-safe-action)', () => {
    const project = loadDemoProject();
    delete project.fsm.transitions['tr-error-main'];
    project.fsm.transitionOrder = project.fsm.transitionOrder.filter((id) => id !== 'tr-error-main');
    setUxContract(project, { states: { error: { role: 'warning' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.warning-state-without-safe-action');
  });

  it('flags a non-terminal result state with no next action (ux.result-state-without-next-action)', () => {
    const project = loadDemoProject();
    project.fsm.states['save-result'].terminal = false;
    setUxContract(project, { states: { 'save-result': { role: 'result' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.result-state-without-next-action');
  });

  it('flags a progress state with no cancel control and no status info (ux.progress-state-without-cancel-or-status)', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { measure: { role: 'progress' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.progress-state-without-cancel-or-status');
  });

  it('does not flag a progress state that declares a purpose', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { measure: { role: 'progress', purpose: 'Runs the measurement.' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.progress-state-without-cancel-or-status');
  });

  it('flags a "back" control whose target has no path to its origin (ux.back-intent-does-not-return-to-logical-context)', () => {
    const project = loadDemoProject();
    project.fsm.events['BACK'] = { id: 'BACK', name: 'Back' };
    project.fsm.eventOrder.push('BACK');
    project.fsm.transitions['tr-save-glyph'] = {
      id: 'tr-save-glyph', from: 'save-result', to: 'glyph-test',
      trigger: { eventId: 'BACK', mechanism: 'event', buttonId: null, timerMs: null, fact: null },
      kind: 'navigation', condition: null, source: null, backendProcessId: null
    };
    project.fsm.transitionOrder.push('tr-save-glyph');
    addButton(project, 'btn-back', 'BACK', { allowedStates: ['save-result'] });
    setUxContract(project, { controls: { 'btn-back': { actionKind: 'back' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.back-intent-does-not-return-to-logical-context');
  });

  it('flags a navigation cycle with no documented rationale (ux.unintended-navigation-loop)', () => {
    const project = loadDemoProject();
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.unintended-navigation-loop');
  });

  it('does not flag a cycle once an edge documents its rationale', () => {
    const project = loadDemoProject();
    setUxContract(project, { transitions: { 'tr-error-main': { rationale: 'Operator dismisses the error and returns to the menu.' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.unintended-navigation-loop');
  });

  it('flags an unreachable state (ux.orphan-state)', () => {
    const project = loadDemoProject();
    const graph = buildProjectUxGraph(project);
    const finding = evaluateNavigationRules(graph).find((f) => f.ruleId === 'ux.orphan-state');
    expect(finding?.affected.stateIds).toContain('glyph-test');
  });

  it('exempts a state marked isOverlay from ux.orphan-state', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { 'glyph-test': { isOverlay: true } } });
    const graph = buildProjectUxGraph(project);
    const finding = evaluateNavigationRules(graph).find((f) => f.ruleId === 'ux.orphan-state' && f.affected.stateIds?.includes('glyph-test'));
    expect(finding).toBeUndefined();
  });

  it('exempts an overlay error state from ux.error-state-without-recovery', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { 'glyph-test': { role: 'error', isOverlay: true } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.error-state-without-recovery');
  });

  it('stops reporting a cycle once it exceeds the configured loop-size threshold', () => {
    const project = loadDemoProject();
    setUxContract(project, { policies: { unintendedNavigationLoopMaxSize: 2 } });
    const graph = buildProjectUxGraph(project);
    // The demo project's default main-menu/measure/error cycle has 3 states, above the threshold.
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.unintended-navigation-loop');
  });

  it('flags a goal whose start state cannot reach its success state (ux.goal-has-no-success-path)', () => {
    const project = loadDemoProject();
    setUxContract(project, { userGoals: [{ id: 'goal-measure', title: 'Measure', startStateIds: ['glyph-test'], successStateIds: ['save-result'] }] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).toContain('ux.goal-has-no-success-path');
  });

  it('does not flag a goal with a real path to success', () => {
    const project = loadDemoProject();
    setUxContract(project, { userGoals: [{ id: 'goal-measure', title: 'Measure', startStateIds: ['main-menu'], successStateIds: ['save-result'] }] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateNavigationRules(graph))).not.toContain('ux.goal-has-no-success-path');
  });
});

describe('UX semantics and terminology rules', () => {
  it('flags a screen with no declared role (ux.screen-missing-role)', () => {
    const project = loadDemoProject();
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.screen-missing-role');
  });

  it('flags a state with no declared purpose (ux.state-missing-purpose)', () => {
    const project = loadDemoProject();
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.state-missing-purpose');
  });

  it('flags a visibly-triggered transition with no declared intent (ux.transition-missing-intent)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.transition-missing-intent');
  });

  it('flags a control label that deviates from the preferred terminology label (ux.intent-label-inconsistent)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'], label: 'Go' });
    setUxContract(project, {
      controls: { 'btn-start': { intent: 'start-measurement' } },
      terminology: [{ intent: 'start-measurement', preferredLabels: { ru: 'Старт' } }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.intent-label-inconsistent');
  });

  it('flags a control label explicitly forbidden for its intent (ux.intent-uses-forbidden-label)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'], label: 'OK' });
    setUxContract(project, {
      controls: { 'btn-start': { intent: 'start-measurement' } },
      terminology: [{ intent: 'start-measurement', preferredLabels: { ru: 'Старт' }, forbiddenLabels: { ru: ['OK'] } }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.intent-uses-forbidden-label');
  });

  it('flags the same label used for two different intents (ux.same-label-different-intent)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-a', 'START', { allowedStates: ['main-menu'], label: 'OK' });
    addButton(project, 'btn-b', 'SAVE', { allowedStates: ['measure'], label: 'OK' });
    setUxContract(project, { controls: { 'btn-a': { intent: 'start' }, 'btn-b': { intent: 'save' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.same-label-different-intent');
  });

  it('flags a prohibited intent that is actually available on a screen (ux.prohibited-action-present-on-screen)', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-start', 'START', { allowedStates: ['main-menu'] });
    const mainScreenId = project.fsm.states['main-menu'].screenId!;
    setUxContract(project, {
      controls: { 'btn-start': { intent: 'start-measurement' } },
      screens: { [mainScreenId]: { prohibitedActionIntents: ['start-measurement'] } }
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.prohibited-action-present-on-screen');
  });

  it('flags an expected intent missing from a screen (ux.expected-action-missing-on-screen)', () => {
    const project = loadDemoProject();
    const mainScreenId = project.fsm.states['main-menu'].screenId!;
    setUxContract(project, { screens: { [mainScreenId]: { expectedActionIntents: ['start-measurement'] } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.expected-action-missing-on-screen');
  });

  it('flags a primary action intent that is not available on its screen (ux.primary-action-not-available)', () => {
    const project = loadDemoProject();
    const mainScreenId = project.fsm.states['main-menu'].screenId!;
    setUxContract(project, { screens: { [mainScreenId]: { primaryActionIntent: 'start-measurement' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).toContain('ux.primary-action-not-available');
  });

  it('does not flag a primary action intent that is available via a transition', () => {
    const project = loadDemoProject();
    const mainScreenId = project.fsm.states['main-menu'].screenId!;
    setUxContract(project, {
      transitions: { 'tr-main-measure': { intent: 'start-measurement' } },
      screens: { [mainScreenId]: { primaryActionIntent: 'start-measurement' } }
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSemanticsRules(graph))).not.toContain('ux.primary-action-not-available');
  });
});

describe('UX safety rules', () => {
  it('flags a destructive transition with no confirmation (ux.destructive-action-without-confirmation)', () => {
    const project = loadDemoProject();
    setUxContract(project, { transitions: { 'tr-measure-error': { riskLevel: 'destructive' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.destructive-action-without-confirmation');
  });

  it('does not flag a destructive transition once confirmation is required', () => {
    const project = loadDemoProject();
    setUxContract(project, { transitions: { 'tr-measure-error': { riskLevel: 'destructive', requiresConfirmation: true } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).not.toContain('ux.destructive-action-without-confirmation');
  });

  it('flags a destructive control with no confirmation requirement', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-delete', 'SAVE', { allowedStates: ['measure'] });
    setUxContract(project, { controls: { 'btn-delete': { riskLevel: 'critical' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.destructive-action-without-confirmation');
  });

  it('flags a critical transition with no documented rationale (ux.critical-transition-without-rationale)', () => {
    const project = loadDemoProject();
    setUxContract(project, { transitions: { 'tr-measure-error': { riskLevel: 'critical', requiresConfirmation: true } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.critical-transition-without-rationale');
  });

  it('flags an error state with no visible text and no declared purpose (ux.error-state-missing-user-guidance)', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { error: { role: 'error' } } });
    const screenId = project.fsm.states['error'].screenId!;
    project.screens[screenId].objects = project.screens[screenId].objects.filter((o) => o.type !== 'text');
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.error-state-missing-user-guidance');
  });

  it('flags a declared recovery state that is not actually reachable (ux.recovery-action-not-reachable)', () => {
    const project = loadDemoProject();
    setUxContract(project, { states: { error: { recoveryStateId: 'glyph-test' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.recovery-action-not-reachable');
  });

  it('flags a cancel transition that leads into an error state (ux.cancel-flow-loses-user-context)', () => {
    const project = loadDemoProject();
    clearControlPanel(project);
    addButton(project, 'btn-cancel', 'ERR', { allowedStates: ['measure'] });
    setUxContract(project, { controls: { 'btn-cancel': { actionKind: 'cancel' } }, states: { error: { role: 'error' } } });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.cancel-flow-loses-user-context');
  });

  it('flags a critical goal with a required intent missing from its path (ux.operation-start-without-required-precondition)', () => {
    const project = loadDemoProject();
    setUxContract(project, {
      userGoals: [{
        id: 'goal-measure', title: 'Measure', startStateIds: ['main-menu'], successStateIds: ['save-result'],
        requiredIntents: ['confirm-safety-interlock'], criticality: 'critical'
      }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.operation-start-without-required-precondition');
  });

  it('does not flag when the required intent is present on the path', () => {
    const project = loadDemoProject();
    addButton(project, 'btn-interlock', 'START', { allowedStates: ['main-menu'] });
    setUxContract(project, {
      controls: { 'btn-interlock': { intent: 'confirm-safety-interlock' } },
      userGoals: [{
        id: 'goal-measure', title: 'Measure', startStateIds: ['main-menu'], successStateIds: ['save-result'],
        requiredIntents: ['confirm-safety-interlock'], criticality: 'critical'
      }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).not.toContain('ux.operation-start-without-required-precondition');
  });

  it('flags a critical goal with no declared failure state (ux.failure-path-not-modeled)', () => {
    const project = loadDemoProject();
    setUxContract(project, {
      userGoals: [{ id: 'goal-measure', title: 'Measure', criticality: 'critical', startStateIds: ['main-menu'], successStateIds: ['save-result'] }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateSafetyRules(graph))).toContain('ux.failure-path-not-modeled');
  });
});

describe('UX scenario and traceability rules', () => {
  it('flags a critical goal with no scripted scenario (ux.critical-goal-without-scenario)', () => {
    const project = loadDemoProject();
    setUxContract(project, { userGoals: [{ id: 'goal-measure', title: 'Measure', criticality: 'critical' }] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateScenarioRules(graph, []))).toContain('ux.critical-goal-without-scenario');
  });

  it('does not flag once a scenario references the critical goal', () => {
    const project = loadDemoProject();
    setUxContract(project, {
      userGoals: [{ id: 'goal-measure', title: 'Measure', criticality: 'critical' }],
      scenarios: [{ id: 'sc-measure', title: 'Measure happy path', goalId: 'goal-measure', steps: [{ type: 'event', eventId: 'START' }] }]
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateScenarioRules(graph, []))).not.toContain('ux.critical-goal-without-scenario');
  });

  it('turns a blocked scenario step into a finding (ux.scenario-blocked-step)', async () => {
    const project = loadDemoProject();
    setUxContract(project, {
      scenarios: [{ id: 'sc-bad', title: 'Bad event', initialStateId: 'main-menu', steps: [{ type: 'event', eventId: 'NOPE' }] }]
    });
    const graph = buildProjectUxGraph(project);
    const result = await runUxScenario(project, graph.scenarios[0]);
    expect(ruleIds(evaluateScenarioRules(graph, [result]))).toContain('ux.scenario-blocked-step');
  });

  it('flags an unexpected final state (ux.scenario-unexpected-final-state)', async () => {
    const project = loadDemoProject();
    setUxContract(project, {
      scenarios: [{
        id: 'sc-final', title: 'Wrong final', initialStateId: 'main-menu',
        steps: [{ type: 'event', eventId: 'START' }], expectedFinalStateId: 'save-result'
      }]
    });
    const graph = buildProjectUxGraph(project);
    const result = await runUxScenario(project, graph.scenarios[0]);
    expect(ruleIds(evaluateScenarioRules(graph, [result]))).toContain('ux.scenario-unexpected-final-state');
  });

  it('flags a per-step state mismatch (ux.scenario-transition-mismatch)', async () => {
    const project = loadDemoProject();
    setUxContract(project, {
      scenarios: [{
        id: 'sc-step', title: 'Step mismatch', initialStateId: 'main-menu',
        steps: [{ type: 'event', eventId: 'START', expectedStateId: 'save-result' }]
      }]
    });
    const graph = buildProjectUxGraph(project);
    const result = await runUxScenario(project, graph.scenarios[0]);
    expect(ruleIds(evaluateScenarioRules(graph, [result]))).toContain('ux.scenario-transition-mismatch');
  });

  it('flags a goal referenced by nothing (ux.requirement-goal-not-covered-by-state-or-scenario)', () => {
    const project = loadDemoProject();
    setUxContract(project, { userGoals: [{ id: 'goal-orphan', title: 'Orphan goal' }] });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateScenarioRules(graph, []))).toContain('ux.requirement-goal-not-covered-by-state-or-scenario');
  });

  it('does not flag a goal referenced by a state', () => {
    const project = loadDemoProject();
    setUxContract(project, {
      userGoals: [{ id: 'goal-covered', title: 'Covered goal' }],
      states: { 'main-menu': { userGoalIds: ['goal-covered'] } }
    });
    const graph = buildProjectUxGraph(project);
    expect(ruleIds(evaluateScenarioRules(graph, []))).not.toContain('ux.requirement-goal-not-covered-by-state-or-scenario');
  });
});

describe('analyzeProjectUx', () => {
  it('produces a deterministic finding order across repeated runs', async () => {
    const project = loadDemoProject();
    const [first, second] = await Promise.all([analyzeProjectUx(project), analyzeProjectUx(project)]);
    expect(first.findings.map((f) => f.id)).toEqual(second.findings.map((f) => f.id));
  });

  it('fails when a deterministic error finding is present', async () => {
    const project = loadDemoProject();
    project.fsm.states['main-menu'].screenId = 'does-not-exist';
    const report = await analyzeProjectUx(project);
    expect(report.verdict).toBe('fail');
    expect(report.summary.errors).toBeGreaterThan(0);
  });

  it('never lets a heuristic finding push the verdict to fail', async () => {
    const project = withoutOrphanState(loadDemoProject());
    const heuristicFindings: UxValidationFinding[] = [{
      id: 'heuristic:test:0',
      ruleId: 'ux.heuristic-review',
      category: 'semantics',
      severity: 'needs_human_review',
      message: 'A heuristic observation.',
      affected: {},
      source: 'heuristic_llm'
    }];
    const report = await analyzeProjectUx(project, { heuristicFindings });
    expect(report.verdict).not.toBe('fail');
    expect(report.verdict).toBe('needs_review');
  });

  it('excludes overlay error states from the errorStatesWithRecovery coverage denominator', async () => {
    const project = withoutOrphanState(loadDemoProject());
    delete project.fsm.transitions['tr-error-main'];
    project.fsm.transitionOrder = project.fsm.transitionOrder.filter((id) => id !== 'tr-error-main');
    setUxContract(project, { states: { error: { role: 'error', isOverlay: true } } });
    const report = await analyzeProjectUx(project);
    expect(report.coverage.errorStatesWithRecovery.total).toBe(0);
  });
});

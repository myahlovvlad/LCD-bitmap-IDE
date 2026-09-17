import { describe, expect, it } from 'vitest';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import type { LcdBitmapProject } from '../../src/domain/project';
import type { UxScenarioDefinition } from '../../src/domain/uxContract';
import { runUxScenario } from '../../src/services/ux/uxScenarioRunner';

function loadDemoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

describe('runUxScenario', () => {
  it('passes a scenario whose expectations match the real trace', async () => {
    const project = loadDemoProject();
    const scenario: UxScenarioDefinition = {
      id: 'sc-happy', title: 'Happy path', initialStateId: 'main-menu',
      steps: [{ type: 'event', eventId: 'START', expectedStateId: 'measure' }],
      expectedFinalStateId: 'measure',
      expectNoBlockedSteps: true
    };
    const result = await runUxScenario(project, scenario);
    expect(result.passed).toBe(true);
    expect(result.blockedSteps).toEqual([]);
    expect(result.stepMismatches).toEqual([]);
    expect(result.finalStateMismatch).toBeUndefined();
  });

  it('fails when a step is blocked', async () => {
    const project = loadDemoProject();
    const scenario: UxScenarioDefinition = {
      id: 'sc-blocked', title: 'Blocked', initialStateId: 'main-menu',
      steps: [{ type: 'event', eventId: 'DOES_NOT_EXIST' }]
    };
    const result = await runUxScenario(project, scenario);
    expect(result.passed).toBe(false);
    expect(result.blockedSteps).toHaveLength(1);
  });

  it('reports a final-state mismatch without failing on blocked steps', async () => {
    const project = loadDemoProject();
    const scenario: UxScenarioDefinition = {
      id: 'sc-final', title: 'Wrong final', initialStateId: 'main-menu',
      steps: [{ type: 'event', eventId: 'START' }],
      expectedFinalStateId: 'save-result'
    };
    const result = await runUxScenario(project, scenario);
    expect(result.passed).toBe(false);
    expect(result.finalStateMismatch).toEqual({ expected: 'save-result', actual: 'measure' });
  });

  it('reports a missing required visible message', async () => {
    const project = loadDemoProject();
    const scenario: UxScenarioDefinition = {
      id: 'sc-message', title: 'Missing message', initialStateId: 'main-menu',
      steps: [{ type: 'event', eventId: 'START' }],
      requiredVisibleMessages: ['this exact text never appears in the event log']
    };
    const result = await runUxScenario(project, scenario);
    expect(result.passed).toBe(false);
    expect(result.missingRequiredMessages).toHaveLength(1);
  });

  it('never mutates the project it was given', async () => {
    const project = loadDemoProject();
    const before = JSON.stringify(project);
    const scenario: UxScenarioDefinition = {
      id: 'sc-noop', title: 'No mutation', initialStateId: 'main-menu',
      steps: [{ type: 'event', eventId: 'START' }, { type: 'tag', tagId: 'io.usb_present', value: true }]
    };
    await runUxScenario(project, scenario);
    expect(JSON.stringify(project)).toBe(before);
  });
});

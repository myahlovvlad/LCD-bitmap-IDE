import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import {
  hasBlockingValidationIssues,
  validateProject
} from '../../src/services/projectValidationService';

describe('project validation service', () => {
  it('validates screen and event references', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.states.measure.screenId = 'missing-screen';
    project.fsm.transitions['tr-main-measure'].trigger.eventId = 'MISSING_EVENT';

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('state-screen-invalid'))).toBe(true);
    expect(issues.some((issue) => issue.id.includes('transition-event-invalid'))).toBe(true);
    expect(hasBlockingValidationIssues(issues)).toBe(true);
  });

  it('reports unreachable and non-terminal dead-end states', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.states['glyph-test'].terminal = false;

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('state-unreachable:glyph-test'))).toBe(true);
    expect(issues.some((issue) => issue.id.includes('state-no-outgoing:glyph-test'))).toBe(true);
  });

  it('detects conflicting button state restrictions', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = Object.values(project.controlPanel.elements)
      .find((element) => element.type === 'button');
    expect(button?.type).toBe('button');
    if (button?.type === 'button') {
      button.allowedStates = ['main-menu'];
      button.disabledStates = ['main-menu'];
    }

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('button-state-conflict'))).toBe(true);
  });
});

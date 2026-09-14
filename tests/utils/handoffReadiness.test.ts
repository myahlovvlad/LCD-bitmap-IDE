import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { assessHandoffReadiness } from '../../src/features/hmi-handoff/handoffReadiness';

describe('HMI handoff readiness', () => {
  it('reports structural delivery blockers with stable counts', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('START button missing');
    button.fsmEventId = undefined;
    project.fsm.states['main-menu'].screenId = null;

    const readiness = assessHandoffReadiness(project);

    expect(readiness.unboundButtons).toBeGreaterThan(0);
    expect(readiness.statesWithoutScreens).toBeGreaterThan(0);
    expect(readiness.ready).toBe(false);
  });

  it('separates warnings from blockers', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.validation.issues = [{
      id: 'warning',
      severity: 'warning',
      domain: 'export',
      message: 'Review supplier mapping',
      entityType: 'project'
    }];

    const readiness = assessHandoffReadiness(project);

    expect(readiness.validationWarnings).toBe(1);
    expect(readiness.validationErrors).toBe(0);
  });
});

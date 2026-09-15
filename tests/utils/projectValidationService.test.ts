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

  it('rejects a state-local event used by a transition from another state', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.events.START = {
      ...project.fsm.events.START,
      scope: 'state',
      sourceStateId: 'measure'
    };

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('transition-event-scope-invalid'))).toBe(true);
    expect(hasBlockingValidationIssues(issues)).toBe(true);
  });

  it('treats an FSM state without an LCD screen as editable warning debt', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.states['main-menu'].screenId = null;

    const issues = validateProject(project);
    const issue = issues.find((candidate) => candidate.id.includes('state-screen-missing'));
    expect(issue?.severity).toBe('warning');
    expect(hasBlockingValidationIssues(issues)).toBe(false);
  });

  it('flags a hardware notification tag that has no matching HMI tag definition', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.hardwareNotifications = {
      usb: { tagId: 'io.usb_present', presentScreenId: 'measure', absentScreenId: null }
    };

    const issues = validateProject(project);
    const issue = issues.find((candidate) => candidate.id.includes('hardware-notification-tag-missing'));
    expect(issue?.severity).toBe('warning');
  });

  it('flags a hardware notification screen mapping that references a missing screen', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.hardwareNotifications = {
      printer: { tagId: 'io.printer_present', presentScreenId: 'does-not-exist', absentScreenId: null }
    };

    const issues = validateProject(project);
    const issue = issues.find((candidate) => candidate.id.includes('hardware-notification-screen-invalid'));
    expect(issue?.severity).toBe('error');
    expect(hasBlockingValidationIssues(issues)).toBe(true);
  });

  it('does not report a screen as unbound when it is only reachable via a hardware notification', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const orphanScreenId = 'hw-usb-connected';
    project.screens[orphanScreenId] = { ...project.screens.measure, id: orphanScreenId };

    const withoutMapping = validateProject(project);
    expect(withoutMapping.some((issue) => issue.id.includes(`screen-unbound:${orphanScreenId}`))).toBe(true);

    project.hardwareNotifications = {
      pc: { tagId: 'io.pc_present', presentScreenId: orphanScreenId, absentScreenId: null }
    };
    const withMapping = validateProject(project);
    expect(withMapping.some((issue) => issue.id.includes(`screen-unbound:${orphanScreenId}`))).toBe(false);
  });
});

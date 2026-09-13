import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { resolveHmiTrace } from '../../src/features/hmi-designer/hmiTrace';

describe('HMI trace resolver', () => {
  it('resolves state, screen, button, tag, procedure and alarm as one chain', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('Demo START button is missing');
    button.bindings = {
      writeTag: { tagId: 'measurement.requested', value: { kind: 'literal', value: true } },
      procedureId: 'measure.sample'
    };
    project.tags = {
      'measurement.requested': { id: 'measurement.requested', name: { en: 'Requested', ru: 'Запрошено', zh: '已请求' }, dataType: 'bool' },
      'measurement.value': { id: 'measurement.value', name: { en: 'Value', ru: 'Значение', zh: '数值' }, dataType: 'float' }
    };
    project.procedures = {
      'measure.sample': {
        id: 'measure.sample',
        name: { en: 'Measure', ru: 'Измерить', zh: '测量' },
        services: ['ecros.cli'],
        steps: [{ type: 'setTag', tagId: 'measurement.value', value: { kind: 'literal', value: 1.23 } }]
      }
    };
    project.alarms = {
      'measurement.failed': {
        id: 'measurement.failed',
        name: { en: 'Failed', ru: 'Ошибка', zh: '失败' },
        severity: 'critical',
        condition: { kind: 'tag', tagId: 'measurement.value' },
        message: { en: 'Failed', ru: 'Ошибка', zh: '失败' }
      }
    };

    const trace = resolveHmiTrace(project, 'main-menu', 'button-START');

    expect(trace.stateId).toBe('main-menu');
    expect(trace.screenId).toBe('main-menu');
    expect(trace.buttonId).toBe('button-START');
    expect(trace.eventId).toBe('START');
    expect(trace.transitionIds).toEqual(['tr-main-measure']);
    expect(trace.tagIds).toEqual(['measurement.requested', 'measurement.value']);
    expect(trace.procedureIds).toEqual(['measure.sample']);
    expect(trace.alarmIds).toEqual(['measurement.failed']);
    expect(trace.gaps).toEqual([]);
  });

  it('reports actionable gaps instead of inventing missing links', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const button = project.controlPanel.elements['button-START'];
    if (!button || button.type !== 'button') throw new Error('Demo START button is missing');
    button.fsmEventId = undefined;

    const trace = resolveHmiTrace(project, 'main-menu', button.id);

    expect(trace.gaps).toContain('missing-event');
    expect(trace.gaps).toContain('missing-transition');
    expect(trace.transitionIds).toEqual([]);
  });
});

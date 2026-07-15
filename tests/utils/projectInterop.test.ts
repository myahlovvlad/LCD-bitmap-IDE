import { describe, expect, it } from 'vitest';
import { createUniversalProjectPayload, readProjectPayload } from '../../src/renderer/core/projectInterop';
import type { Project } from '../../src/renderer/types/domain';

describe('project interop', () => {
  it('imports legacy LCD editor snapshots with an inverted row', () => {
    const snapshot = readProjectPayload({
      objects: [
        { id: 'text-1', type: 'text', text: 'MENU', x: 2, y: 8, variant: '1' },
        { id: 'line-1', type: 'line', x0: 0, y0: 0, x1: 10, y1: 0 }
      ],
      invertedRow: { enabled: true, y: 8, h: 8 },
      smStates: [{ id: 'boot', label: 'Boot', initial: true }],
      smTransitions: []
    });

    expect(snapshot?.stateOrder).toEqual(['boot']);
    const objects = snapshot?.project.canvasByStateId.boot.objects;
    expect(objects?.some((object) => object.type === 'invert' && object.y === 8)).toBe(true);
  });

  it('exports a generic lcd-project payload', () => {
    const now = '2026-05-22T00:00:00.000Z';
    const project: Project = {
      id: 'sample',
      name: 'Sample',
      version: '1.0.0',
      modelId: 'Universal-LCD-128x64',
      firmwareVersion: null,
      author: null,
      lastModified: now,
      display: { width: 128, height: 64, colorMode: 'monochrome', packing: 'vertical-lsb' },
      states: {
        boot: {
          id: 'boot',
          runtimeId: null,
          legacyIds: [],
          title: 'Boot',
          subsystem: 'system',
          stateType: 'screen',
          origin: 'test',
          sourceLcd: [],
          initial: true,
          final: false
        }
      },
      transitions: {},
      canvasByStateId: {
        boot: {
          stateId: 'boot',
          width: 128,
          height: 64,
          objects: [],
          selectedObjectIds: [],
          updatedAt: now
        }
      },
      graphLayout: { boot: { x: 0, y: 0 } },
      auditTrail: []
    };

    const payload = createUniversalProjectPayload({
      project,
      stateOrder: ['boot'],
      transitionOrder: [],
      language: 'en'
    });

    expect(payload.format).toBe('lcd-project');
    expect(payload.screens[0].id).toBe('boot');
  });
});

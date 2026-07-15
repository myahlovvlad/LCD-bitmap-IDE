import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { createCompilerSourceSnapshot, normalizeProject } from '../../src/compiler';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { CanvasObject, FsmEvent, FsmState, FsmTransition, LcdBitmapProject, LcdScreen } from '../../src/domain';

describe('compiler normalization performance characterization', () => {
  it('normalizes a large synthetic project and records sizing observations', () => {
    const project = createLargeProject();
    const start = performance.now();
    const result = normalizeProject(createCompilerSourceSnapshot({ project }));
    const durationMs = performance.now() - start;

    expect(result.completeness).toEqual(expect.objectContaining({
      stateCount: 100,
      eventCount: 10,
      transitionCount: 500,
      screenCount: 100,
      canvasObjectCount: 3000
    }));
    expect(result.fingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(result.canonicalJson.length).toBeGreaterThan(100_000);
    expect(Number.isFinite(durationMs)).toBe(true);
    console.info(JSON.stringify({
      compilerNormalization: {
        durationMs: Number(durationMs.toFixed(2)),
        canonicalBytes: result.canonicalJson.length,
        ...result.completeness
      }
    }));
  });
});

function createLargeProject(): LcdBitmapProject {
  const project = migrateLegacySnapshot(createBlankProject({ name: 'Compiler Performance Fixture' })).project;
  const screens: Record<string, LcdScreen> = {};
  const states: Record<string, FsmState> = {};
  const graphLayout: LcdBitmapProject['fsm']['graphLayout'] = {};
  const screenOrder: string[] = [];
  const stateOrder: string[] = [];
  const events: Record<string, FsmEvent> = {};
  const eventOrder: string[] = [];
  const transitions: Record<string, FsmTransition> = {};
  const transitionOrder: string[] = [];

  for (let eventIndex = 0; eventIndex < 10; eventIndex += 1) {
    const id = `EVENT_${eventIndex}`;
    events[id] = { id, name: id };
    eventOrder.push(id);
  }

  for (let index = 0; index < 100; index += 1) {
    const id = `state-${index.toString().padStart(3, '0')}`;
    screens[id] = {
      id,
      name: `Screen ${index}`,
      description: '',
      tags: [],
      width: 128,
      height: 64,
      objects: createObjects(id, index),
      selectedObjectIds: [],
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z'
    };
    states[id] = {
      id,
      runtimeId: null,
      legacyIds: [],
      title: `State ${index}`,
      subsystem: 'synthetic',
      stateType: index === 0 ? 'initial' : 'process',
      origin: 'test',
      screenId: id,
      initial: index === 0,
      terminal: false
    };
    graphLayout[id] = { x: (index % 10) * 160, y: Math.floor(index / 10) * 100 };
    screenOrder.push(id);
    stateOrder.push(id);
  }

  for (let index = 0; index < 500; index += 1) {
    const id = `transition-${index.toString().padStart(3, '0')}`;
    transitions[id] = {
      id,
      from: stateOrder[index % stateOrder.length],
      to: stateOrder[(index + 1) % stateOrder.length],
      trigger: { eventId: eventOrder[index % eventOrder.length], mechanism: 'event' },
      kind: 'navigation',
      condition: null,
      source: 'synthetic',
      backendProcessId: null
    };
    transitionOrder.push(id);
  }

  return {
    ...project,
    screens,
    screenOrder,
    fsm: {
      ...project.fsm,
      states,
      stateOrder,
      events,
      eventOrder,
      transitions,
      transitionOrder,
      graphLayout
    }
  };
}

function createObjects(screenId: string, screenIndex: number): CanvasObject[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `${screenId}-rect-${index}`,
    type: 'rect',
    x: (index * 3 + screenIndex) % 120,
    y: (index * 2) % 56,
    width: 6 + (index % 8),
    height: 4 + (index % 6),
    filled: index % 2 === 0,
    zIndex: index,
    visible: true,
    locked: false,
    source: 'generated'
  }));
}

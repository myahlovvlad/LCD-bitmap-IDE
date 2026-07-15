import { describe, expect, it } from 'vitest';
import { buildCompactGraphLayout } from '../../src/renderer/core/compactGraphLayout';
import type { FsmState } from '../../src/renderer/types/domain';

function state(id: string, subsystem?: string): FsmState {
  return {
    id,
    runtimeId: null,
    legacyIds: [],
    title: id,
    subsystem: subsystem ?? 'unknown',
    stateType: 'screen',
    origin: 'test',
    sourceLcd: [],
    initial: false,
    final: false
  };
}

describe('compact graph layout', () => {
  it('orders known subsystems first and unknown subsystems alphabetically', () => {
    const states = {
      z: state('z', 'z-custom'),
      p1: state('p1', 'photometry'),
      p2: state('p2', 'photometry'),
      s: state('s', 'system'),
      a: state('a', 'a-custom')
    };
    const layout = buildCompactGraphLayout(['z', 'p1', 'p2', 's', 'a'], states);
    expect(layout.s).toEqual({ x: 0, y: 0 });
    expect(layout.p1).toEqual({ x: 210, y: 0 });
    expect(layout.p2).toEqual({ x: 210, y: 82 });
    expect(layout.a.x).toBeLessThan(layout.z.x);
  });

  it('handles missing state metadata in an unknown bucket', () => {
    expect(buildCompactGraphLayout(['missing'], {})).toEqual({ missing: { x: 0, y: 0 } });
  });
});

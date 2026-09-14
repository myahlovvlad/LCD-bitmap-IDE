import { describe, expect, it } from 'vitest';
import {
  resolveAnimationFrame,
  validateAnimationResource,
  type AnimationFrame,
  type AnimationResource
} from '../../src/domain/animation';

function frame(id: string, durationMs: number): AnimationFrame {
  return { id, bytes: [0], durationMs };
}

function fixtureAnimation(overrides: Partial<AnimationResource> = {}): AnimationResource {
  return {
    id: 'spinner',
    name: 'Spinner',
    width: 8,
    height: 8,
    loop: false,
    frames: [frame('first', 40)],
    ...overrides
  };
}

describe('animation model', () => {
  it('cycles a looping resource by cumulative frame durations', () => {
    const resource = fixtureAnimation({ loop: true, frames: [frame('a', 40), frame('b', 60)] });

    expect(resolveAnimationFrame(resource, 105)?.id).toBe('a');
  });

  it('holds the final frame for a non-looping resource', () => {
    const resource = fixtureAnimation({ frames: [frame('a', 40), frame('b', 60)] });

    expect(resolveAnimationFrame(resource, 500)?.id).toBe('b');
  });

  it('reports frame durations outside the supported range', () => {
    const resource = fixtureAnimation({ frames: [frame('too-fast', 0), frame('too-slow', 60_001)] });

    expect(validateAnimationResource(resource)).toContain('Frame "too-fast" duration must be between 1 and 60000 ms.');
    expect(validateAnimationResource(resource)).toContain('Frame "too-slow" duration must be between 1 and 60000 ms.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  INITIAL_RUNTIME_ANIMATION_CLOCK,
  advanceRuntimeAnimationClock,
  runtimeAnimationElapsedMs,
  screenHasAnimatedBitmap
} from '../../src/features/runtime-workspace/runtimeAnimationClock';
import type { AnimationCatalog } from '../../src/domain/animation';
import type { CanvasObject } from '../../src/renderer/types/domain';

function bitmap(overrides: Partial<CanvasObject & { type: 'bitmap' }> = {}): CanvasObject {
  return {
    id: 'bmp-1',
    type: 'bitmap',
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user',
    x: 0,
    y: 0,
    width: 8,
    height: 8,
    bytes: [],
    animationId: null,
    ...overrides
  } as CanvasObject;
}

const catalog: AnimationCatalog = {
  resources: {
    spinner: { id: 'spinner', name: 'Spinner', width: 8, height: 8, loop: true, frames: [{ id: 'f1', bytes: [], durationMs: 100 }] }
  },
  order: ['spinner']
};

describe('runtime animation clock — screen-entry anchoring', () => {
  it('starts unset and anchors to the first screen it sees', () => {
    const clock = advanceRuntimeAnimationClock(INITIAL_RUNTIME_ANIMATION_CLOCK, 'SCREEN_A', 1_000);
    expect(clock).toEqual({ screenId: 'SCREEN_A', startedAtMs: 1_000 });
    expect(runtimeAnimationElapsedMs(clock, 1_000)).toBe(0);
    expect(runtimeAnimationElapsedMs(clock, 1_500)).toBe(500);
  });

  it('keeps the same clock instance while the screen does not change', () => {
    const first = advanceRuntimeAnimationClock(INITIAL_RUNTIME_ANIMATION_CLOCK, 'SCREEN_A', 1_000);
    const second = advanceRuntimeAnimationClock(first, 'SCREEN_A', 4_000);
    expect(second).toBe(first);
    expect(runtimeAnimationElapsedMs(second, 4_000)).toBe(3_000);
  });

  it('resets the clock to zero elapsed on every screen transition', () => {
    let clock = advanceRuntimeAnimationClock(INITIAL_RUNTIME_ANIMATION_CLOCK, 'SCREEN_A', 1_000);
    clock = advanceRuntimeAnimationClock(clock, 'SCREEN_A', 3_500); // same screen, no reset
    expect(runtimeAnimationElapsedMs(clock, 3_500)).toBe(2_500);

    clock = advanceRuntimeAnimationClock(clock, 'SCREEN_B', 3_600); // FSM transition
    expect(clock.screenId).toBe('SCREEN_B');
    expect(runtimeAnimationElapsedMs(clock, 3_600)).toBe(0);
    expect(runtimeAnimationElapsedMs(clock, 3_700)).toBe(100);
  });

  it('treats leaving the active screen (null) as a transition too', () => {
    const onScreen = advanceRuntimeAnimationClock(INITIAL_RUNTIME_ANIMATION_CLOCK, 'SCREEN_A', 1_000);
    const noScreen = advanceRuntimeAnimationClock(onScreen, null, 2_000);
    expect(noScreen.screenId).toBeNull();
    expect(runtimeAnimationElapsedMs(noScreen, 2_500)).toBe(500);
  });

  it('never reports negative elapsed time', () => {
    const clock = advanceRuntimeAnimationClock(INITIAL_RUNTIME_ANIMATION_CLOCK, 'SCREEN_A', 5_000);
    expect(runtimeAnimationElapsedMs(clock, 4_000)).toBe(0);
  });
});

describe('screenHasAnimatedBitmap', () => {
  it('is false for a null screen or missing catalog', () => {
    expect(screenHasAnimatedBitmap(null, catalog)).toBe(false);
    expect(screenHasAnimatedBitmap({ objects: [bitmap({ animationId: 'spinner' })] }, null)).toBe(false);
  });

  it('is false when no object has an animationId', () => {
    expect(screenHasAnimatedBitmap({ objects: [bitmap()] }, catalog)).toBe(false);
  });

  it('is false when the animationId does not resolve in the catalog (deleted/renamed resource)', () => {
    expect(screenHasAnimatedBitmap({ objects: [bitmap({ animationId: 'missing-resource' })] }, catalog)).toBe(false);
  });

  it('is true when a bitmap references a resource that exists in the catalog', () => {
    expect(screenHasAnimatedBitmap({ objects: [bitmap({ animationId: 'spinner' })] }, catalog)).toBe(true);
  });

  it('ignores non-bitmap objects even if they carry an animationId-shaped field', () => {
    const textObject = { id: 't1', type: 'text', zIndex: 0, visible: true, locked: false, source: 'user', x: 0, y: 0, fontVariant: '1', pendingTranslation: false, text: { en: '', ru: '' } } as unknown as CanvasObject;
    expect(screenHasAnimatedBitmap({ objects: [textObject] }, catalog)).toBe(false);
  });

  it('is true if any one of several objects is animated, static siblings included', () => {
    const objects = [bitmap({ id: 'static-1' }), bitmap({ id: 'anim-1', animationId: 'spinner' }), bitmap({ id: 'static-2' })];
    expect(screenHasAnimatedBitmap({ objects }, catalog)).toBe(true);
  });
});

import type { AnimationCatalog } from '../../domain/animation';
import type { LcdScreen } from '../../domain/project';

/**
 * Anchors "elapsed animation time" to the moment the active FSM screen last
 * changed, so a bitmap's animation restarts from frame 0 on every screen
 * entry (matching how a one-shot progress/spinner animation behaves on a
 * real instrument), while looping animations keep advancing normally once
 * resolveAnimationFrame() wraps elapsedMs against the resource's total
 * duration.
 */
export interface RuntimeAnimationClock {
  screenId: string | null;
  startedAtMs: number;
}

export const INITIAL_RUNTIME_ANIMATION_CLOCK: RuntimeAnimationClock = { screenId: null, startedAtMs: 0 };

/**
 * Returns a clock anchored to `nowMs` when the active screen changed since
 * the last call, or the same clock instance unchanged otherwise (so callers
 * can use it as a stable dependency without extra memoization).
 */
export function advanceRuntimeAnimationClock(
  clock: RuntimeAnimationClock,
  screenId: string | null,
  nowMs: number
): RuntimeAnimationClock {
  if (screenId === clock.screenId) {
    return clock;
  }
  return { screenId, startedAtMs: nowMs };
}

/** Milliseconds elapsed since the clock's screen entry, never negative. */
export function runtimeAnimationElapsedMs(clock: RuntimeAnimationClock, nowMs: number): number {
  return Math.max(0, nowMs - clock.startedAtMs);
}

/**
 * True when the screen has at least one bitmap object bound to an animation
 * resource that actually exists in the catalog — the same condition
 * bytesForBitmap() (src/renderer/utils/render.ts) uses to pick an animated
 * frame instead of the object's static bytes. Used to skip scheduling
 * re-renders for screens with nothing to animate.
 */
export function screenHasAnimatedBitmap(
  screen: Pick<LcdScreen, 'objects'> | null,
  catalog: AnimationCatalog | null | undefined
): boolean {
  if (!screen || !catalog) return false;
  return screen.objects.some((object) =>
    object.type === 'bitmap' && !!object.animationId && !!catalog.resources[object.animationId]
  );
}

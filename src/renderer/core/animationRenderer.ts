import { resolveAnimationFrame } from '../../domain/animation';
import type { LcdBitmapProject } from '../../domain/project';
import {
  createFrameBuffer,
  bytesForBitmap,
  renderCanvasObjects,
  unpackBytesToFrameBuffer,
  type FrameBuffer,
  type RenderOptions
} from '../utils/render';

export { bytesForBitmap };

/** Renders a screen at a deterministic animation clock without changing project data. */
export function renderScreenAt(
  project: LcdBitmapProject,
  screenId: string,
  options: RenderOptions,
  elapsedMs: number
): FrameBuffer {
  const screen = project.screens[screenId];
  if (!screen) {
    return createFrameBuffer(options.width ?? project.display.width, options.height ?? project.display.height);
  }

  const resource = screen.animationId ? project.animations.resources[screen.animationId] : null;
  const frame = resource && resource.width === screen.width && resource.height === screen.height
    ? resolveAnimationFrame(resource, elapsedMs)
    : null;
  if (frame) {
    return unpackBytesToFrameBuffer(frame.bytes, screen.width, screen.height);
  }

  return renderCanvasObjects(screen.objects, {
    ...options,
    width: screen.width,
    height: screen.height,
    animationCatalog: project.animations,
    elapsedMs
  });
}

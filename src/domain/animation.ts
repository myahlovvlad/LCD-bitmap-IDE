export const MIN_ANIMATION_FRAME_DURATION_MS = 1;
export const MAX_ANIMATION_FRAME_DURATION_MS = 60_000;

export interface AnimationFrame {
  id: string;
  /** 1bpp pixels in the existing vertical-page byte layout. */
  bytes: number[];
  durationMs: number;
}

export interface AnimationResource {
  id: string;
  name: string;
  width: number;
  height: number;
  loop: boolean;
  frames: AnimationFrame[];
}

export interface AnimationCatalog {
  resources: Record<string, AnimationResource>;
  order: string[];
}

export function resolveAnimationFrame(resource: AnimationResource, elapsedMs: number): AnimationFrame | null {
  if (!resource.frames.length) return null;
  const total = resource.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  if (total <= 0) return resource.frames[0];
  let clock = resource.loop
    ? ((elapsedMs % total) + total) % total
    : Math.min(Math.max(0, elapsedMs), total - 1);
  return resource.frames.find((frame) => ((clock -= frame.durationMs) < 0)) ?? resource.frames.at(-1)!;
}

export function validateAnimationResource(resource: AnimationResource): string[] {
  const issues: string[] = [];
  if (!resource.id.trim()) issues.push('Animation resource ID is required.');
  if (!resource.name.trim()) issues.push(`Animation resource "${resource.id}" name is required.`);
  if (!Number.isInteger(resource.width) || resource.width <= 0) issues.push(`Animation resource "${resource.id}" width must be a positive integer.`);
  if (!Number.isInteger(resource.height) || resource.height <= 0) issues.push(`Animation resource "${resource.id}" height must be a positive integer.`);
  if (!resource.frames.length) issues.push(`Animation resource "${resource.id}" must contain at least one frame.`);

  const expectedByteLength = resource.width > 0 && resource.height > 0
    ? resource.width * Math.ceil(resource.height / 8)
    : 0;
  const frameIds = new Set<string>();
  for (const frame of resource.frames) {
    if (!frame.id.trim()) issues.push(`Animation resource "${resource.id}" has a frame without an ID.`);
    else if (frameIds.has(frame.id)) issues.push(`Animation resource "${resource.id}" has duplicate frame ID "${frame.id}".`);
    frameIds.add(frame.id);
    if (!Number.isInteger(frame.durationMs) || frame.durationMs < MIN_ANIMATION_FRAME_DURATION_MS || frame.durationMs > MAX_ANIMATION_FRAME_DURATION_MS) {
      issues.push(`Frame "${frame.id}" duration must be between 1 and 60000 ms.`);
    }
    if (frame.bytes.length !== expectedByteLength) {
      issues.push(`Frame "${frame.id}" must contain ${expectedByteLength} bytes in vertical-page order.`);
    } else if (frame.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      issues.push(`Frame "${frame.id}" contains an invalid 1bpp byte.`);
    }
  }
  return issues;
}

export function normalizeAnimationCatalog(catalog: AnimationCatalog | null | undefined): AnimationCatalog {
  const resources = Object.fromEntries(Object.entries(catalog?.resources ?? {}).flatMap(([key, resource]) => {
    if (!resource || typeof resource !== 'object') return [];
    const id = typeof resource.id === 'string' && resource.id ? resource.id : key;
    if (!id) return [];
    const frames = Array.isArray(resource.frames) ? resource.frames.flatMap((frame, index) => {
      if (!frame || typeof frame !== 'object') return [];
      return [{
        id: typeof frame.id === 'string' && frame.id ? frame.id : `${id}-frame-${index + 1}`,
        bytes: Array.isArray(frame.bytes) ? frame.bytes.filter((byte): byte is number => Number.isInteger(byte) && byte >= 0 && byte <= 255) : [],
        durationMs: Math.min(MAX_ANIMATION_FRAME_DURATION_MS, Math.max(MIN_ANIMATION_FRAME_DURATION_MS, Number.isFinite(frame.durationMs) ? Math.round(frame.durationMs) : MIN_ANIMATION_FRAME_DURATION_MS))
      }];
    }) : [];
    return [[id, {
      id,
      name: typeof resource.name === 'string' ? resource.name : id,
      width: Number.isInteger(resource.width) && resource.width > 0 ? resource.width : 1,
      height: Number.isInteger(resource.height) && resource.height > 0 ? resource.height : 1,
      loop: Boolean(resource.loop),
      frames
    }]];
  }));
  const order = [...new Set((catalog?.order ?? []).filter((id): id is string => typeof id === 'string' && Boolean(resources[id])))];
  return { resources, order };
}

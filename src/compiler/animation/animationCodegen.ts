import type { LoweredAnimationBindingIr, LoweredAnimationIr } from '../target-ir/targetIr';
import { generateCArray } from '../backends/legacyCBackend';

export function generateAnimationCHeader(
  resources: readonly LoweredAnimationIr[],
  baseName: string,
  bytesPerRow: number,
  bindings: readonly LoweredAnimationBindingIr[] = [],
  reservedSymbols: readonly string[] = []
): string {
  const resourceNames = allocateResourceNames(resources, baseName, reservedSymbols);
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const resourceRows = resources.map((resource) => `  { "${escapeCString(resource.id)}", &${resourceNames.get(resource.id)!} }`);
  const bindingRows = bindings.flatMap((binding) => {
    const resource = resourceById.get(binding.animationId);
    return resource ? [`  { "${escapeCString(binding.screenId)}", ${binding.objectId === null ? 'NULL' : `"${escapeCString(binding.objectId)}"`}, "${escapeCString(binding.animationId)}", &${resourceNames.get(resource.id)!} }`] : [];
  });
  const sections = resources.flatMap((resource) => {
    const name = resourceNames.get(resource.id)!;
    return [
      ...resource.frames.map((frame, index) => generateCArray(`${name}_frame_${index}`, frame.bytes, bytesPerRow)),
      `static const lcd_animation_frame_t ${name}_frames[] = { ${resource.frames.map((frame, index) => `{ ${name}_frame_${index}, ${frame.bytes.length}, ${frame.durationMs} }`).join(', ')} };`,
      `static const lcd_animation_t ${name} = { ${name}_frames, ${resource.frames.length}, ${resource.loop ? 'true' : 'false'} };`
    ];
  });

  return [
    'typedef struct { const uint8_t *bytes; uint32_t byte_count; uint32_t duration_ms; } lcd_animation_frame_t;',
    'typedef struct { const lcd_animation_frame_t *frames; uint16_t frame_count; bool loop; } lcd_animation_t;',
    'typedef struct { const char *animation_id; const lcd_animation_t *animation; } lcd_animation_resource_t;',
    'typedef struct { const char *screen_id; const char *object_id; const char *animation_id; const lcd_animation_t *animation; } lcd_animation_binding_t;',
    ...sections,
    `static const lcd_animation_resource_t ${baseName}_animation_resources[${resources.length}] = {\n${resourceRows.join(',\n')}\n};`,
    ...(bindingRows.length > 0
      ? [`static const lcd_animation_binding_t ${baseName}_animation_bindings[${bindingRows.length}] = {\n${bindingRows.join(',\n')}\n};`]
      : []),
    `#define ${baseName.toUpperCase()}_ANIMATION_RESOURCE_COUNT ${resources.length}`,
    `#define ${baseName.toUpperCase()}_ANIMATION_BINDING_COUNT ${bindingRows.length}`
  ].join('\n\n');
}

function allocateResourceNames(
  resources: readonly LoweredAnimationIr[],
  baseName: string,
  reservedSymbols: readonly string[]
): ReadonlyMap<string, string> {
  const claimed = new Set([
    `${baseName}_screens`,
    `${baseName}_animation_resources`,
    `${baseName}_animation_bindings`,
    ...reservedSymbols
  ]);
  const names = new Map<string, string>();
  resources.forEach((resource) => {
    const stem = `${baseName}_${resource.symbol}`;
    let candidate = stem;
    let suffix = 2;
    while (claimsConflict(candidate, resource.frames.length, claimed)) {
      candidate = `${stem}_${suffix}`;
      suffix += 1;
    }
    claimResourceSymbols(candidate, resource.frames.length, claimed);
    names.set(resource.id, candidate);
  });
  return names;
}

function claimsConflict(name: string, frameCount: number, claimed: ReadonlySet<string>): boolean {
  return generatedResourceSymbols(name, frameCount).some((symbol) => claimed.has(symbol));
}

function claimResourceSymbols(name: string, frameCount: number, claimed: Set<string>): void {
  generatedResourceSymbols(name, frameCount).forEach((symbol) => claimed.add(symbol));
}

function generatedResourceSymbols(name: string, frameCount: number): readonly string[] {
  return [name, `${name}_frames`, ...Array.from({ length: frameCount }, (_, index) => `${name}_frame_${index}`)];
}

function escapeCString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

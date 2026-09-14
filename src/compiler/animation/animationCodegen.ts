import type { LoweredAnimationBindingIr, LoweredAnimationIr } from '../target-ir/targetIr';
import { generateCArray } from '../backends/legacyCBackend';

export function generateAnimationCHeader(
  resources: readonly LoweredAnimationIr[],
  baseName: string,
  bytesPerRow: number,
  bindings: readonly LoweredAnimationBindingIr[] = []
): string {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const resourceRows = resources.map((resource) => `  { "${escapeCString(resource.id)}", &${resourceName(baseName, resource)} }`);
  const bindingRows = bindings.flatMap((binding) => {
    const resource = resourceById.get(binding.animationId);
    return resource ? [`  { "${escapeCString(binding.screenId)}", ${binding.objectId === null ? 'NULL' : `"${escapeCString(binding.objectId)}"`}, "${escapeCString(binding.animationId)}", &${resourceName(baseName, resource)} }`] : [];
  });
  const sections = resources.flatMap((resource) => {
    const name = resourceName(baseName, resource);
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

function resourceName(baseName: string, resource: LoweredAnimationIr): string {
  return `${baseName}_${resource.symbol}`;
}

function escapeCString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

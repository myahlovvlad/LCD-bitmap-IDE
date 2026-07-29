import type { HmiTag } from '../../domain/tag';
import type { LcdScreen } from '../../domain/project';
import type { TagContext, TagValue } from './TagContext';

export function resolveLcdScreenBindings(
  screen: LcdScreen,
  tags: TagContext,
  registry: Readonly<Record<string, HmiTag>>
): LcdScreen {
  return {
    ...screen,
    objects: screen.objects.map((object) => {
      const binding = object.bindings?.text;
      if (object.type !== 'text' || !binding || binding.kind !== 'tag') {
        return object;
      }
      const tag = registry[binding.tagId];
      const value = tags.get(binding.tagId);
      const rendered = formatHmiValue(value, tag?.format, tag?.unit);
      return {
        ...object,
        text: { en: rendered, ru: rendered, zh: rendered }
      };
    })
  };
}

export function formatHmiValue(value: TagValue, format?: string, unit?: string): string {
  const formatted = formatPrintfValue(value, format);
  if (!unit) return formatted;
  return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
}

export function formatPrintfValue(value: TagValue, format?: string): string {
  if (value === null) return '---';
  if (!format) return String(value);

  const integer = format.match(/^%(\d*)d$/);
  if (integer) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '---';
    const rendered = String(Math.trunc(value));
    return integer[1] ? rendered.padStart(Number(integer[1]), ' ') : rendered;
  }

  const float = format.match(/^%(\d*)\.(\d+)f$/);
  if (float) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '---';
    const rendered = value.toFixed(Number(float[2]));
    return float[1] ? rendered.padStart(Number(float[1]), ' ') : rendered;
  }

  return String(value);
}

import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { ECROS_5300_HMI_TAGS } from '../../src/spectrophotometer';
import { MutableTagContext } from '../../src/services/runtime/TagContext';
import { formatHmiValue, resolveLcdScreenBindings } from '../../src/services/runtime/resolveLcdBindings';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('LCD runtime tag bindings', () => {
  it('formats printf-compatible values with units', () => {
    expect(formatHmiValue(1.23456, '%.3f', 'A')).toBe('1.235 A');
    expect(formatHmiValue(98.24, '%.1f', '%')).toBe('98.2%');
    expect(formatHmiValue(5, '%3d', 'mm')).toBe('  5 mm');
    expect(formatHmiValue(null, '%.3f', 'A')).toBe('--- A');
  });

  it('substitutes a bound text object without mutating the design screen', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const source = project.screens[project.screenOrder[0]];
    const text = source.objects.find((object) => object.type === 'text')!;
    const bound = {
      ...source,
      objects: source.objects.map((object) => object.id === text.id
        ? { ...object, bindings: { ...object.bindings, text: { kind: 'tag' as const, tagId: 'measurement.absorbance' } } }
        : object)
    };
    const resolved = resolveLcdScreenBindings(
      bound,
      new MutableTagContext({ 'measurement.absorbance': 0.4567 }),
      ECROS_5300_HMI_TAGS
    );
    const resolvedText = resolved.objects.find((object) => object.id === text.id);
    expect(resolvedText?.type === 'text' ? resolvedText.text.en : null).toBe('0.457 A');
    expect(text.type === 'text' ? text.text.en : null).not.toBe('0.457 A');
  });
});

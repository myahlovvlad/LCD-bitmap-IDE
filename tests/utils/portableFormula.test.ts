import { describe, expect, it } from 'vitest';
import {
  emitPortableFormulaC,
  evaluatePortableFormula,
  parsePortableFormula
} from '../../src/domain/portableFormula';

describe('portable HMI formula', () => {
  it('evaluates corrected single-beam absorbance', () => {
    const expression = 'log10((e100 - e0) / (esample - e0))';
    const result = evaluatePortableFormula(expression, { e100: 30311, e0: 20, esample: 15165.5 });

    expect(result.diagnostics).toEqual([]);
    expect(result.value).toBeCloseTo(Math.log10(2), 10);
  });

  it('supports legacy Math function spelling without executing JavaScript', () => {
    expect(evaluatePortableFormula('Math.log10(e100 / esample)', { e100: 100, esample: 10 }).value).toBe(1);
    expect(() => parsePortableFormula('globalThis.process.exit()')).toThrow(/Unsupported function|Unsupported token/);
  });

  it('rejects division by zero and missing references', () => {
    expect(evaluatePortableFormula('a / b', { a: 1, b: 0 }).value).toBeNull();
    expect(evaluatePortableFormula('a + missing', { a: 1 }).diagnostics[0]?.code).toBe('unknown-reference');
  });

  it('emits deterministic C using sanitized tag symbols', () => {
    expect(emitPortableFormulaC('100 * (sample.adc - dark.adc) / (ref.adc - dark.adc)'))
      .toBe('((100.0 * (sample_adc - dark_adc)) / (ref_adc - dark_adc))');
  });
});

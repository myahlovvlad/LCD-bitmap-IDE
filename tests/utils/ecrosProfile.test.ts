import { describe, expect, it } from 'vitest';
import {
  buildEcrosCommand,
  ECROS_5300_DYNAMIC_FIELDS,
  ECROS_5300_FORMULAS,
  ECROS_5300_HMI_TAGS,
  parseEcrosResponse
} from '../../src/spectrophotometer';
import { emitPortableFormulaC, evaluatePortableFormula } from '../../src/domain/portableFormula';

describe('ECROS-5300VI/5310 HMI profile', () => {
  it('contains the requested dynamic LCD fields with trilingual labels', () => {
    expect(ECROS_5300_DYNAMIC_FIELDS).toHaveLength(13);
    expect(ECROS_5300_HMI_TAGS['measurement.absorbance']).toMatchObject({
      dataType: 'float',
      format: '%.3f',
      unit: 'A'
    });
    expect(ECROS_5300_HMI_TAGS['measurement.concentration'].name.zh).toBeTruthy();
  });

  it('uses the same portable expression for simulation and C generation', () => {
    const formula = ECROS_5300_FORMULAS.find((item) => item.targetTagId === 'measurement.absorbance')!;
    const values = {
      'instrument.signal.reference_adc': 30311,
      'instrument.signal.dark_adc': 20,
      'instrument.signal.sample_adc': 15165.5
    };
    expect(evaluatePortableFormula(formula.expression, values).value).toBeCloseTo(Math.log10(2), 10);
    expect(emitPortableFormulaC(formula.expression)).toContain('log10');
    expect(emitPortableFormulaC(formula.expression)).toContain('instrument_signal_reference_adc');
  });

  it('builds validated synchronous commands and parses response contracts', () => {
    expect(buildEcrosCommand('sa', 5)).toBe('sa 5');
    expect(() => buildEcrosCommand('sa', 9)).toThrow(/<= 8/);
    expect(buildEcrosCommand('swl', 546.3)).toBe('swl 546.3');
    expect(() => buildEcrosCommand('swl', 1200)).toThrow(/<= 1100/);
    expect(parseEcrosResponse('connect', 'ok.')).toEqual({ kind: 'ok' });
    expect(parseEcrosResponse('getwl', '546.3\r\n')).toEqual({ kind: 'number', value: 546.3 });
    expect(parseEcrosResponse('rezero', '30311\r\n2\r\n')).toEqual({
      kind: 'rezero',
      referenceAdc: 30311,
      gain: 2
    });
    expect(parseEcrosResponse('getdark', '10\n20\n40\n80\n160\n320\n640\n1280')).toEqual({
      kind: 'integer-list',
      values: [10, 20, 40, 80, 160, 320, 640, 1280]
    });
    expect(() => parseEcrosResponse('ge', 'Bad Argument\r\n')).toThrow(/failed: Bad Argument/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  Ecros5501OperationalSimulator,
  Ecros5501SimulationTransport,
  resolveEcrosInstrumentProfile,
  selectEcrosFilterForWavelength
} from '../../src/spectrophotometer';

describe('ECROS-5501 operational simulator', () => {
  it('resolves the longest serial prefix and derives instrument capabilities', () => {
    expect(resolveEcrosInstrumentProfile('5K501E001')).toMatchObject({
      id: 'ECROS-5501',
      beamMode: 'single',
      slitWidthsNm: [1.8],
      supportsVariableSlit: false
    });
    expect(resolveEcrosInstrumentProfile('5К621E009')).toMatchObject({
      id: 'ECROS-5621',
      beamMode: 'dual',
      slitWidthsNm: [0.5, 1, 1.8, 4, 6]
    });
  });

  it('maps wavelength ranges to the observed ECROS filter wheel positions', () => {
    expect([
      selectEcrosFilterForWavelength(190),
      selectEcrosFilterForWavelength(320),
      selectEcrosFilterForWavelength(370),
      selectEcrosFilterForWavelength(450),
      selectEcrosFilterForWavelength(585),
      selectEcrosFilterForWavelength(850)
    ]).toEqual([4, 2, 1, 8, 7, 6]);
  });

  it('keeps swl and swm semantics distinct', () => {
    const simulator = new Ecros5501OperationalSimulator({ connected: true });
    simulator.execute('swl 320');
    expect(simulator.state).toMatchObject({
      wavelengthNm: 320,
      gratingWavelengthNm: 320,
      filterId: 2
    });

    const result = simulator.execute('swm 900');
    expect(simulator.state).toMatchObject({
      wavelengthNm: 320,
      gratingWavelengthNm: 900,
      filterId: 2
    });
    expect(result.operations).toContain('Filter wheel unchanged → 2');
  });

  it('uses filter position 3 only temporarily during dark-current acquisition', () => {
    const simulator = new Ecros5501OperationalSimulator({ connected: true, filterId: 8 });
    const result = simulator.execute('resetdark');
    expect(result.response.split('\r\n')).toHaveLength(8);
    expect(result.operations).toEqual([
      'Filter wheel → 3 (shutter)',
      'Measured dark current for gain 1–8',
      'Filter wheel restored → 8'
    ]);
    expect(simulator.state.filterId).toBe(8);
  });

  it('models wavelength calibration and fixed-slit/autosampler capability gates', () => {
    const simulator = new Ecros5501OperationalSimulator({ connected: true });
    simulator.execute('adjustwl');
    expect(simulator.state).toMatchObject({
      deuteriumLampOn: true,
      wavelengthNm: 546,
      gratingWavelengthNm: 546,
      filterId: 8
    });
    expect(() => simulator.execute('setslit 3')).toThrow(/fixed 1.8 nm slit/);
    expect(() => simulator.execute('setsampler 2')).toThrow(/not installed/);
  });

  it('provides the same stateful command behavior through the runtime transport', async () => {
    const transport = new Ecros5501SimulationTransport({ startConnected: true });
    expect(await transport.sendCommand('swl 585')).toEqual({ ok: true, response: 'ok.' });
    expect(transport.simulator.state.filterId).toBe(7);
    expect(await transport.sendCommand('getwl')).toEqual({ ok: true, response: '585' });
  });
});

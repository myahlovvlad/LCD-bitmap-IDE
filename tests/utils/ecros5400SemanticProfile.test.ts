import { describe, expect, it } from 'vitest';
import {
  buildEcros5400WorkflowDefinitions,
  classifyEcros5400State,
  resolveEcros5400EventIntent
} from '../../src/services/semantic/profiles/ecros5400Profile';

describe('ECROS-5400 semantic profile', () => {
  it('separates Photometry A, E and %T branches', () => {
    expect(classifyEcros5400State({ id: 'PHOT_A_MAIN_ZERO_PROC', title: 'Photometry-A-Main-zero-process' })).toMatchObject({ mode: 'photometry', phase: 'zeroing', quantity: 'A', operation: 'measurement.zero' });
    expect(classifyEcros5400State({ id: 'PHOT_E_MAIN_ZERO_PROC', title: 'Photometry-E-Main-zero-process' })).toMatchObject({ mode: 'photometry', phase: 'zeroing', quantity: 'E', operation: 'measurement.zero' });
    expect(classifyEcros5400State({ id: 'PHOT_T_MEAS_N1_UNFIXED', title: 'Photometry-T-n-1-measurement' })).toMatchObject({ mode: 'photometry', phase: 'measurement', quantity: '%T', operation: 'measurement.measure' });
  });

  it('classifies the supported typed input contexts', () => {
    expect(classifyEcros5400State({ id: 'PHOT_IN_WL_IN', title: 'Photometry-input_wl_inputing' }).inputKind).toBe('numeric.wavelength');
    expect(classifyEcros5400State({ id: 'PHOT_PAR_PARLL_MEAS_IN', title: 'Photometry-parameters-parall measurement input' }).inputKind).toBe('numeric.parallel_count');
    expect(classifyEcros5400State({ id: 'PHOT_PAR_MODE_E_IN_GAIN', title: 'Photometry-parameters-mode-E-input gain' }).inputKind).toBe('numeric.gain');
    expect(classifyEcros5400State({ id: 'Q_COEF_INPUT', title: 'Quantitative coefficient input' }).inputKind).toBe('numeric.coefficient');
    expect(classifyEcros5400State({ id: 'QC_CONC_INPUT', title: 'Quantitative calibration concentration input' }).inputKind).toBe('numeric.concentration');
    expect(classifyEcros5400State({ id: 'F_NAME', title: 'File name input' }).inputKind).toBe('text.filename');
  });

  it('resolves physical-panel actions contextually', () => {
    const measurement = classifyEcros5400State({ id: 'P_MEAS', title: 'Photometry measurement' });
    const main = classifyEcros5400State({ id: 'P_MAIN', title: 'Photometry main' });
    expect(resolveEcros5400EventIntent('UI.ZERO', main, classifyEcros5400State({ id: 'P_ZERO', title: 'Photometry zeroing' }))).toBe('measurement.zero');
    expect(resolveEcros5400EventIntent('UI.WL', main, classifyEcros5400State({ id: 'P_WL', title: 'Photometry wavelength input' }))).toBe('input.wavelength.open');
    expect(resolveEcros5400EventIntent('UI.PAR', main, classifyEcros5400State({ id: 'P_PAR', title: 'Photometry parameters' }))).toBe('parameters.open');
    expect(resolveEcros5400EventIntent('UI.RUN', main, measurement)).toBe('measurement.start');
    expect(resolveEcros5400EventIntent('UI.RUN', measurement, measurement)).toBe('measurement.pause_or_resume');
    expect(resolveEcros5400EventIntent('UI.CLR', measurement, measurement)).toBe('result.clear_selected');
    expect(resolveEcros5400EventIntent('UI.PRN', measurement, measurement)).toBe('result.print');
    expect(resolveEcros5400EventIntent('UI.ESC', measurement, main)).toBe('navigation.cancel');
    expect(resolveEcros5400EventIntent('UI.UP', main, main)).toBe('selection.previous');
    expect(resolveEcros5400EventIntent('UI.DOWN', main, main)).toBe('selection.next');
  });

  it('treats numeric keys, minus and decimal point as input mutations', () => {
    const input = classifyEcros5400State({ id: 'PHOT_IN_WL_IN', title: 'Photometry-input_wl_inputing' });
    expect(resolveEcros5400EventIntent('UI.K7', input, input)).toBe('input.append_digit');
    expect(resolveEcros5400EventIntent('UI.MINUS', input, input)).toBe('input.toggle_sign');
    expect(resolveEcros5400EventIntent('UI.DOT', input, input)).toBe('input.append_decimal');
    expect(resolveEcros5400EventIntent('UI.OK', input, input)).toBe('input.confirm');
  });

  it('declares all requested ECROS workflows and keeps photometry quantity branches separate', () => {
    const states = [
      { id: 'INIT', title: 'Init' }, { id: 'SELFTEST', title: 'Self diagnostic' }, { id: 'WARMUP', title: 'Warming' }, { id: 'MAIN', title: 'Main menu' },
      { id: 'P_PAR', title: 'Photometry parameters' }, { id: 'P_WL', title: 'Photometry wavelength input' },
      { id: 'PHOT_A_MAIN_ZERO_PROC', title: 'Photometry-A-Main-zero-process' }, { id: 'PHOT_A_MEAS_N1_UNFIXED', title: 'Photometry-A measurement' },
      { id: 'PHOT_E_MAIN_ZERO_PROC', title: 'Photometry-E-Main-zero-process' }, { id: 'PHOT_E_MEAS_N1_UNFIXED', title: 'Photometry-E measurement' },
      { id: 'PHOT_T_MAIN_ZERO_PROC', title: 'Photometry-T-Main-zero-process' }, { id: 'PHOT_T_MEAS_N1_UNFIXED', title: 'Photometry-T measurement' },
      { id: 'Q_NEW_SETUP', title: 'Quantitative new calibration setup' }, { id: 'QC_MEAS', title: 'Calibration measurement' },
      { id: 'Q_LOAD_FILE', title: 'Quantitative load calibration file' }, { id: 'Q_COEF_NEW', title: 'Quantitative coefficient create' }, { id: 'Q_COEF_OPEN_FILE', title: 'Quantitative coefficient open file' },
      { id: 'K_MEAS', title: 'Kinetics measurement' }, { id: 'MW_MEAS', title: 'Multiwavelength measurement' },
      { id: 'F_RESULT', title: 'File open result' }, { id: 'F_CALIB', title: 'File open calibration' }, { id: 'S_MAIN', title: 'Settings main' }
    ];
    const workflows = buildEcros5400WorkflowDefinitions(states);
    const ids = workflows.map((workflow) => workflow.id);
    expect(ids).toEqual(expect.arrayContaining([
      'startup.standard', 'measurement.photometry', 'measurement.quantitative.new_calibration',
      'measurement.quantitative.load_calibration', 'measurement.quantitative.coefficients.create',
      'measurement.quantitative.coefficients.open', 'measurement.kinetics', 'measurement.multiwave',
      'files.open_result', 'files.open_calibration', 'settings.main'
    ]));

    const photometry = workflows.find((workflow) => workflow.id === 'measurement.photometry')!;
    const a = photometry.steps.find((step) => step.id === 'zero.A')!;
    const e = photometry.steps.find((step) => step.id === 'zero.E')!;
    const t = photometry.steps.find((step) => step.id === 'zero.T')!;
    expect(a.stateIds).toEqual(['PHOT_A_MAIN_ZERO_PROC']);
    expect(e.stateIds).toEqual(['PHOT_E_MAIN_ZERO_PROC']);
    expect(t.stateIds).toEqual(['PHOT_T_MAIN_ZERO_PROC']);
  });
});

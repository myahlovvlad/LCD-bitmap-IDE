import type { DataSource, HmiTag } from '../domain/tag';

export const ECROS_5300_PROFILE_ID = 'ecros-5300vi-5310' as const;

export interface DynamicLcdFieldDefinition {
  objectId: string;
  tagId: string;
  format: string;
  unit: string;
  label: { en: string; ru: string; zh: string };
}

export interface SpectrophotometerFormulaDefinition {
  id: string;
  targetTagId: string;
  expression: string;
  dependencies: string[];
  cFunctionName: string;
  note?: string;
}

const field = (
  objectId: string,
  tagId: string,
  dataType: HmiTag['dataType'],
  format: string,
  unit: string,
  en: string,
  ru: string,
  zh: string
): { tag: HmiTag; field: DynamicLcdFieldDefinition } => ({
  tag: {
    id: tagId,
    name: { en, ru, zh },
    dataType,
    format,
    unit,
    precision: precisionFromFormat(format)
  },
  field: { objectId, tagId, format, unit, label: { en, ru, zh } }
});

const DEFINITIONS = [
  field('result_concentration', 'measurement.concentration', 'float', '%.3f', 'C', 'Concentration', 'Концентрация', '浓度'),
  field('result_repeatability_r', 'measurement.stats.repeatability_percent', 'float', '%.1f', '%', 'Repeatability r', 'Повторяемость r', '重复性 r'),
  field('result_concentration_mean', 'measurement.stats.mean_concentration', 'float', '%.3f', 'C', 'Mean concentration', 'Средняя концентрация', '平均浓度'),
  field('result_transmittance', 'measurement.transmittance', 'float', '%.1f', '%', 'Transmittance T', 'Пропускание T', '透射率 T'),
  field('result_absorbance', 'measurement.absorbance', 'float', '%.3f', 'A', 'Absorbance', 'Оптическая плотность', '吸光度'),
  field('result_percent_transmittance', 'measurement.transmittance_percent', 'float', '%.1f', '%', 'Percent transmittance', 'Пропускание %T', '百分透射率'),
  field('result_parallel_index', 'measurement.parallel.index', 'int', '%d', '', 'Replicate index', 'Номер параллельного измерения', '平行测量序号'),
  field('calibration_index', 'calibration.series.index', 'int', '%d', '', 'Calibration index', 'Номер градуировки', '校准序号'),
  field('result_dilution', 'measurement.dilution.factor', 'float', '%.1f', '', 'Dilution factor', 'Разбавление', '稀释倍数'),
  field('result_path_length_mm', 'measurement.pathlength_mm', 'int', '%3d', 'mm', 'Path length', 'Длина пути', '光程'),
  field('result_parallel_count', 'measurement.parallel.count', 'int', '%d', '', 'Replicate count', 'Число параллельных измерений', '平行测量次数'),
  field('calibration_slope_m', 'calibration.curve.slope_m', 'float', '%.4f', '', 'Calibration slope m', 'Коэффициент наклона m', '校准斜率 m'),
  field('calibration_slope_k', 'calibration.curve.slope_k', 'float', '%.4f', '', 'Calibration intercept k', 'Коэффициент k', '校准截距 k')
] as const;

const RAW_SIGNAL_TAGS: HmiTag[] = [
  { id: 'instrument.signal.reference_adc', name: { en: '100% reference ADC', ru: 'АЦП 100%', zh: '100%参考 ADC' }, dataType: 'float' },
  { id: 'instrument.signal.sample_adc', name: { en: 'Sample ADC', ru: 'АЦП образца', zh: '样品 ADC' }, dataType: 'float' },
  { id: 'instrument.signal.dark_adc', name: { en: 'Dark current ADC', ru: 'АЦП темнового тока', zh: '暗电流 ADC' }, dataType: 'float' },
  { id: 'instrument.gain', name: { en: 'Gain', ru: 'Ступень усиления', zh: '增益档位' }, dataType: 'int', minValue: 1, maxValue: 8 }
];

export const ECROS_5300_DYNAMIC_FIELDS: readonly DynamicLcdFieldDefinition[] = DEFINITIONS.map((item) => item.field);

export const ECROS_5300_HMI_TAGS: Readonly<Record<string, HmiTag>> = Object.fromEntries(
  [...DEFINITIONS.map((item) => item.tag), ...RAW_SIGNAL_TAGS].map((tag) => [tag.id, tag])
);

export const ECROS_5300_DATA_SOURCES: Readonly<Record<string, DataSource>> = {
  'ecros.cli': {
    id: 'ecros.cli',
    kind: 'cli',
    config: {
      profileId: ECROS_5300_PROFILE_ID,
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: 'none',
      encoding: 'iso-8859-1',
      lineTerminator: '\r',
      synchronous: true,
      maxConcurrency: 1
    }
  },
  'ecros.formulas': {
    id: 'ecros.formulas',
    kind: 'formula',
    config: { profileId: ECROS_5300_PROFILE_ID }
  }
};

export const ECROS_5300_FORMULAS: readonly SpectrophotometerFormulaDefinition[] = [
  {
    id: 'formula.transmittance_percent',
    targetTagId: 'measurement.transmittance_percent',
    expression: '100 * (instrument.signal.sample_adc - instrument.signal.dark_adc) / (instrument.signal.reference_adc - instrument.signal.dark_adc)',
    dependencies: [
      'instrument.signal.sample_adc',
      'instrument.signal.dark_adc',
      'instrument.signal.reference_adc'
    ],
    cFunctionName: 'hmi_calculate_transmittance_percent'
  },
  {
    id: 'formula.absorbance',
    targetTagId: 'measurement.absorbance',
    expression: 'log10((instrument.signal.reference_adc - instrument.signal.dark_adc) / (instrument.signal.sample_adc - instrument.signal.dark_adc))',
    dependencies: [
      'instrument.signal.reference_adc',
      'instrument.signal.dark_adc',
      'instrument.signal.sample_adc'
    ],
    cFunctionName: 'hmi_calculate_absorbance'
  },
  {
    id: 'formula.concentration.linear-absorbance',
    targetTagId: 'measurement.concentration',
    expression: '(measurement.absorbance - calibration.curve.slope_k) / calibration.curve.slope_m',
    dependencies: [
      'measurement.absorbance',
      'calibration.curve.slope_k',
      'calibration.curve.slope_m'
    ],
    cFunctionName: 'hmi_calculate_concentration',
    note: 'Assumes A = m*C + k. Keep configurable until the firmware calibration convention is confirmed.'
  }
];

function precisionFromFormat(format: string): number | undefined {
  const match = format.match(/%\d*\.(\d+)f$/);
  return match ? Number(match[1]) : undefined;
}

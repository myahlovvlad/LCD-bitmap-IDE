export type EcrosBeamMode = 'single' | 'dual';

export interface EcrosInstrumentProfile {
  id: string;
  serialPrefixes: readonly string[];
  beamMode: EcrosBeamMode;
  wavelengthRangeNm: readonly [number, number];
  slitWidthsNm: readonly number[];
  supportsVariableSlit: boolean;
  supportsAutosampler: boolean;
}

const profile = (
  id: string,
  serialPrefixes: readonly string[],
  beamMode: EcrosBeamMode,
  slitWidthsNm: readonly number[],
  supportsAutosampler = true
): EcrosInstrumentProfile => ({
  id,
  serialPrefixes,
  beamMode,
  wavelengthRangeNm: [190, 1100],
  slitWidthsNm,
  supportsVariableSlit: slitWidthsNm.length > 1,
  supportsAutosampler
});

export const ECROS_INSTRUMENT_PROFILES: readonly EcrosInstrumentProfile[] = [
  profile('ECROS-5400VI', ['54VI'], 'single', [4], false),
  profile('ECROS-5400UV', ['54UF'], 'single', [1.8], false),
  profile('ECROS-5500', ['5K5E'], 'single', [1.8]),
  profile('ECROS-5501', ['5K501E', 'ECROS-5501'], 'single', [1.8]),
  profile('ECROS-5510', ['5K51E'], 'single', [1]),
  profile('ECROS-5511', ['5K511E'], 'single', [1]),
  profile('ECROS-5520', ['5K52E'], 'single', [0.5, 1, 1.8, 4, 6]),
  profile('ECROS-5521', ['5K521E'], 'single', [0.5, 1, 1.8, 4, 6]),
  profile('ECROS-5600', ['5K6E'], 'dual', [1.8]),
  profile('ECROS-5601', ['5K601E'], 'dual', [1.8]),
  profile('ECROS-5610', ['5K61E'], 'dual', [1]),
  profile('ECROS-5611', ['5K611E'], 'dual', [1]),
  profile('ECROS-5620', ['5K62E'], 'dual', [0.5, 1, 1.8, 4, 6]),
  profile('ECROS-5621', ['5K621E'], 'dual', [0.5, 1, 1.8, 4, 6])
];

export type EcrosFilterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface EcrosFilterDefinition {
  id: EcrosFilterId;
  role: 'blue' | 'violet' | 'shutter' | 'open' | 'reserved' | 'red' | 'yellow' | 'green';
  labelRu: string;
}

export const ECROS_FILTERS: Readonly<Record<EcrosFilterId, EcrosFilterDefinition>> = {
  1: { id: 1, role: 'blue', labelRu: 'Синий светофильтр' },
  2: { id: 2, role: 'violet', labelRu: 'Фиолетовый светофильтр' },
  3: { id: 3, role: 'shutter', labelRu: 'Заглушка, световой поток перекрыт' },
  4: { id: 4, role: 'open', labelRu: 'Открытый тракт без светофильтра' },
  5: { id: 5, role: 'reserved', labelRu: 'Резервная позиция без светофильтра' },
  6: { id: 6, role: 'red', labelRu: 'Красный светофильтр' },
  7: { id: 7, role: 'yellow', labelRu: 'Жёлтый светофильтр' },
  8: { id: 8, role: 'green', labelRu: 'Зелёный светофильтр' }
};

export function normalizeEcrosIdentity(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/К/g, 'K')
    .replace(/В/g, 'V')
    .replace(/И/g, 'I')
    .replace(/У/g, 'U')
    .replace(/Ф/g, 'F')
    .replace(/[^A-Z0-9-]/g, '');
}

export function resolveEcrosInstrumentProfile(
  serialOrModel: string
): EcrosInstrumentProfile | null {
  const normalized = normalizeEcrosIdentity(serialOrModel);
  const candidates = ECROS_INSTRUMENT_PROFILES
    .flatMap((item) => [
      { item, prefix: normalizeEcrosIdentity(item.id) },
      ...item.serialPrefixes.map((prefix) => ({ item, prefix: normalizeEcrosIdentity(prefix) }))
    ])
    .sort((left, right) => right.prefix.length - left.prefix.length);
  return candidates.find(({ prefix }) => normalized.includes(prefix))?.item ?? null;
}

/**
 * ECROS-55xx/56xx filter-wheel policy observed for `swl`.
 * Position 4 is used as the deterministic open/no-filter position.
 */
export function selectEcrosFilterForWavelength(wavelengthNm: number): EcrosFilterId {
  if (!Number.isFinite(wavelengthNm) || wavelengthNm < 190 || wavelengthNm > 1100) {
    throw new Error('Wavelength must be within 190–1100 nm.');
  }
  if (wavelengthNm < 320) return 4;
  if (wavelengthNm < 370) return 2;
  if (wavelengthNm < 450) return 1;
  if (wavelengthNm < 585) return 8;
  if (wavelengthNm < 850) return 7;
  return 6;
}

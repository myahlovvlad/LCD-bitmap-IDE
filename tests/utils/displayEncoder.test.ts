import { describe, expect, it } from 'vitest';
import { encodeDisplayRaster, getEncodedDisplayByteLength } from '../../src/compiler/encoding/displayEncoder';

describe('display encoder boundary', () => {
  it('owns byte-length calculation for non-page-aligned displays', () => {
    expect(getEncodedDisplayByteLength({
      width: 9,
      height: 9,
      colorMode: 'monochrome',
      packing: 'vertical-lsb'
    })).toBe(18);
  });

  it('encodes the canonical raster using the same profile contract', () => {
    const raster = Array.from({ length: 9 }, () => Array.from({ length: 2 }, () => false));
    raster[0][0] = true;
    raster[8][1] = true;
    const bytes = encodeDisplayRaster(raster, {
      width: 2,
      height: 9,
      colorMode: 'monochrome',
      packing: 'vertical-lsb'
    });

    expect(bytes).toEqual([0x01, 0x00, 0x00, 0x01]);
  });
});

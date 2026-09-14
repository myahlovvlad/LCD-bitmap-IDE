import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_CONFIG, createDisplayProfile } from '../../src/domain';
import {
  calculateEncodedByteLength,
  canonicalRasterFromMonochromeRows,
  createCanonicalRaster,
  decodeDisplayBytes,
  encodeDisplayRaster,
  pixelFromSample,
  rgba
} from '../../src/compiler';

describe('display encoder/decoder boundary', () => {
  it('owns byte-length calculation for non-page-aligned displays', () => {
    const profile = createDisplayProfile({ ...DEFAULT_DISPLAY_CONFIG, id: '9x9', name: '9x9', width: 9, height: 9 });
    expect(calculateEncodedByteLength(profile)).toBe(18);
  });

  it('keeps the legacy 128x64 vertical-LSB byte layout', () => {
    const rows = Array.from({ length: 64 }, () => Array.from({ length: 128 }, () => false));
    rows[0][0] = true;
    rows[7][0] = true;
    rows[8][1] = true;
    const bytes = encodeDisplayRaster(canonicalRasterFromMonochromeRows(rows), DEFAULT_DISPLAY_CONFIG);
    expect(bytes.slice(0, 130)).toEqual([0x81, ...Array.from({ length: 127 }, () => 0), 0, 1]);
    expect(bytes).toHaveLength(1024);
    expect(decodeDisplayBytes(bytes, DEFAULT_DISPLAY_CONFIG).pixels).toEqual(canonicalRasterFromMonochromeRows(rows).pixels);
  });

  it.each(createRoundTripProfiles())('round-trips representable pixels for $pixelFormat/$packing', (profile) => {
    let seed = 0x12345678;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const max = profile.bitsPerPixel === 32 ? 0xffffffff : (2 ** profile.bitsPerPixel) - 1;
      const pixels = Array.from({ length: profile.width * profile.height }, () =>
        profile.pixelFormat === 'rgb565'
          ? pixelFromSample(next() & 0xffff, profile)
          : profile.pixelFormat === 'mono1' || profile.pixelFormat === 'gray2' || profile.pixelFormat === 'gray4'
            ? pixelFromSample(next() % (max + 1), profile)
            : rgba(next() & 0xff, next() & 0xff, next() & 0xff)
      );
      const raster = createCanonicalRaster(profile.width, profile.height, pixels);
      expect(decodeDisplayBytes(encodeDisplayRaster(raster, profile), profile).pixels).toEqual(raster.pixels);
    }
  });
});

function createRoundTripProfiles() {
  return [
    createDisplayProfile({ ...DEFAULT_DISPLAY_CONFIG, id: 'mono-v', name: 'mono vertical', width: 17, height: 13 }),
    createDisplayProfile({
      ...DEFAULT_DISPLAY_CONFIG, id: 'gray2', name: 'gray2', width: 17, height: 13,
      pixelFormat: 'gray2', bitsPerPixel: 2, packing: 'horizontal-row-major', pageHeight: undefined,
      bitOrder: 'msb-first', rotation: 90, mirrorX: true
    }),
    createDisplayProfile({
      ...DEFAULT_DISPLAY_CONFIG, id: 'gray4', name: 'gray4 planar', width: 17, height: 13,
      pixelFormat: 'gray4', bitsPerPixel: 4, packing: 'planar', pageHeight: undefined,
      bitOrder: 'lsb-first', rotation: 270, mirrorY: true, inverted: true
    }),
    createDisplayProfile({
      ...DEFAULT_DISPLAY_CONFIG, id: 'rgb565', name: 'rgb565', width: 17, height: 13,
      pixelFormat: 'rgb565', bitsPerPixel: 16, packing: 'interleaved', pageHeight: undefined,
      byteOrder: 'big-endian', rotation: 180
    })
  ];
}

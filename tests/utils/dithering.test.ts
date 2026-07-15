import { describe, expect, it } from 'vitest';
import { binarizeGrayscale, binarizeToBytes, rgbaToGrayscale } from '../../src/features/pixel-importer/dithering';

describe('pixel importer dithering', () => {
  it('converts RGBA data to grayscale', () => {
    const gray = rgbaToGrayscale(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1);
    expect(gray).toEqual([0, 255]);
  });

  it('binarizes pixels without dithering by threshold', () => {
    const fb = binarizeGrayscale([0, 127, 128, 255], 2, 2, { threshold: 128, dither: false });
    expect(fb).toEqual([[true, true], [false, false]]);
  });

  it('packs a known 8-pixel column into vertical LSB bytes', () => {
    const bytes = binarizeToBytes([0, 255, 0, 255, 0, 255, 0, 255], 1, 8, { threshold: 128, dither: false });
    expect(bytes).toEqual([0b01010101]);
  });
});

import { describe, expect, it } from 'vitest';
import { defaultFontRenderer } from '../../src/renderer/core/fonts';
import { createElementExport, serializeElementHeader, serializeElementManifest } from '../../src/renderer/utils/elementExport';

describe('individual LCD element export', () => {
  it('crops an element to active pixels and keeps its source origin', () => {
    const bundle = createElementExport({
      id: 'status-box', type: 'rect', x: 10, y: 12, width: 4, height: 3, filled: true,
      zIndex: 0, visible: true, locked: false, source: 'user'
    }, { language: 'en', screenWidth: 128, screenHeight: 64, fontRenderer: defaultFontRenderer });

    expect(bundle.origin).toEqual({ x: 10, y: 12 });
    expect([bundle.width, bundle.height]).toEqual([4, 3]);
    expect(Array.from(bundle.bytes)).toEqual([7, 7, 7, 7]);
    expect(serializeElementManifest(bundle)).toContain('"schema": "lcd-element/v1"');
    expect(serializeElementHeader(bundle)).toContain('#define STATUS_BOX_WIDTH 4');
  });

  it('exports every selection independently without retaining canvas offsets', () => {
    const bundle = createElementExport({
      id: 'line-1', type: 'line', x0: 40, y0: 20, x1: 42, y1: 20,
      zIndex: 0, visible: true, locked: false, source: 'user'
    }, { language: 'en', screenWidth: 128, screenHeight: 64, fontRenderer: defaultFontRenderer });

    expect(bundle.frameBuffer).toEqual([[true, true, true]]);
    expect(bundle.origin).toEqual({ x: 40, y: 20 });
  });
});

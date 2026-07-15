import { describe, expect, it } from 'vitest';
import { drawLine, drawRect, packFrameBuffer, renderCanvasObjects, unpackBytesToFrameBuffer } from '../../src/renderer/utils/render';
import type { CanvasObject } from '../../src/renderer/types/domain';
import { createMutableFontGlyphs, FontRenderer, resolveLocalizedBitmapText } from '../../src/renderer/core/fonts';

describe('render utils', () => {
  it('creates a 128x64 framebuffer from canvas objects', () => {
    const frameBuffer = renderCanvasObjects([], { language: 'en' });
    expect(frameBuffer).toHaveLength(64);
    expect(frameBuffer[0]).toHaveLength(128);
  });

  it('draws lines and rectangles with clipping', () => {
    const frameBuffer = renderCanvasObjects([], { language: 'en' });
    drawLine(frameBuffer, -4, 0, 3, 0);
    drawRect(frameBuffer, 126, 62, 8, 8, true);
    expect(frameBuffer[0][0]).toBe(true);
    expect(frameBuffer[0][3]).toBe(true);
    expect(frameBuffer[63][127]).toBe(true);
  });

  it('renders text and bitmap objects', () => {
    const bitmapBytes = new Array(1024).fill(0);
    bitmapBytes[0] = 0b00000001;
    const objects: CanvasObject[] = [
      {
        id: 'text-1',
        type: 'text',
        text: { en: 'A', ru: 'A' },
        x: 4,
        y: 4,
        zIndex: 1,
        visible: true,
        locked: false,
        source: 'user',
        fontVariant: '1',
        pendingTranslation: false
      },
      {
        id: 'bitmap-1',
        type: 'bitmap',
        name: 'imported',
        x: 0,
        y: 0,
        width: 128,
        height: 64,
        bytes: bitmapBytes,
        zIndex: 0,
        visible: true,
        locked: false,
        source: 'user'
      }
    ];

    const frameBuffer = renderCanvasObjects(objects, { language: 'en' });
    expect(frameBuffer[0][0]).toBe(true);
    expect(frameBuffer.some((row) => row.some(Boolean))).toBe(true);
  });

  it('falls back to a renderable localized text when active language glyphs are unavailable', () => {
    const text = { en: 'WARMING', ru: 'ПРОГРЕВ', zh: '预热' };
    expect(resolveLocalizedBitmapText(text, 'zh')).toBe('ПРОГРЕВ');

    const objects: CanvasObject[] = [{
      id: 'text-1',
      type: 'text',
      text,
      x: 0,
      y: 0,
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user',
      fontVariant: '1',
      pendingTranslation: false
    }];

    expect(renderCanvasObjects(objects, { language: 'zh' }))
      .toEqual(renderCanvasObjects(objects, { language: 'ru' }));
  });

  it('uses active localized text when custom glyphs cover that language', () => {
    const fontGlyphs = createMutableFontGlyphs();
    fontGlyphs['1']['测'] = { width: 3, data: ['#..', '.#.', '..#'] };
    fontGlyphs['1']['试'] = { width: 3, data: ['..#', '.#.', '#..'] };
    const fontRenderer = new FontRenderer(fontGlyphs);
    const text = { en: 'TEST', ru: 'ТЕСТ', zh: '测试' };

    expect(resolveLocalizedBitmapText(text, 'zh', fontRenderer, '1')).toBe('测试');
  });

  it('renders special LCD controls', () => {
    const objects: CanvasObject[] = [
      {
        id: 'checkbox-1',
        type: 'special',
        kind: 'checkbox',
        x: 0,
        y: 0,
        width: 8,
        height: 8,
        checked: true,
        value: 100,
        zIndex: 0,
        visible: true,
        locked: false,
        source: 'user'
      },
      {
        id: 'progress-1',
        type: 'special',
        kind: 'progress',
        x: 10,
        y: 0,
        width: 24,
        height: 6,
        checked: false,
        value: 50,
        zIndex: 1,
        visible: true,
        locked: false,
        source: 'user'
      }
    ];

    const frameBuffer = renderCanvasObjects(objects, { language: 'en' });
    expect(frameBuffer[0][0]).toBe(true);
    expect(frameBuffer[2][12]).toBe(true);
  });

  it('renders checkbox special controls from editable glyphs', () => {
    const fontGlyphs = createMutableFontGlyphs();
    fontGlyphs['1']['☑'] = {
      width: 3,
      data: [
        '#..',
        '.#.',
        '..#'
      ]
    };
    const objects: CanvasObject[] = [{
      id: 'checkbox-1',
      type: 'special',
      kind: 'checkbox',
      x: 0,
      y: 0,
      width: 3,
      height: 3,
      checked: true,
      value: 100,
      fontVariant: '1',
      glyphChar: '☑',
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user'
    }];

    const frameBuffer = renderCanvasObjects(objects, {
      language: 'en',
      width: 8,
      height: 8,
      fontRenderer: new FontRenderer(fontGlyphs)
    });
    expect(frameBuffer[0][0]).toBe(true);
    expect(frameBuffer[1][1]).toBe(true);
    expect(frameBuffer[2][2]).toBe(true);
    expect(frameBuffer[0][2]).toBe(false);
  });

  it('renders inverted rows in z-index order', () => {
    const objects: CanvasObject[] = [
      {
        id: 'rect-1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 4,
        height: 4,
        filled: true,
        zIndex: 0,
        visible: true,
        locked: false,
        source: 'user'
      },
      {
        id: 'invert-1',
        type: 'invert',
        x: 0,
        y: 0,
        width: 8,
        height: 2,
        zIndex: 1,
        visible: true,
        locked: false,
        source: 'user'
      }
    ];

    const frameBuffer = renderCanvasObjects(objects, { language: 'en' });
    expect(frameBuffer[0][0]).toBe(false);
    expect(frameBuffer[0][5]).toBe(true);
    expect(frameBuffer[3][0]).toBe(true);
  });

  it('packs and unpacks a screen roundtrip', () => {
    const frameBuffer = renderCanvasObjects([], { language: 'en' });
    drawLine(frameBuffer, 0, 0, 127, 63);
    const bytes = packFrameBuffer(frameBuffer);
    expect(bytes).toHaveLength(1024);
    expect(unpackBytesToFrameBuffer(bytes)).toEqual(frameBuffer);
  });
});

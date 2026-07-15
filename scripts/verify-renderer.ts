import { exportEngine } from '../src/renderer/core/ExportEngine';
import { defaultFontRenderer } from '../src/renderer/core/fonts';
import { drawLine, renderCanvasObjects } from '../src/renderer/core/rendererEngine';
import type { CanvasObject } from '../src/renderer/types/domain';

const textWidth = defaultFontRenderer.measureText('Reference Solution', '1');
assert(textWidth > 0, 'FontRenderer must calculate positive text width');

const bitmask = defaultFontRenderer.renderTextBitmask('File', '1');
assert(bitmask.length > 0, 'FontRenderer must generate bitmask rows');
assert(bitmask[0].length === defaultFontRenderer.measureText('File', '1'), 'Bitmask width must match measured text width');

const objects: CanvasObject[] = [
  {
    id: 'test-text',
    type: 'text',
    text: { en: 'Parameters', ru: 'Параметры' },
    x: 0,
    y: 0,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'generated',
    fontVariant: '1',
    pendingTranslation: false
  },
  {
    id: 'test-line',
    type: 'line',
    x0: 0,
    y0: 63,
    x1: 127,
    y1: 63,
    zIndex: 1,
    visible: true,
    locked: false,
    source: 'generated'
  },
  {
    id: 'test-rect',
    type: 'rect',
    x: 120,
    y: 0,
    width: 8,
    height: 8,
    filled: true,
    zIndex: 2,
    visible: true,
    locked: false,
    source: 'generated'
  }
];

const frameBuffer = renderCanvasObjects(objects, { language: 'en' });
assert(frameBuffer.length === 64, 'FrameBuffer height must be 64');
assert(frameBuffer[0].length === 128, 'FrameBuffer width must be 128');
assert(frameBuffer[63][0] && frameBuffer[63][127], 'Bresenham line must draw endpoints');

const lineFrame = Array.from({ length: 64 }, () => Array.from({ length: 128 }, () => false));
drawLine(lineFrame, 0, 0, 3, 0);
assert(lineFrame[0][0] && lineFrame[0][1] && lineFrame[0][2] && lineFrame[0][3], 'Bresenham horizontal line must draw contiguous pixels');

const bytes = exportEngine.generateBytesFromObjects(objects, 'en');
assert(bytes.length === 1024, 'ExportEngine must generate 1024 bytes');
assert(bytes.every((byte) => byte >= 0 && byte <= 255), 'ExportEngine bytes must be uint8_t compatible');

const cCode = exportEngine.generateCCode(objects, { symbolName: 'screen parameters', language: 'en' });
assert(cCode.includes('static const uint8_t screen_parameters[1024]'), 'C code must include sanitized symbol and 1024 size');

console.log(`Renderer verified: text width=${textWidth}, exported bytes=${bytes.length}.`);

function assert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

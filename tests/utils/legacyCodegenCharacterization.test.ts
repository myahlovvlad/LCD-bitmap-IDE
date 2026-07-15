import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { FontRenderer } from '../../src/renderer/core/fonts';
import {
  generateAllScreensBinary,
  generateAllScreensCHeader,
  generateScreenBinary,
  generateScreenCArray
} from '../../src/renderer/utils/codegen';
import type { CanvasData, CanvasObject } from '../../src/domain';

describe('legacy codegen characterization', () => {
  it('keeps the empty 128x64 export as 1024 zero bytes', () => {
    const bytes = generateScreenBinary([], 'en');

    expect(bytes).toHaveLength(1024);
    expect(Array.from(bytes.slice(0, 16))).toEqual(new Array(16).fill(0));
    expect(sha256(bytes)).toBe('5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef');
  });

  it('keeps current vertical-LSB packing for a diagonal line', () => {
    const bytes = generateScreenBinary([lineObject()], 'en');
    const cArray = generateScreenCArray([lineObject()], { symbolName: 'state one', language: 'en' });

    expect(Array.from(bytes.slice(0, 16))).toEqual([1, 1, 2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64, 64, 128, 128]);
    expect(sha256(bytes)).toBe('3cca193ec3ab3b6d43f6758f253cb3c5128eb50691d32ab098a1447102d732a9');
    expect(cArray).toContain('static const uint8_t state_one[1024]');
    expect(sha256(cArray)).toBe('620740cdebc92109b643d71076912fca7580206ea3cde86f75c6504b0336a957');
  });

  it('keeps current locale selection for text rendering', () => {
    const text = localizedTextObject();

    expect(sha256(generateScreenBinary([text], 'en'))).toBe('9b6887cc46ed051403c57c5ad0d4948232334cdbdbeb17a7f01a9821043bdc32');
    expect(sha256(generateScreenBinary([text], 'ru'))).toBe('27d945fa04e6be20921fae67ac6a2bc12e4da189c884d8d23541fd20dda87132');
    expect(sha256(generateScreenBinary([text], 'zh'))).toBe('9239b45f8c9cfe78c43c38e7275cfeb60f75f38c9561264b0ed5fb9d74e76e1c');
  });

  it('keeps bitmap bytes and custom glyph rendering stable', () => {
    const bitmapBytes = new Array(1024).fill(0);
    bitmapBytes[0] = 1;
    bitmapBytes[129] = 128;
    const bitmap = bitmapObject(bitmapBytes);
    const customFont = new FontRenderer({
      '1': {
        H: { width: 1, data: ['#'] },
        i: { width: 1, data: ['#'] }
      },
      '2': {}
    });

    const bitmapExport = generateScreenBinary([bitmap], 'en');
    expect(bitmapExport[0]).toBe(1);
    expect(bitmapExport[129]).toBe(128);
    expect(sha256(bitmapExport)).toBe('e8964891f216cefc11b54319b0dbf907738922262219ae07112a00cc7f5549f4');
    expect(sha256(generateScreenBinary([textObject('Hi')], 'en', customFont)))
      .toBe('b2c136f7b07dc4e360a10aea2846b17e1fa231e323bb16a6cc0df3949691c663');
  });

  it('keeps all-screen order, current symbols and collision behavior', () => {
    const canvases = [
      canvas('state-a', [lineObject()]),
      canvas('state-b', [localizedTextObject()])
    ];
    const header = generateAllScreensCHeader(canvases, { projectSymbolName: 'project demo', language: 'en' });
    const binary = generateAllScreensBinary(canvases, 'en');
    const collisionHeader = generateAllScreensCHeader([
      canvas('state-a', []),
      canvas('state_a', [])
    ], { projectSymbolName: 'project', language: 'en' });

    expect(header.indexOf('project_demo_state_a_screen')).toBeLessThan(header.indexOf('project_demo_state_b_screen'));
    expect(binary).toHaveLength(2048);
    expect(sha256(header)).toBe('72c5f63eadcbf38d56ddc677cf9fe105a3e0856c1186e466971223b733336eb3');
    expect(sha256(binary)).toBe('6cd80530ee014fae5423bdf1e47c8c7b7710f53b6c987cbbc1c931fc7e00ec87');
    expect(collisionHeader.match(/project_state_a_screen/g)).toHaveLength(4);
    expect(sha256(collisionHeader)).toBe('cf388f12737de1b72a50485f1f94b0485975278ac72ae4204a42eedcad9abc36');
  });

  it('keeps bundled demo all-screen C and binary output stable', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const canvases = project.screenOrder.map((screenId) => {
      const screen = project.screens[screenId];
      return canvas(screenId, screen.objects, screen.width, screen.height, screen.updatedAt);
    });

    expect(canvases.map((item) => item.stateId)).toEqual(['main-menu', 'measure', 'save-result', 'error', 'glyph-test']);
    expect(sha256(generateAllScreensCHeader(canvases, { projectSymbolName: project.meta.name, language: 'en' })))
      .toBe('e4a0e438722eef9c9cb55f8d53225c349d105e3adb54a7609731fa2f6c658ddf');
    expect(sha256(generateAllScreensBinary(canvases, 'en')))
      .toBe('569ee26f0a4b5eb569e176b8b5208d1aeeea62880998608247b6318b5ae5fd49');
  });
});

function sha256(value: string | Uint8Array | readonly number[]): string {
  const bytes = typeof value === 'string' ? value : Buffer.from(value);
  return createHash('sha256').update(bytes).digest('hex');
}

function canvas(
  stateId: string,
  objects: CanvasObject[],
  width = 128,
  height = 64,
  updatedAt = '2026-06-24T00:00:00.000Z'
): CanvasData {
  return { stateId, width, height, objects, selectedObjectIds: [], updatedAt };
}

function lineObject(): CanvasObject {
  return {
    id: 'line-1',
    type: 'line',
    x0: 0,
    y0: 0,
    x1: 127,
    y1: 63,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function localizedTextObject(): CanvasObject {
  return {
    id: 'text-localized',
    type: 'text',
    x: 0,
    y: 0,
    text: { en: '12', ru: '34', zh: '56' },
    fontVariant: '1',
    pendingTranslation: false,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

function textObject(text: string): CanvasObject {
  return {
    ...localizedTextObject(),
    id: `text-${text}`,
    text: { en: text, ru: text, zh: text }
  };
}

function bitmapObject(bytes: number[]): CanvasObject {
  return {
    id: 'bitmap-1',
    type: 'bitmap',
    name: 'Logo',
    x: 0,
    y: 0,
    width: 128,
    height: 64,
    bytes,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

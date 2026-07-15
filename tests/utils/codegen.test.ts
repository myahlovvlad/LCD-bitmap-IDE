import { describe, expect, it } from 'vitest';
import {
  generateAllScreensBinary,
  generateAllScreensCHeader,
  generateScreenBinary,
  generateScreenCArray,
  parseCHeaderScreenArrays,
  sanitizeSymbolName
} from '../../src/renderer/utils/codegen';
import type { CanvasData, CanvasObject } from '../../src/renderer/types/domain';
import { ExportEngine } from '../../src/renderer/core/ExportEngine';

const objects: CanvasObject[] = [
  {
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
  }
];

describe('codegen utils', () => {
  it('sanitizes C identifiers', () => {
    expect(sanitizeSymbolName('screen parameters')).toBe('screen_parameters');
    expect(sanitizeSymbolName('1-screen')).toBe('_1_screen');
  });

  it('exports a selected screen as a 1024-byte C array and bin', () => {
    const cCode = generateScreenCArray(objects, { symbolName: 'state one', language: 'en' });
    expect(cCode).toContain('static const uint8_t state_one[1024]');
    expect(generateScreenBinary(objects, 'en')).toHaveLength(1024);
  });

  it('exports all screens in state order', () => {
    const canvases: CanvasData[] = [
      makeCanvas('state-a'),
      makeCanvas('state-b')
    ];
    const header = generateAllScreensCHeader(canvases, { projectSymbolName: 'project', language: 'en' });
    expect(header.indexOf('project_state_a_screen')).toBeLessThan(header.indexOf('project_state_b_screen'));
    expect(generateAllScreensBinary(canvases, 'en')).toHaveLength(2048);
  });

  it('imports C header literals in hex, decimal, and binary forms', () => {
    const values = ['0x01', '2', '0b00000011', ...new Array(1021).fill('0x00')];
    const arrays = parseCHeaderScreenArrays(`static const uint8_t imported_screen[1024] = { ${values.join(', ')} };`);
    expect(arrays[0].bytes.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('reports invalid screen byte counts', () => {
    expect(() => parseCHeaderScreenArrays('static const uint8_t bad[2] = { 0x00, 0x01 };'))
      .toThrow(/1024/);
  });

  it('exposes the complete export engine facade', () => {
    const engine = new ExportEngine();
    const canvases = [makeCanvas('state-a')];
    expect(engine.generateBytesFromObjects(objects, 'en')).toHaveLength(1024);
    expect(engine.generateCCode(objects, { symbolName: 'screen', language: 'en' })).toContain('screen[1024]');
    expect(engine.generateBinary(objects, 'en')).toHaveLength(1024);
    expect(engine.generateAllScreensCHeader(canvases, { projectSymbolName: 'project', language: 'en' }))
      .toContain('PROJECT_SCREEN_COUNT 1');
    expect(engine.generateAllScreensBinary(canvases, 'en')).toHaveLength(1024);
    const packed = engine.packFrameBuffer([[true]]);
    expect(packed).toHaveLength(1024);
    expect(packed[0]).toBe(1);
  });
});

function makeCanvas(stateId: string): CanvasData {
  return {
    stateId,
    width: 128,
    height: 64,
    objects,
    selectedObjectIds: [],
    updatedAt: '2026-05-12T00:00:00.000Z'
  };
}

import { describe, expect, it } from 'vitest';
import { analyzeScreenLayout, canonicalRasterToRgbaBytes } from '../../src/compiler';
import type { NormalizedCanvasObjectIr } from '../../src/compiler/ir/screenIr';

const base = { order: 0, zIndex: 0, visible: true, locked: false, source: 'test', sourcePath: '/test' };

describe('screen layout analysis', () => {
  it('reports clipped, overlap, and minimum-spacing issues with a deterministic overlay', () => {
    const objects = [
      { ...base, id: 'clipped', type: 'rect', x: -1, y: 0, width: 4, height: 4, filled: true },
      { ...base, id: 'overlap', type: 'rect', x: 1, y: 1, width: 4, height: 4, filled: true },
      { ...base, id: 'near', type: 'rect', x: 6, y: 1, width: 2, height: 2, filled: true }
    ] as NormalizedCanvasObjectIr[];
    const input = { id: 'screen', width: 8, height: 8, objects };
    const first = analyzeScreenLayout(input, 'en');
    const second = analyzeScreenLayout(input, 'en');

    expect(first.boundingBoxes).toHaveLength(3);
    expect(first.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['clipped', 'overlap', 'minimum-spacing']));
    expect(canonicalRasterToRgbaBytes(first.overlay)).toEqual(canonicalRasterToRgbaBytes(second.overlay));
  });
});

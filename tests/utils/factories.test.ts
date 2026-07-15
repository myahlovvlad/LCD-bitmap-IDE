import { describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../src/entities/project/factory';
import { cloneScreenObjects, createScreenState } from '../../src/entities/screen/factory';
import type { CanvasObject } from '../../src/renderer/types/domain';

describe('project and screen factories', () => {
  it('creates a sanitized blank project with one initial screen', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const result = createBlankProject({
      name: '<Demo>\u0000',
      firmwareVersion: ' 1.2.3 ',
      author: 'A<script>'
    });

    expect(result.project.id).toBe('lcd-project-1234');
    expect(result.project.name).toBe('Demo');
    expect(result.project.author).toBe('Ascript');
    expect(result.stateOrder).toHaveLength(1);
    expect(result.project.states[result.stateOrder[0]].initial).toBe(true);
    vi.restoreAllMocks();
  });

  it('positions generated screens in the deterministic four-column grid', () => {
    vi.spyOn(Date, 'now').mockReturnValue(50);
    expect(createScreenState(0, '<Main>').layout).toEqual({ x: 80, y: 80 });
    expect(createScreenState(5).layout).toEqual({ x: 270, y: 200 });
    expect(createScreenState(5).state.initial).toBe(false);
    vi.restoreAllMocks();
  });

  it('deep-clones objects and rewrites IDs and z-indexes', () => {
    const objects: CanvasObject[] = [{
      id: 'source',
      type: 'text',
      text: { en: 'A', ru: 'А' },
      x: 1,
      y: 2,
      fontVariant: '1',
      pendingTranslation: false,
      zIndex: 8,
      visible: true,
      locked: false,
      source: 'user'
    }];

    const cloned = cloneScreenObjects(objects, 'copy');
    expect(cloned[0].id).toBe('canvas-copy-text-1');
    expect(cloned[0].zIndex).toBe(0);
    expect(cloned[0]).not.toBe(objects[0]);
    if (cloned[0].type === 'text' && objects[0].type === 'text') {
      cloned[0].text.en = 'B';
      expect(objects[0].text.en).toBe('A');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { PROJECT_SCHEMA_VERSION } from '../../src/domain/project';
import {
  fingerprintScreenInterchange,
  projectToScreenInterchange,
  screenInterchangeToLcdScreens,
  screenToScreenInterchangePackage,
  serializeScreenInterchange,
  validateScreenInterchange
} from '../../src/screen-interchange';
import type { CanvasObject, LcdBitmapProject } from '../../src/domain';

describe('screen interchange model v1', () => {
  it('exports a renderer-independent project package preserving current schema version', () => {
    const project = demoProject();
    const packageV1 = projectToScreenInterchange(project);
    const validation = validateScreenInterchange(packageV1);

    expect(packageV1.kind).toBe('lcd-bitmap-screen-interchange');
    expect(packageV1.version).toBe(1);
    expect(packageV1.project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(packageV1.project.screenOrder).toEqual(project.screenOrder);
    expect(packageV1.screens.map((screen) => screen.id)).toEqual(project.screenOrder);
    expect(validation).toEqual({ ok: true, issues: [] });
  });

  it('keeps authoring equality separate from selected-object UI state', () => {
    const project = demoProject();
    const packageV1 = projectToScreenInterchange(project);
    const mainMenu = packageV1.screens[0];

    expect(mainMenu.objectOrder).toEqual(project.screens['main-menu'].objects.map((object) => object.id));
    expect(mainMenu.objects.map((object) => object.id)).toEqual(mainMenu.objectOrder);
    expect(mainMenu).not.toHaveProperty('selectedObjectIds');
    expect(packageV1.traceability.screens['main-menu'].selectedObjectIds).toEqual([]);
  });

  it('extracts bitmap and glyph override resources and reconstructs screen objects losslessly', () => {
    const project = demoProject();
    project.screens['main-menu'] = {
      ...project.screens['main-menu'],
      selectedObjectIds: ['bitmap-1'],
      objects: richObjects()
    };
    const packageV1 = screenToScreenInterchangePackage(project, 'main-menu');
    const screen = packageV1.screens[0];
    const bitmap = screen.objects.find((object) => object.type === 'bitmap');
    const special = screen.objects.find((object) => object.type === 'special');
    const reconstructed = screenInterchangeToLcdScreens(packageV1);

    expect(bitmap?.resourceRefs).toEqual(['bitmap:main-menu:bitmap-1']);
    expect(special?.resourceRefs).toContain('glyph:main-menu:special-1:override');
    expect(Object.keys(packageV1.resources.bitmaps)).toEqual(['bitmap:main-menu:bitmap-1']);
    expect(Object.keys(packageV1.resources.glyphs)).toEqual(['glyph:main-menu:special-1:override']);
    expect(reconstructed['main-menu'].objects).toEqual(project.screens['main-menu'].objects);
    expect(reconstructed['main-menu'].selectedObjectIds).toEqual(['bitmap-1']);
  });

  it('produces stable canonical serialization and fingerprint independent of resource object key order', () => {
    const project = demoProject();
    project.screens['main-menu'] = { ...project.screens['main-menu'], objects: richObjects() };
    const first = screenToScreenInterchangePackage(project, 'main-menu');
    const second = {
      ...first,
      resources: {
        ...first.resources,
        bitmaps: Object.fromEntries(Object.entries(first.resources.bitmaps).reverse())
      }
    };

    expect(serializeScreenInterchange(first)).toBe(serializeScreenInterchange(second));
    expect(fingerprintScreenInterchange(first)).toMatch(/^simv1-[0-9a-f]{16}$/);
    expect(fingerprintScreenInterchange(first)).toBe(fingerprintScreenInterchange(second));
  });
});

function demoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

function richObjects(): CanvasObject[] {
  return [
    {
      id: 'text-1',
      type: 'text',
      text: { en: 'Menu', ru: 'Menu', zh: 'Menu' },
      x: 1,
      y: 2,
      fontVariant: '1',
      pendingTranslation: false,
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'line-1',
      type: 'line',
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
      zIndex: 1,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'rect-1',
      type: 'rect',
      x: 3,
      y: 4,
      width: 12,
      height: 6,
      filled: true,
      zIndex: 2,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'icon-1',
      type: 'icon',
      iconId: 'settings',
      x: 5,
      y: 6,
      width: 8,
      height: 8,
      zIndex: 3,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'bitmap-1',
      type: 'bitmap',
      name: 'Logo',
      x: 7,
      y: 8,
      width: 4,
      height: 4,
      bytes: [0xff, 0x00, 0xff, 0x00],
      zIndex: 4,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'special-1',
      type: 'special',
      kind: 'checkbox',
      x: 9,
      y: 10,
      width: 8,
      height: 8,
      checked: true,
      value: 100,
      fontVariant: '1',
      glyphChar: 'x',
      glyphOverride: { width: 3, data: ['#..', '.#.', '..#'], topOffset: 1, nominalHeight: 3 },
      zIndex: 5,
      visible: true,
      locked: false,
      source: 'user'
    },
    {
      id: 'invert-1',
      type: 'invert',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      zIndex: 6,
      visible: true,
      locked: false,
      source: 'user'
    }
  ];
}

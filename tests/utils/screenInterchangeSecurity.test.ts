import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { projectToScreenInterchange, validateScreenInterchange } from '../../src/screen-interchange';

describe('screen interchange validation security', () => {
  it('rejects missing resource references instead of reconstructing implicit data', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.screens['main-menu'].objects.push({
      id: 'bitmap-1',
      type: 'bitmap',
      name: 'Logo',
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      bytes: [1, 2],
      zIndex: 10,
      visible: true,
      locked: false,
      source: 'user'
    });
    const packageV1 = projectToScreenInterchange(project, { screenIds: ['main-menu'] });
    delete packageV1.resources.bitmaps['bitmap:main-menu:bitmap-1'];

    const validation = validateScreenInterchange(packageV1);

    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.path.endsWith('bitmapRef'))).toBe(true);
  });

  it('rejects unsupported display packing and invalid dimensions', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const packageV1 = projectToScreenInterchange(project, { screenIds: ['main-menu'] });
    packageV1.screens[0] = {
      ...packageV1.screens[0],
      display: { width: 0, height: 64, colorMode: 'monochrome', packing: 'horizontal-msb' as never }
    };

    const validation = validateScreenInterchange(packageV1);

    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.path)).toContain('screens.main-menu.display.width');
    expect(validation.issues.map((issue) => issue.path)).toContain('screens.main-menu.display.packing');
  });

  it('rejects object order references that do not match the screen object list', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const packageV1 = projectToScreenInterchange(project, { screenIds: ['main-menu'] });
    packageV1.screens[0] = {
      ...packageV1.screens[0],
      objectOrder: ['missing-object']
    };

    const validation = validateScreenInterchange(packageV1);

    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes('Object order'))).toBe(true);
  });
});

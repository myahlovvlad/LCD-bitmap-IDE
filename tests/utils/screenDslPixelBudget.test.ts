import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { projectToScreenInterchange } from '../../src/screen-interchange';
import { screenInterchangeToDslDocument, validateScreenDslPixelBudget } from '../../src/screen-dsl';

describe('Screen DSL pixel budget', () => {
  it('keeps 128x64 vertical page budget at 1024 bytes', () => {
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] }));
    const screen = document.screens[0];

    expect(Math.ceil(screen.display.height / 8) * screen.display.width).toBe(1024);
    expect(validateScreenDslPixelBudget(document).ok).toBe(true);
  });

  it('diagnoses missing glyph coverage and out-of-bounds geometry without correcting layout', () => {
    const document = screenInterchangeToDslDocument(projectToScreenInterchange(demoProject(), { screenIds: ['main-menu'] }));
    const object = document.screens[0].objects[0];
    const result = validateScreenDslPixelBudget({
      ...document,
      screens: [{
        ...document.screens[0],
        objects: [{
          ...object,
          x: 999,
          text: object.kind === 'text' ? { ...object.text, en: '预热' } : undefined
        } as typeof object]
      }]
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_OBJECT_OUT_OF_BOUNDS');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('SCREEN_DSL_MISSING_GLYPH');
  });
});

function demoProject() {
  return migrateLegacySnapshot(createDemoProject()).project;
}

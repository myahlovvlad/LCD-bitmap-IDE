import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { createLcdProjectPayload, createProjectPayload, readProjectPayload } from '../../src/renderer/core/projectInterop';
import { createMutableFontGlyphs } from '../../src/renderer/core/fonts';
import { lcdProjectSchema, projectFilePayloadSchema } from '../../src/entities/project/schema';

describe('project schemas', () => {
  it('validates SpectroDesigner v4 project payloads', () => {
    const demo = createDemoProject();
    const payload = createProjectPayload({
      ...demo,
      fontGlyphs: createMutableFontGlyphs(),
      loadedFonts: [],
      savedMeasurements: [],
      language: 'en'
    });

    expect(projectFilePayloadSchema.safeParse(payload).success).toBe(true);
    expect(readProjectPayload(payload)?.stateOrder).toEqual(demo.stateOrder);
  });

  it('validates portable lcdproj payloads', () => {
    const demo = createDemoProject();
    const payload = createLcdProjectPayload({
      project: demo.project,
      stateOrder: demo.stateOrder,
      transitionOrder: demo.transitionOrder,
      fontGlyphs: createMutableFontGlyphs()
    });

    expect(lcdProjectSchema.safeParse(payload).success).toBe(true);
    expect(readProjectPayload(payload)?.project.name).toBe(demo.project.name);
  });

  it('rejects invalid project imports', () => {
    expect(readProjectPayload({ formatVersion: '1.0', screens: [] })).toBeNull();
  });
});

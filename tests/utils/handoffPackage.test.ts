import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { buildHandoffPackage } from '../../src/features/hmi-handoff/handoffPackage';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('HMI handoff package', () => {
  it('exports deterministic firmware variants, formulas, registry and manifest', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const result = await buildHandoffPackage(project, undefined, new Date('2026-07-29T00:00:00.000Z'));
    const archive = unzipSync(result.zip);

    expect(result.filename).toMatch(/hmi-handoff\.zip$/);
    expect(Object.keys(archive)).toContain('manifest.json');
    expect(Object.keys(archive)).toContain('handoff/dynamic_fields.csv');
    expect(Object.keys(archive)).toContain('handoff/text_registry.csv');
    expect(Object.keys(archive)).toContain('firmware/common/hmi_formulas.c');
    expect(Object.keys(archive).some((path) => path.endsWith('.bin'))).toBe(true);
    expect(Object.keys(archive).some((path) => path.endsWith('.xbm'))).toBe(true);
    expect(Object.keys(archive).some((path) => path.endsWith('.rs'))).toBe(true);

    const manifest = JSON.parse(strFromU8(archive['manifest.json']));
    expect(manifest.project.display).toBe('128x64 monochrome 1bpp');
    expect(manifest.project.languages).toEqual(['ru', 'en', 'zh']);
    expect(manifest.files.every((file: { sha256: string }) => Boolean(file.sha256))).toBe(true);

    const formulas = strFromU8(archive['firmware/common/hmi_formulas.c']);
    expect(formulas).toContain('hmi_calculate_absorbance');
    expect(formulas).toContain('isfinite');
  });
});

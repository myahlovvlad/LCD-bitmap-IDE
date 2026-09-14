import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_CONFIG,
  PROJECT_SCHEMA_VERSION,
  createDisplayProfile,
  exportDisplayProfile,
  importDisplayProfile,
  normalizeDisplayProfile,
  validateDisplayProfile
} from '../../src/domain';
import { migrateProject } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('DisplayProfile schema v7', () => {
  it('migrates a schema-v6 legacy display and adds a stable fingerprint', () => {
    const project = structuredClone(migrateLegacySnapshot(createDemoProject()).project) as unknown as Record<string, any>;
    project.meta.schemaVersion = 6;
    project.display = { width: 128, height: 64, colorMode: 'monochrome', packing: 'vertical-lsb' };
    const migrated = migrateProject({ kind: 'lcd-bitmap-project', version: 6, savedAt: '2026-08-16T00:00:00.000Z', language: 'en', project });

    expect(migrated.project.meta.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.project.display).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(validateDisplayProfile(migrated.project.display)).toEqual([]);
  });

  it('changes the fingerprint when an encoding field changes', () => {
    const changed = createDisplayProfile({ ...DEFAULT_DISPLAY_CONFIG, mirrorX: true });
    expect(changed.fingerprint).not.toBe(DEFAULT_DISPLAY_CONFIG.fingerprint);
    expect(normalizeDisplayProfile(changed)).toEqual(changed);
  });

  it('imports and exports a fingerprint-checked canonical profile', () => {
    const serialized = exportDisplayProfile(DEFAULT_DISPLAY_CONFIG);
    expect(importDisplayProfile(serialized)).toEqual(DEFAULT_DISPLAY_CONFIG);
    const tampered = serialized.replace('"width": 128', '"width": 129');
    expect(() => importDisplayProfile(tampered)).toThrow(/fingerprint/i);
  });

  it('reports incompatible format/packing combinations', () => {
    const invalid = { ...DEFAULT_DISPLAY_CONFIG, pixelFormat: 'rgb565', bitsPerPixel: 16 } as typeof DEFAULT_DISPLAY_CONFIG;
    expect(validateDisplayProfile(invalid).map((item) => item.code)).toContain('vertical-pages-contract');
  });
});

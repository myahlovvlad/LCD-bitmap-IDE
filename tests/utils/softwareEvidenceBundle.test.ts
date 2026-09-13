import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { createSoftwareEvidenceBundle } from '../../src/compiler';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('software evidence bundle', () => {
  it('proves a deterministic zero-diff 128x64 encode/decode round trip', () => {
    const snapshot = migrateLegacySnapshot(createDemoProject());
    const input = {
      project: snapshot.project,
      language: 'en' as const,
      screenId: snapshot.project.screenOrder[0],
      fontGlyphs: snapshot.fontGlyphs,
      toolVersions: { 'lcd-bitmap-ide': 'test', vitest: '3' }
    };
    const first = createSoftwareEvidenceBundle(input);
    const second = createSoftwareEvidenceBundle(input);

    expect(first.comparison).toEqual(expect.objectContaining({
      expectedWidth: 128,
      expectedHeight: 64,
      differentPixels: 0,
      maximumDifference: 0,
      result: 'passed'
    }));
    expect(first.comparison.expectedHash).toBe(first.comparison.decodedHash);
    expect(first.artifacts.map((artifact) => artifact.path)).toEqual([
      'manifest.json', 'display-profile.json', 'project-fingerprint.json',
      'canonical-framebuffer.bin', 'canonical-preview.png', 'generated-screen.h',
      'generated-screen.bin', 'decoded-framebuffer.bin', 'decoded-preview.png',
      'pixel-diff.png', 'comparison.json', 'tool-versions.json', 'operations.log'
    ]);
    expect(first.artifacts.map((artifact) => artifact.sha256)).toEqual(second.artifacts.map((artifact) => artifact.sha256));
    expect(first.zip).toEqual(second.zip);
    const files = unzipSync(first.zip);
    expect(Object.keys(files).sort()).toEqual(first.artifacts.map((artifact) => artifact.path).sort());
    expect(files['canonical-preview.png'].slice(0, 8)).toEqual(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});

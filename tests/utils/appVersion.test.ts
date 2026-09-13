import { describe, expect, it } from 'vitest';
import { normalizeAppSoftwareVersion } from '../../src/renderer/config/constants';

describe('application software version', () => {
  it('keeps a valid package version for the renderer badge', () => {
    expect(normalizeAppSoftwareVersion('0.1.18')).toBe('0.1.18');
  });

  it('uses the explicit development fallback for absent or malformed build metadata', () => {
    expect(normalizeAppSoftwareVersion(undefined)).toBe('dev');
    expect(normalizeAppSoftwareVersion('not-a-version')).toBe('dev');
  });
});

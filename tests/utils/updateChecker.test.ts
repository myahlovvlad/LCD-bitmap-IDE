import { describe, expect, it } from 'vitest';
import { checkForUpdate, compareVersions } from '../../src/renderer/utils/updateChecker';

describe('update checker', () => {
  it('compares stable and prerelease semantic versions', () => {
    expect(compareVersions('0.1.21', '0.1.20')).toBeGreaterThan(0);
    expect(compareVersions('0.1.20', '0.1.20')).toBe(0);
    expect(compareVersions('0.1.20-beta.1', '0.1.20')).toBeLessThan(0);
  });

  it('only returns a newer GitHub release', async () => {
    const request = async () => new Response(JSON.stringify({ tag_name: 'v0.1.21', html_url: 'https://example.test/release' }), { status: 200 });
    await expect(checkForUpdate('0.1.20', request as typeof fetch)).resolves.toMatchObject({ version: '0.1.21' });
    await expect(checkForUpdate('0.1.21', request as typeof fetch)).resolves.toBeNull();
  });
});

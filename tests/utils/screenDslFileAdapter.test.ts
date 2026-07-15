import { describe, expect, it } from 'vitest';
import { ElectronScreenDslFileAdapter } from '../../src/features/screen-dsl-studio/screenDslFileAdapter';

describe('Screen DSL file adapter boundary', () => {
  it('returns a stable diagnostic when preload file API is unavailable', async () => {
    const adapter = new ElectronScreenDslFileAdapter();

    await expect(adapter.open()).resolves.toMatchObject({
      cancelled: false,
      diagnostics: [{ code: 'SCREEN_DSL_FILE_INTERNAL_ERROR' }]
    });
    await expect(adapter.save({
      format: 'json',
      operation: 'canonical-export',
      suggestedFilename: 'screen.lcdscreen.json',
      content: '{}'
    })).resolves.toMatchObject({
      cancelled: false,
      diagnostics: [{ code: 'SCREEN_DSL_FILE_INTERNAL_ERROR' }]
    });
  });
});

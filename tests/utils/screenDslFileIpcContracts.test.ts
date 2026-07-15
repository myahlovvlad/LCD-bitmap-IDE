import { describe, expect, it } from 'vitest';
import {
  SCREEN_DSL_FILE_OPEN_CHANNEL,
  SCREEN_DSL_FILE_SAVE_CHANNEL
} from '../../src/shared/screenDslFiles/channels';
import type {
  OpenScreenDslFileResult,
  SaveScreenDslFileRequest,
  SaveScreenDslFileResult
} from '../../src/shared/screenDslFiles/contracts';

describe('Screen DSL file IPC contracts', () => {
  it('uses explicit static channel names', () => {
    expect(SCREEN_DSL_FILE_OPEN_CHANNEL).toBe('screen-dsl:file:open');
    expect(SCREEN_DSL_FILE_SAVE_CHANNEL).toBe('screen-dsl:file:save');
  });

  it('does not require renderer-provided paths in open/save contracts', () => {
    const openResult: OpenScreenDslFileResult = {
      cancelled: false,
      format: 'yaml',
      filename: 'screen.lcdscreen.yaml',
      content: 'format: lcd-bitmap-ide/screen',
      byteLength: 29
    };
    const saveRequest: SaveScreenDslFileRequest = {
      format: 'yaml',
      operation: 'canonical-export',
      suggestedFilename: 'screen.lcdscreen.yaml',
      content: openResult.content ?? ''
    };
    const saveResult: SaveScreenDslFileResult = {
      cancelled: false,
      filename: 'screen.lcdscreen.yaml',
      byteLength: 29
    };

    expect(Object.keys(openResult)).not.toContain('path');
    expect(Object.keys(saveRequest)).not.toContain('path');
    expect(Object.keys(saveResult)).not.toContain('path');
  });
});

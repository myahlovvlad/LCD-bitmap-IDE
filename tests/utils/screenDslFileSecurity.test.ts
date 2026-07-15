import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dialog } from 'electron';
import { handleScreenDslFileOpen } from '../../src/main/screenDslFiles/openHandler';
import { handleScreenDslFileSave } from '../../src/main/screenDslFiles/saveHandler';

vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  }
}));

const showOpenDialog = vi.mocked(dialog.showOpenDialog);
const showSaveDialog = vi.mocked(dialog.showSaveDialog);

describe('Screen DSL file main-process security handlers', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lcd-screen-dsl-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('open reads only a dialog-selected file and returns basename only', async () => {
    const filePath = path.join(tempDir, 'diagnostics.lcdscreen.yaml');
    await writeFile(filePath, 'format: lcd-bitmap-ide/screen\n', 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });

    const result = await handleScreenDslFileOpen(dialog);

    expect(result).toMatchObject({
      cancelled: false,
      format: 'yaml',
      filename: 'diagnostics.lcdscreen.yaml',
      content: 'format: lcd-bitmap-ide/screen\n'
    });
    expect(result.filename).not.toContain(tempDir);
  });

  it('open cancellation is not an error', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    await expect(handleScreenDslFileOpen(dialog)).resolves.toEqual({ cancelled: true });
  });

  it('open rejects unsupported extensions before returning content', async () => {
    const filePath = path.join(tempDir, 'diagnostics.lcdscreen.yaml.exe');
    await writeFile(filePath, 'format: lcd-bitmap-ide/screen\n', 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });

    const result = await handleScreenDslFileOpen(dialog);

    expect(result.cancelled).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.diagnostics?.[0].code).toBe('SCREEN_DSL_FILE_UNSUPPORTED_EXTENSION');
  });

  it('save rejects malformed IPC payload before opening a dialog', async () => {
    const result = await handleScreenDslFileSave(dialog, {
      format: 'yaml',
      operation: 'canonical-export',
      suggestedFilename: 'screen.lcdscreen.yaml',
      content: 'format: lcd-bitmap-ide/screen\n',
      path: path.join(tempDir, 'attacker.lcdscreen.yaml')
    });

    expect(result.diagnostics?.[0].code).toBe('SCREEN_DSL_FILE_INVALID_IPC_PAYLOAD');
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it('save appends missing canonical extension and writes UTF-8 atomically', async () => {
    const targetWithoutExtension = path.join(tempDir, 'diagnostics');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: targetWithoutExtension });

    const result = await handleScreenDslFileSave(dialog, {
      format: 'json',
      operation: 'canonical-export',
      suggestedFilename: 'diagnostics',
      content: '{"format":"lcd-bitmap-ide/screen"}\n'
    });

    const finalPath = path.join(tempDir, 'diagnostics.lcdscreen.json');
    expect(result).toMatchObject({
      cancelled: false,
      filename: 'diagnostics.lcdscreen.json'
    });
    await expect(readFile(finalPath, 'utf8')).resolves.toBe('{"format":"lcd-bitmap-ide/screen"}\n');
  });

  it('save rejects mismatched explicit extension', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(tempDir, 'diagnostics.lcdscreen.json') });

    const result = await handleScreenDslFileSave(dialog, {
      format: 'yaml',
      operation: 'canonical-export',
      suggestedFilename: 'diagnostics.lcdscreen.yaml',
      content: 'format: lcd-bitmap-ide/screen\n'
    });

    expect(result.diagnostics?.[0].code).toBe('SCREEN_DSL_FILE_FORMAT_EXTENSION_MISMATCH');
  });
});

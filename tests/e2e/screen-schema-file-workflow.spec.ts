import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { ScreenSchemaStudioPage } from './pages/ScreenSchemaStudioPage';

const YAML_FIXTURE = `format: lcd-bitmap-ide/screen
version: 1
screens:
  - id: splash
    width: 128
    height: 64
    pixels: []
`;

const JSON_FIXTURE = JSON.stringify({
  format: 'lcd-bitmap-ide/screen',
  version: 1,
  screens: [{ id: 'splash', width: 128, height: 64, pixels: [] }]
}, null, 2) + '\n';

test.describe('Screen Schema file workflow — browser adapter', () => {
  test('open a YAML file loads content into the editor without auto-preview', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.injectOpenMock({
      cancelled: false,
      format: 'yaml',
      filename: 'splash.lcdscreen.yaml',
      content: YAML_FIXTURE,
      byteLength: YAML_FIXTURE.length
    });
    await studio.clickOpenFile();

    // Content is loaded — no auto-preview, no auto-apply
    await expect(page.getByTestId('screen-dsl-source-yaml')).toHaveValue(YAML_FIXTURE);
    await studio.expectStatus(/File loaded into YAML session/);
    // Preview tab shows no pending preview — user must trigger it explicitly
    await expect(page.getByTestId('screen-dsl-doc-status')).toContainText(/draft|initial/i);
  });

  test('open a JSON file switches to JSON tab and loads content', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.injectOpenMock({
      cancelled: false,
      format: 'json',
      filename: 'splash.lcdscreen.json',
      content: JSON_FIXTURE,
      byteLength: JSON_FIXTURE.length
    });
    await studio.clickOpenFile();

    await expect(page.getByTestId('screen-dsl-source-json')).toHaveValue(JSON_FIXTURE);
    await studio.expectStatus(/File loaded into JSON session/);
  });

  test('cancelling open returns to idle without changing editor', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    const originalText = await studio.sourceText('json');

    await studio.injectOpenMock({ cancelled: true });
    await studio.clickOpenFile();

    await studio.expectStatus(/Open cancelled/);
    expect(await studio.sourceText('json')).toBe(originalText);
  });

  test('opening a file when draft is dirty shows replacement confirmation dialog', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    // Write something to make the session dirty
    await studio.setSourceText('json', '{ "format": "lcd-bitmap-ide/screen", "dirty": true }');

    await studio.injectOpenMock({
      cancelled: false,
      format: 'json',
      filename: 'new-file.lcdscreen.json',
      content: JSON_FIXTURE,
      byteLength: JSON_FIXTURE.length
    });
    await studio.clickOpenFile();

    await studio.expectReplaceDialogVisible();
  });

  test('confirming dirty replacement loads new content', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.setSourceText('json', '{ "format": "lcd-bitmap-ide/screen", "dirty": true }');

    await studio.injectOpenMock({
      cancelled: false,
      format: 'json',
      filename: 'new-file.lcdscreen.json',
      content: JSON_FIXTURE,
      byteLength: JSON_FIXTURE.length
    });
    await studio.clickOpenFile();
    await studio.expectReplaceDialogVisible();
    await studio.confirmReplacement();

    await expect(page.getByTestId('screen-dsl-source-json')).toHaveValue(JSON_FIXTURE);
    await studio.expectStatus(/File loaded into JSON session/);
  });

  test('cancelling dirty replacement preserves the draft', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    const dirtyText = '{ "format": "lcd-bitmap-ide/screen", "keep": "me" }';
    await studio.setSourceText('json', dirtyText);

    await studio.injectOpenMock({
      cancelled: false,
      format: 'json',
      filename: 'new-file.lcdscreen.json',
      content: JSON_FIXTURE,
      byteLength: JSON_FIXTURE.length
    });
    await studio.clickOpenFile();
    await studio.expectReplaceDialogVisible();
    await studio.cancelReplacement();

    await studio.expectStatus(/Open cancelled. Draft preserved/);
    expect(await studio.sourceText('json')).toBe(dirtyText);
  });

  test('export canonical calls save adapter with format and content', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.injectSaveMock({
      cancelled: false,
      filename: 'screens.lcdscreen.yaml',
      byteLength: 42
    });
    await studio.clickExport();

    await studio.expectStatus(/Exported \d+ bytes to/);
  });

  test('export canonical cancelled returns to idle gracefully', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.injectSaveMock({ cancelled: true });
    await studio.clickExport();

    await studio.expectStatus(/Export cancelled/);
  });

  test('file open error shows diagnostic code in status', async ({ page }) => {
    const app = new AppShellPage(page);
    const studio = new ScreenSchemaStudioPage(page);

    await app.openDemo();
    await app.openLcdWorkspace();
    await studio.open();

    await studio.injectOpenMock({
      cancelled: false,
      diagnostics: [{
        code: 'SCREEN_DSL_FILE_INVALID_UTF8',
        severity: 'error',
        message: 'File contains invalid UTF-8 sequences.'
      }]
    });
    await studio.clickOpenFile();

    await studio.expectStatus(/SCREEN_DSL_FILE_INVALID_UTF8/);
  });
});

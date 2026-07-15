import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Script Studio marks destructive changes and applies them atomically', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  const original = await scripts.sourceText('mermaid');
  const withoutGlyphTest = original
    .split('\n')
    .filter((line) => !line.includes('glyph-test'))
    .join('\n');

  await scripts.setScriptText('mermaid', withoutGlyphTest);
  await scripts.requestPreview('mermaid');
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.delete', 'glyph-test');
  await scripts.expectDestructiveChange();

  await scripts.applyPreview('mermaid');
  await fsm.expectStateAbsent('glyph-test');
  await app.undo();
  await fsm.expectStateTitle('glyph-test', 'Glyph Test Screen');
  await app.redo();
  await fsm.expectStateAbsent('glyph-test');
  await expect(page.getByTestId('app-undo')).toBeEnabled();
});

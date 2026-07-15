import { test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Script Studio disables Apply when a preview becomes stale', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  const source = (await scripts.sourceText('mermaid')).replace('title="Measurement"', 'title="Measure Stale"');
  await scripts.setScriptText('mermaid', source);
  await scripts.requestPreview('mermaid');
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.update', 'measure');

  await page.getByTestId('fsm-add-state').click();
  await scripts.expectStalePreview();
  await scripts.expectApplyDisabled('mermaid');
});

import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('dirty script is preserved and marked stale when the graph changes', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();
  await scripts.setAutoPreview('mermaid', false);

  const draft = (await scripts.sourceText('mermaid')).replace('title="Measurement"', 'title="Dirty Draft"');
  await scripts.setScriptText('mermaid', draft);
  await page.getByTestId('fsm-add-state').click();

  await scripts.expectStalePreview();
  await scripts.expectDocumentState('mermaid', /stale.*dirty/);
  await scripts.expectApplyDisabled('mermaid');
  await expect(scripts.source('mermaid')).toHaveValue(/Dirty Draft/);

  await scripts.requestPreview('mermaid');
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.update', 'measure');
});

test('clean script refreshes safely after a graph change', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  const original = await scripts.sourceText('mermaid');
  await page.getByTestId('fsm-add-state').click();

  await scripts.expectDocumentState('mermaid', /clean/);
  await expect.poll(async () => await scripts.sourceText('mermaid')).not.toBe(original);
});

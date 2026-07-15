import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('workspace switch preserves an in-memory dirty script draft', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();
  await scripts.setAutoPreview('mermaid', false);

  const draft = (await scripts.sourceText('mermaid')).replace('title="Measurement"', 'title="Workspace Draft"');
  await scripts.setScriptText('mermaid', draft);

  await app.openLcdWorkspace();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  await expect(scripts.source('mermaid')).toHaveValue(/Workspace Draft/);
  await scripts.expectDocumentState('mermaid', /dirty/);
});

import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Mermaid and Python drafts are independent and other format becomes stale after Apply', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();
  await scripts.setAutoPreview('mermaid', false);
  await scripts.setAutoPreview('python', false);

  const mermaidDraft = (await scripts.sourceText('mermaid')).replace('title="Measurement"', 'title="Mermaid Draft"');
  const pythonDraft = (await scripts.sourceText('python')).replace('title="Measurement"', 'title="Python Draft"');
  await scripts.setScriptText('mermaid', mermaidDraft);
  await scripts.setScriptText('python', pythonDraft);

  await expect(scripts.source('mermaid')).toHaveValue(/Mermaid Draft/);
  await expect(scripts.source('python')).toHaveValue(/Python Draft/);

  await scripts.requestPreview('mermaid');
  await scripts.expectPreviewReady();
  await scripts.applyPreview('mermaid');

  await fsm.expectStateTitle('measure', 'Mermaid Draft');
  await expect(scripts.source('python')).toHaveValue(/Python Draft/);
  await scripts.expectDocumentState('python', /stale.*dirty/);
});

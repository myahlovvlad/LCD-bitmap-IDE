import { test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('auto-preview builds a semantic preview but keeps Apply explicit', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  await scripts.setAutoPreview('mermaid', true);
  const source = (await scripts.sourceText('mermaid')).replace('title="Measurement"', 'title="Auto Preview"');
  await scripts.setScriptText('mermaid', source);

  await scripts.expectDocumentState('mermaid', /scheduled|parsing|preview-ready/);
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.update', 'measure');
  await fsm.expectStateTitle('measure', 'Measurement');

  await scripts.applyPreview('mermaid');
  await fsm.expectStateTitle('measure', 'Auto Preview');
});

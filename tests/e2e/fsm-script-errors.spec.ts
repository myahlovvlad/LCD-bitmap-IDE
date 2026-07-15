import { test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Script Studio keeps parser and unsafe syntax errors in preview without Apply', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  await scripts.setScriptText('python', [
    'fsm = FSM(version=1, project_id="unsafe")',
    'exec("print(1)")',
    'this is not valid'
  ].join('\n'));
  await scripts.requestPreview('python');
  await scripts.expectPreviewReady();
  await scripts.expectDiagnostic('fsm.python.blocked-construct');
  await scripts.expectDiagnostic('fsm.python.syntax');
  await scripts.expectApplyDisabled('python');
  await fsm.expectStateTitle('measure', 'Measurement');
});

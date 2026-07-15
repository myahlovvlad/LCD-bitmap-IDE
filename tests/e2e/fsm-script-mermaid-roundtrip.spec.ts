import { expect, test } from '@playwright/test';
import { AppShellPage } from './pages/AppShellPage';
import { FsmScriptStudioPage } from './pages/FsmScriptStudioPage';
import { FsmWorkspacePage } from './pages/FsmWorkspacePage';

test('Mermaid script preview applies explicitly and survives Undo/Redo and autosave reopen', async ({ page }) => {
  const app = new AppShellPage(page);
  const fsm = new FsmWorkspacePage(page);
  const scripts = new FsmScriptStudioPage(page);

  await app.openDemo();
  await app.openFsmWorkspace();
  await fsm.openScriptStudio();

  const original = await scripts.sourceText('mermaid');
  expect(original).toContain('stateDiagram-v2');
  expect(original).toContain('%% lcdide:machine version=1');
  expect(original).toContain('id="measure"');
  expect(original).toContain('%% lcdide:layout state="measure" x=250 y=200');
  await scripts.expectApplyDisabled('mermaid');

  const updated = original
    .replace('title="Measurement"', 'title="Measure Accepted"')
    .replace('state "Measurement" as measure', 'state "Measure Accepted" as measure')
    .replace('%% lcdide:layout state="measure" x=250 y=200 order=1', '%% lcdide:layout state="measure" x=321 y=123 order=1')
    .replace('%% lcdide:event id="ESC" name="ESC" legacy="ESC" order=3', '%% lcdide:event id="ESC" name="ESC" legacy="ESC" order=3\n%% lcdide:event id="RESET" name="RESET" legacy="RESET" order=4')
    .concat('\n%% lcdide:transition id="tr-error-glyph-test" from="error" to="glyph-test" event="RESET" mechanism="event" button=null fact=null sourceHandle="s-right" targetHandle="t-left" kind="navigation" condition=null source="e2e" backend=null order=4\n  error --> glyph-test : RESET');

  await scripts.setScriptText('mermaid', updated);
  await scripts.requestPreview('mermaid');
  await scripts.expectPreviewReady();
  await scripts.expectSemanticChange('state.update', 'measure');
  await scripts.expectSemanticChange('layout.update', 'measure');
  await scripts.expectSemanticChange('event.create', 'RESET');
  await scripts.expectSemanticChange('transition.create', 'tr-error-glyph-test');
  await expect(page.getByTestId('fsm-script-semantic-diff')).not.toContainText('state.delete');
  await expect(page.getByTestId('fsm-script-semantic-diff')).not.toContainText('state.create');

  await scripts.applyPreview('mermaid');
  await fsm.expectStateTitle('measure', 'Measure Accepted');
  await app.undo();
  await fsm.expectStateTitle('measure', 'Measurement');
  await app.redo();
  await fsm.expectStateTitle('measure', 'Measure Accepted');

  await app.waitForAutosaveText('Measure Accepted');
  await app.reloadAutosave();
  await fsm.openScriptStudio();
  await fsm.expectStateTitle('measure', 'Measure Accepted');
  const regenerated = await scripts.sourceText('mermaid');
  expect(regenerated).toContain('id="measure" title="Measure Accepted"');
  expect(regenerated).toContain('%% lcdide:layout state="measure" x=321 y=123 order=1');
  expect(regenerated).toContain('id="tr-error-glyph-test"');
});

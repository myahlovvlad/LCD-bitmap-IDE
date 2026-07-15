import { expect, type Locator, type Page } from '@playwright/test';

export type ScriptFormat = 'mermaid' | 'python';

export class FsmScriptStudioPage {
  constructor(readonly page: Page) {}

  source(format: ScriptFormat): Locator {
    return this.page.getByTestId(`fsm-script-source-${format}`);
  }

  applyButton(format: ScriptFormat): Locator {
    return this.page.getByTestId(`fsm-script-apply-${format}`);
  }

  async sourceText(format: ScriptFormat): Promise<string> {
    return await this.source(format).inputValue();
  }

  async setScriptText(format: ScriptFormat, value: string): Promise<void> {
    await this.source(format).fill(value);
  }

  async requestPreview(format: ScriptFormat): Promise<void> {
    await this.page.getByTestId(`fsm-script-preview-${format}`).click();
  }

  async refreshFromGraph(format: ScriptFormat): Promise<void> {
    await this.page.getByTestId(`fsm-script-generate-${format}`).click();
  }

  async discardDraft(format: ScriptFormat): Promise<void> {
    await this.page.getByTestId(`fsm-script-discard-${format}`).click();
  }

  async setAutoPreview(format: ScriptFormat, enabled: boolean): Promise<void> {
    const toggle = this.page.getByTestId(`fsm-script-auto-preview-${format}`);
    if (await toggle.isChecked() !== enabled) {
      await toggle.click();
    }
  }

  async expectDocumentState(format: ScriptFormat, value: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId(`fsm-script-document-state-${format}`)).toContainText(value);
  }

  async expectPreviewReady(): Promise<void> {
    await expect(this.page.getByTestId('fsm-script-preview-panel')).toBeVisible();
    await expect(this.page.getByTestId('fsm-script-preview-revision')).toContainText(/Preview revision/);
  }

  async expectDiagnostic(code: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId('fsm-script-diagnostics')).toContainText(code);
  }

  async expectSemanticChange(kind: string, id?: string): Promise<void> {
    const item = this.page.getByTestId(`fsm-script-change-${kind}`);
    await expect(item).toBeVisible();
    if (id) {
      await expect(item).toContainText(id);
    }
  }

  async expectNoSemanticChange(): Promise<void> {
    await expect(this.page.getByTestId('fsm-script-noop-change')).toBeVisible();
  }

  async expectDestructiveChange(): Promise<void> {
    await expect(this.page.getByTestId('fsm-script-destructive-change')).toBeVisible();
  }

  async applyPreview(format: ScriptFormat): Promise<void> {
    await expect(this.applyButton(format)).toBeEnabled();
    await this.applyButton(format).click();
  }

  async expectApplyDisabled(format: ScriptFormat): Promise<void> {
    await expect(this.applyButton(format)).toBeDisabled();
  }

  async expectStalePreview(): Promise<void> {
    await expect(this.page.getByTestId('fsm-script-stale-preview')).toBeVisible();
  }
}

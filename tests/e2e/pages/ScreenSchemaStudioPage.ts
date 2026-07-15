import { expect, type Locator, type Page } from '@playwright/test';
import type {
  OpenScreenDslFileResult,
  SaveScreenDslFileResult
} from '../../../src/shared/screenDslFiles/contracts';

/**
 * Page object for the Screen Schema Studio panel.
 *
 * File operations are tested by injecting a mock window.spectroDesigner.screenDslFiles
 * before the action button is clicked.  The real adapter delegates to the preload API,
 * so setting up the mock on the window object before the click is sufficient.
 */
export class ScreenSchemaStudioPage {
  constructor(readonly page: Page) {}

  // ── navigation ────────────────────────────────────────────────────────────

  async open(): Promise<void> {
    await this.page.getByTestId('lcd-open-screen-dsl-studio').click();
    await expect(this.page.getByTestId('screen-dsl-studio')).toBeVisible();
  }

  // ── editor access ─────────────────────────────────────────────────────────

  source(format: 'json' | 'yaml'): Locator {
    return this.page.getByTestId(`screen-dsl-source-${format}`);
  }

  async sourceText(format: 'json' | 'yaml'): Promise<string> {
    return await this.source(format).inputValue();
  }

  async setSourceText(format: 'json' | 'yaml', value: string): Promise<void> {
    await this.source(format).fill(value);
  }

  // ── toolbar actions ───────────────────────────────────────────────────────

  async selectFormat(format: 'json' | 'yaml'): Promise<void> {
    await this.page.getByRole('radio', { name: new RegExp(format, 'i') }).click();
  }

  async generateFromProject(): Promise<void> {
    await this.page.getByTestId('screen-dsl-generate-btn').click();
  }

  async requestPreview(): Promise<void> {
    await this.page.getByTestId('screen-dsl-preview-btn').click();
  }

  async applyPreview(): Promise<void> {
    await this.page.getByTestId('screen-dsl-apply-btn').click();
  }

  async discardDraft(): Promise<void> {
    await this.page.getByTestId('screen-dsl-discard-btn').click();
  }

  // ── file operations (require mock injection before calling) ───────────────

  async injectOpenMock(result: OpenScreenDslFileResult): Promise<void> {
    const serialized = JSON.stringify(result);
    await this.page.evaluate((resultJson) => {
      const result = JSON.parse(resultJson);
      const existing = (window as Record<string, unknown>).spectroDesigner as Record<string, unknown> | undefined;
      (window as Record<string, unknown>).spectroDesigner = {
        ...existing,
        screenDslFiles: {
          ...(typeof existing?.screenDslFiles === 'object' ? existing.screenDslFiles as object : {}),
          open: async () => result
        }
      };
    }, serialized);
  }

  async injectSaveMock(result: SaveScreenDslFileResult): Promise<void> {
    const serialized = JSON.stringify(result);
    await this.page.evaluate((resultJson) => {
      const result = JSON.parse(resultJson);
      const existing = (window as Record<string, unknown>).spectroDesigner as Record<string, unknown> | undefined;
      (window as Record<string, unknown>).spectroDesigner = {
        ...existing,
        screenDslFiles: {
          ...(typeof existing?.screenDslFiles === 'object' ? existing.screenDslFiles as object : {}),
          save: async () => result
        }
      };
    }, serialized);
  }

  async clickOpenFile(): Promise<void> {
    await this.page.getByTestId('screen-dsl-open-file-btn').click();
  }

  async clickExport(): Promise<void> {
    await this.page.getByTestId('screen-dsl-export-btn').click();
  }

  // ── replace dialog ────────────────────────────────────────────────────────

  async confirmReplacement(): Promise<void> {
    await this.page.getByTestId('screen-dsl-replace-confirm').click();
  }

  async cancelReplacement(): Promise<void> {
    await this.page.getByTestId('screen-dsl-replace-cancel').click();
  }

  // ── assertions ────────────────────────────────────────────────────────────

  async expectStatus(text: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId('screen-dsl-status')).toContainText(text);
  }

  async expectStatusBadge(text: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId('screen-dsl-status-badge')).toContainText(text);
  }

  async expectDocStatus(text: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId('screen-dsl-doc-status')).toContainText(text);
  }

  async expectReplaceDialogVisible(): Promise<void> {
    await expect(this.page.getByTestId('screen-dsl-replace-dialog')).toBeVisible();
  }
}

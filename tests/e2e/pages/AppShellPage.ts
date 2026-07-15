import { expect, type Page } from '@playwright/test';

export class AppShellPage {
  constructor(readonly page: Page) {}

  async openDemo(): Promise<void> {
    await this.page.goto('/');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await expect(this.page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
    await this.page.getByRole('button', { name: /Open demo|Demo|Открыть демо/ }).click();
    await expect(this.page.getByTestId('workspace-fsm')).toHaveClass(/active/);
  }

  async openFsmWorkspace(): Promise<void> {
    await this.page.getByTestId('workspace-fsm').click();
    await expect(this.page.getByTestId('fsm-workspace')).toBeVisible();
  }

  async openLcdWorkspace(): Promise<void> {
    await this.page.getByTestId('workspace-lcd').click();
    await expect(this.page.locator('.lcd-workspace')).toBeVisible();
  }

  async undo(): Promise<void> {
    await this.page.getByTestId('app-undo').click();
  }

  async redo(): Promise<void> {
    await this.page.getByTestId('app-redo').click();
  }

  async reloadAutosave(): Promise<void> {
    await expect.poll(async () => this.page.evaluate(() => Boolean(localStorage.getItem('lcd-bitmap-ide.project.autosave.v5')))).toBe(true);
    await this.page.reload();
    await this.page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();
    await expect(this.page.getByTestId('workspace-fsm')).toHaveClass(/active/);
  }

  async waitForAutosaveText(text: string): Promise<void> {
    await expect.poll(async () => this.page.evaluate((expected) => {
      const raw = localStorage.getItem('lcd-bitmap-ide.project.autosave.v5');
      return Boolean(raw?.includes(expected));
    }, text)).toBe(true);
  }
}

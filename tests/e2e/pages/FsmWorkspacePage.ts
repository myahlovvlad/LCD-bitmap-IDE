import { expect, type Page } from '@playwright/test';

export class FsmWorkspacePage {
  constructor(readonly page: Page) {}

  async openScriptStudio(): Promise<void> {
    await this.page.getByTestId('fsm-open-script-studio').click();
    await expect(this.page.getByTestId('fsm-script-studio')).toBeVisible();
  }

  async expectStateTitle(stateId: string, title: string | RegExp): Promise<void> {
    await expect(this.page.getByTestId(`fsm-state-card-${stateId}`)).toContainText(title);
  }

  async expectStateAbsent(stateId: string): Promise<void> {
    await expect(this.page.getByTestId(`fsm-state-card-${stateId}`)).toHaveCount(0);
  }
}

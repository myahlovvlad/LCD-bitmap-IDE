import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('creates a localized 128x64 project without resetting the interface language', async ({ page }) => {
  const startupLanguage = page.getByTestId('startup-language');
  await expect(startupLanguage).toHaveValue('en');
  await startupLanguage.selectOption('ru');
  await expect(page.getByRole('button', { name: 'Создать проект' })).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.message()).toBe('Название проекта');
    expect(dialog.defaultValue()).toBe('Универсальный проект LCD');
    await dialog.accept('Макет спектрофотометра');
  });
  await page.getByTestId('startup-create-project').click();

  await expect(page.getByLabel('Проект')).toHaveValue('Макет спектрофотометра');
  await expect(page.locator('.statusbar')).toContainText('128x64');
  await expect(page.getByTestId('interface-language-cycle')).toContainText('RU');
  await expect(page.getByRole('navigation', { name: 'Рабочие области' })).toBeVisible();
  await expect(page.getByTestId('workspace-handoff')).toContainText('Передача HMI');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

  await page.getByTestId('interface-language-cycle').click();
  await expect(page.getByLabel('项目')).toHaveValue('Макет спектрофотометра');
  await expect(page.getByRole('navigation', { name: '工作区' })).toBeVisible();
  await expect(page.getByTestId('workspace-handoff')).toContainText('HMI 交付');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

  await page.getByTestId('interface-language-cycle').click();
  await expect(page.getByLabel('Project')).toHaveValue('Макет спектрофотометра');
  await expect(page.getByRole('navigation', { name: 'Workspaces' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('persists the global GUI language on the startup screen', async ({ page }) => {
  await page.getByTestId('startup-language').selectOption('zh');
  await expect(page.getByText('选择开始方式。')).toBeVisible();
  await page.reload();

  await expect(page.getByTestId('startup-language')).toHaveValue('zh');
  await expect(page.getByRole('button', { name: '创建项目' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('localizes every legacy workspace in Russian and Chinese', async ({ page }) => {
  await page.getByRole('button', { name: 'Open demo' }).click();
  const modes = [
    'fsm',
    'lcd',
    'control-panel',
    'tags',
    'procedures',
    'alarms',
    'runtime',
    'screen-dsl',
    'text-registry',
    'handoff',
    'settings'
  ];
  const legacyEnglish = [
    'No project loaded.',
    'Save as template',
    'No saved templates.',
    'No events yet.',
    'No procedure executed yet.',
    'Active alarms',
    'No validation issues.',
    'Import file...',
    'Auto arrange',
    'Select a state or transition.'
  ];

  for (const expectedLanguage of ['ru', 'zh-CN']) {
    await page.getByTestId('interface-language-cycle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', expectedLanguage);

    for (const mode of modes) {
      const button = page.locator(`[data-testid="workspace-${mode}"]`);
      await button.click();
      await expect(button).toHaveClass(/active/);
      const body = await page.locator('body').innerText();
      for (const phrase of legacyEnglish) {
        expect(body).not.toContain(phrase);
      }
    }
  }
});

import { expect, test, type Page } from '@playwright/test';

const WORKSPACE_GROUP = {
  fsm: 'logic',
  lcd: 'interface',
  'control-panel': 'interface',
  'text-registry': 'interface',
  'screen-dsl': 'interface',
  tags: 'hardware',
  procedures: 'hardware',
  alarms: 'logic',
  hmi: 'delivery',
  runtime: 'delivery',
  handoff: 'delivery'
} as const;

async function openWorkspace(page: Page, mode: keyof typeof WORKSPACE_GROUP): Promise<void> {
  await page.getByTestId(`activity-${WORKSPACE_GROUP[mode]}`).click();
  await page.getByTestId(`workspace-${mode}`).click();
}

async function openDemoAndFsm(page: Page): Promise<void> {
  await openWorkspace(page, 'fsm');
  await expect(page.getByTestId('fsm-workspace')).toBeVisible();
}

async function openDemoAndLcd(page: Page): Promise<void> {
  await openWorkspace(page, 'lcd');
  await expect(page.getByTestId('lcd-open-animations')).toBeVisible();
}

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgYGD4//8/lESwIAC7DABt4hfpRWPJuwAAAABJRU5ErkJggg==';

async function importFixture(page: Page, fileName: string): Promise<void> {
  await page.getByTestId('lcd-open-pixel-importer').click();
  await page.locator('.pixel-importer-panel input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64')
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
});

test('follows the system theme and persists an explicit theme preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: /Open demo|Открыть демо/ }).click();
  const selector = page.getByTestId('theme-selector');
  await expect(selector).toHaveValue('system');
  await selector.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('lcd-bitmap-ide.ui.theme.v1'))).toBe('light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('uses distinct semantic theme tokens while preserving the LCD device palette', async ({ page }) => {
  const selector = page.getByTestId('theme-selector');
  const rootTokens = () => page.locator('html').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.getPropertyValue('--ide-background').trim(),
      text: style.getPropertyValue('--ide-text-primary').trim()
    };
  });

  await selector.selectOption('dark');
  const darkTokens = await rootTokens();
  await page.getByTestId('activity-interface').focus();
  await expect.poll(() => page.getByTestId('activity-interface').evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle}:${style.outlineWidth}`;
  })).not.toBe('none:0px');

  await openWorkspace(page, 'lcd');
  const lcdCanvas = page.locator('.lcd-canvas').first();
  await expect(lcdCanvas).toBeVisible();
  const darkLcdBackground = await lcdCanvas.evaluate((element) => getComputedStyle(element).backgroundColor);

  await selector.selectOption('light');
  const lightTokens = await rootTokens();
  const lightLcdBackground = await lcdCanvas.evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(lightTokens.background).not.toBe(darkTokens.background);
  expect(lightTokens.text).not.toBe(darkTokens.text);
  expect(lightLcdBackground).toBe(darkLcdBackground);
});

test('applies theme changes to every structural application layer', async ({ page }) => {
  const selectors = {
    header: '.project-header',
    activity: '.activity-bar',
    navigator: '.workspace-navigator',
    host: '.workspace-host',
    sidebar: '.fsm-workspace > .workspace-sidebar',
    workArea: '.fsm-workspace > .workspace-canvas-column',
    canvas: '.fsm-canvas',
    inspector: '.fsm-workspace > .workspace-inspector',
    card: '.fsm-workspace .inspector-card',
    input: '.fsm-workspace .sidebar-search'
  } as const;
  const readLayerColors = () => page.evaluate((layerSelectors) => Object.fromEntries(
    Object.entries(layerSelectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing theme layer: ${name} (${selector})`);
      const style = getComputedStyle(element);
      return [name, style.backgroundColor];
    })
  ), selectors);

  const selector = page.getByTestId('theme-selector');
  await selector.selectOption('dark');
  const darkLayers = await readLayerColors();
  await selector.selectOption('light');
  const lightLayers = await readLayerColors();

  const unchangedLayers = Object.keys(selectors).filter((name) => lightLayers[name] === darkLayers[name]);
  expect(unchangedLayers).toEqual([]);
});

test('applies light and dark themes to redesigned editor, HMI, Runtime and handoff layers', async ({ page }) => {
  const themeSelector = page.getByTestId('theme-selector');
  const readBackground = async (selector: string): Promise<string> => {
    const layer = page.locator(selector).first();
    await expect(layer).toBeVisible();
    return layer.evaluate((element) => getComputedStyle(element).backgroundColor);
  };
  const expectThemeAware = async (selector: string): Promise<void> => {
    await themeSelector.selectOption('dark');
    const dark = await readBackground(selector);
    await themeSelector.selectOption('light');
    const light = await readBackground(selector);
    expect(light, `${selector} must use semantic theme tokens`).not.toBe(dark);
  };

  for (const workspace of ['lcd', 'control-panel', 'text-registry', 'screen-dsl', 'tags', 'procedures', 'alarms'] as const) {
    await openWorkspace(page, workspace);
    await expectThemeAware('.editor-context-bar');
  }

  await openWorkspace(page, 'hmi');
  await expectThemeAware('.hmi-trace-stage');

  await openWorkspace(page, 'runtime');
  await expectThemeAware('.runtime-timer-status');

  await openWorkspace(page, 'handoff');
  await expectThemeAware('.handoff-validation-stage');
});

test('exposes the primary isolated workspaces', async ({ page }) => {
  await expect(page.getByTestId('software-version')).toHaveText(/Software v0\.1\.18|ПО v0\.1\.18/);
  await expect(page.getByTestId('activity-interface')).toBeVisible();
  await expect(page.getByTestId('activity-logic')).toBeVisible();
  await expect(page.getByTestId('activity-hardware')).toBeVisible();
  await expect(page.getByTestId('activity-delivery')).toBeVisible();

  const navigation = page.getByTestId('workspace-navigator');
  await expect(navigation.getByRole('button', { name: /FSM editor|FSM-редактор/ })).toBeVisible();
  await page.getByTestId('activity-interface').click();
  await expect(navigation.getByRole('button', { name: /LCD editor|LCD-редактор/ })).toBeVisible();
  await expect(navigation.getByRole('button', { name: /Control panel|Панель управления/ })).toBeVisible();
  await page.getByTestId('activity-delivery').click();
  await expect(navigation.getByRole('button', { name: /Runtime|Выполнение/ })).toBeVisible();

  await page.getByTestId('activity-interface').click();
  await navigation.getByRole('button', { name: /Control panel|Панель управления/ }).click();
  await expect(page.getByLabel(/Control panel editor/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Screens' })).toHaveCount(0);

  await navigation.getByRole('button', { name: /LCD editor|LCD-редактор/ }).click();
  await expect(page.getByLabel(/LCD editor/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import image', exact: true })).toBeVisible();
  await expect(page.getByText(/Transition properties/)).toHaveCount(0);
});

test('opens Settings from the global header and keeps the active workspace group', async ({ page }) => {
  await openWorkspace(page, 'lcd');
  await expect(page.getByLabel(/LCD editor/)).toBeVisible();

  await page.getByTestId('app-settings').click();
  await expect(page.getByLabel(/Settings|Настройки/)).toBeVisible();
  await expect(page.getByTestId('activity-interface')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('settings-theme-selector')).toHaveValue('system');
});

test('opens the linked screen from the FSM workspace', async ({ page }) => {
  await expect(page.getByLabel(/FSM editor/)).toBeVisible();
  await page.getByRole('button', { name: /Edit layout/ }).click();

  await expect(page.getByLabel(/LCD editor/)).toBeVisible();
  await expect(page.locator('.workspace-navigation button[data-workspace="lcd"]')).toHaveClass(/active/);
  await expect(page.locator('.lcd-editor-frame .lcd-canvas').first()).toBeVisible();
});

test('keeps the viewport zoom after moving an FSM state node', async ({ page }) => {
  await page.getByTestId('fsm-edit-mode').click();
  const viewport = page.locator('.fsm-canvas .react-flow__viewport');
  const node = page.locator('.fsm-canvas .react-flow__node').filter({ has: page.locator('.state-node') }).first();
  await expect(node).toBeVisible();
  await page.waitForTimeout(350); // allow initial fitView, if any
  const scaleOf = async (): Promise<number> => {
    const transform = await viewport.getAttribute('style') ?? '';
    const match = transform.match(/scale\(([^)]+)\)/);
    return Number(match?.[1] ?? NaN);
  };
  const before = await scaleOf();
  const box = await node.boundingBox();
  if (!box) throw new Error('FSM state node has no bounding box.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 42, box.y + box.height / 2 + 18);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await scaleOf()).toBeCloseTo(before, 6);
});

test('renders persisted FSM edges in read-only mode', async ({ page }) => {
  await openDemoAndFsm(page);
  await expect(page.getByTestId('fsm-edit-mode')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.react-flow__edge path.fsm-edge')).toHaveCount(4);
});

test('reports and resets transitions hidden by overview', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByRole('button', { name: /Overview|Обзор/ }).click();
  await expect(page.getByTestId('fsm-transition-summary')).toContainText(/of 4/);
  await page.getByTestId('fsm-reset-graph-filters').click();
  await expect(page.getByTestId('fsm-transition-summary')).toContainText('4 / 4');
});

test('navigator compaction leaves FSM state pane visible', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByTestId('workspace-navigator-toggle').click();
  await expect(page.getByTestId('workspace-navigator')).toHaveClass(/navigator-compact/);
  await expect(page.locator('.fsm-state-catalog')).toBeVisible();
  await expect(page.locator('.fsm-state-catalog')).not.toHaveClass(/collapsed/);
});

test('FSM pane collapse releases its grid column and remains restorable', async ({ page }) => {
  await openDemoAndFsm(page);
  await page.getByTestId('fsm-collapse-state-catalog').click();
  await expect(page.locator('.fsm-state-catalog')).toHaveClass(/collapsed/);
  await expect(page.getByTestId('fsm-expand-state-catalog')).toBeVisible();
  await page.getByTestId('fsm-expand-state-catalog').click();
  await expect(page.locator('.fsm-state-catalog')).not.toHaveClass(/collapsed/);
});

test('keeps an operator zoom after switching from FSM to LCD and back', async ({ page }) => {
  const viewport = page.locator('.fsm-canvas .react-flow__viewport');
  const scaleOf = async (): Promise<number> => {
    const transform = await viewport.getAttribute('style') ?? '';
    const match = transform.match(/scale\(([^)]+)\)/);
    return Number(match?.[1] ?? NaN);
  };

  await expect(viewport).toBeVisible();
  const canvas = page.locator('.fsm-canvas');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('FSM canvas is unavailable.');
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -620);
  await expect.poll(scaleOf).toBeGreaterThan(1);
  const expectedScale = await scaleOf();
  await expect.poll(async () => page.evaluate((expected) => {
    const raw = localStorage.getItem('lcd-bitmap-ide.workspace.fsm-viewport.v1');
    const entries = raw ? JSON.parse(raw).entries as Record<string, { zoom: number }> : {};
    return Object.values(entries).some((viewport) => Math.abs(viewport.zoom - expected) < 0.001);
  }, expectedScale)).toBe(true);

  await openWorkspace(page, 'lcd');
  await expect(page.getByLabel(/LCD editor/)).toBeVisible();
  await openWorkspace(page, 'fsm');
  await expect(viewport).toBeVisible();

  await expect.poll(scaleOf).toBeCloseTo(expectedScale, 3);
});

test('restores the FSM viewport after reload without changing project metadata', async ({ page }) => {
  const viewport = page.locator('.fsm-canvas .react-flow__viewport');
  const scaleOf = async (): Promise<number> => {
    const transform = await viewport.getAttribute('style') ?? '';
    const match = transform.match(/scale\(([^)]+)\)/);
    return Number(match?.[1] ?? NaN);
  };
  const projectUpdatedAt = () => page.evaluate(() => {
    const raw = localStorage.getItem('lcd-bitmap-ide.project.autosave.v5');
    if (!raw) return null;
    return (JSON.parse(raw) as { project?: { meta?: { updatedAt?: string } } }).project?.meta?.updatedAt ?? null;
  });

  await expect(viewport).toBeVisible();
  await expect.poll(projectUpdatedAt).not.toBeNull();
  const updatedAtBeforeViewportChange = await projectUpdatedAt();
  const canvasBox = await page.locator('.fsm-canvas').boundingBox();
  if (!canvasBox) throw new Error('FSM canvas is unavailable.');
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -620);
  await expect.poll(scaleOf).toBeGreaterThan(1);
  const expectedScale = await scaleOf();

  await page.reload();
  await page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();
  await expect(viewport).toBeVisible();
  await expect.poll(scaleOf).toBeCloseTo(expectedScale, 3);
  await expect.poll(projectUpdatedAt).toBe(updatedAtBeforeViewportChange);
});

test('keeps the LCD preview to the right of a scrollable Canvas inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWorkspace(page, 'lcd');

  const controls = page.locator('.lcd-editor > .flex-1');
  const preview = page.locator('.lcd-editor > .lcd-display-column');
  await expect(controls).toBeVisible();
  await expect(preview).toBeVisible();
  const controlsBox = await controls.boundingBox();
  const previewBox = await preview.boundingBox();
  expect(previewBox?.x).toBeGreaterThan((controlsBox?.x ?? 0) + (controlsBox?.width ?? 0) - 2);
  await expect.poll(() => controls.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test('keeps the LCD canvas mounted while auxiliary tools are open', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await openWorkspace(page, 'lcd');

  const canvas = page.locator('.lcd-editor-frame .lcd-canvas').first();
  await expect(canvas).toBeVisible();

  await page.getByRole('button', { name: 'Import image', exact: true }).click();
  await expect(page.getByTestId('lcd-auxiliary-panel')).toBeVisible();
  await expect(canvas).toBeVisible();

  await page.getByTestId('lcd-open-screen-dsl-studio').click();
  await expect(page.getByTestId('screen-dsl-studio')).toBeVisible();
  await expect(canvas).toBeVisible();
});

test('collapses, resizes and persists LCD sidebars', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await openWorkspace(page, 'lcd');

  const leftSidebar = page.locator('.lcd-workspace > .workspace-sidebar');
  const leftSplitter = page.getByRole('separator', { name: 'Resize Left Sidebar' });
  const initialWidth = (await leftSidebar.boundingBox())?.width ?? 0;
  const splitterBox = await leftSplitter.boundingBox();
  if (!splitterBox) throw new Error('Left splitter is unavailable.');
  await page.mouse.move(splitterBox.x + 3, splitterBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(splitterBox.x + 83, splitterBox.y + 100);
  await page.mouse.up();
  await expect.poll(async () => (await leftSidebar.boundingBox())?.width ?? 0).toBeGreaterThan(initialWidth + 60);

  await page.getByRole('button', { name: 'Collapse Left Sidebar' }).click();
  await expect(leftSidebar).toHaveClass(/collapsed/);
  await expect.poll(async () => (await leftSidebar.boundingBox())?.width ?? 0).toBeLessThan(60);
  await page.reload();
  await page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();
  await openWorkspace(page, 'lcd');
  await expect(leftSidebar).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Open Left Sidebar' }).click();

  const rightSidebar = page.locator('.lcd-workspace > .workspace-inspector');
  await page.getByRole('button', { name: 'Collapse Right Sidebar' }).click();
  await expect(rightSidebar).toHaveClass(/collapsed/);
  await page.getByRole('button', { name: 'Open Right Sidebar' }).click();
  await expect(rightSidebar).not.toHaveClass(/collapsed/);
});

test('edits screen dimensions and copies a screen from properties', async ({ page }) => {
  await openWorkspace(page, 'lcd');
  const inspector = page.locator('.lcd-workspace > .workspace-inspector');
  await inspector.getByLabel('Width').fill('144');
  await inspector.getByLabel('Height').fill('72');
  await expect(inspector.getByText('144x72')).toBeVisible();
  await expect(page.locator('.lcd-canvas')).toHaveAttribute('width', '720');
  await expect(page.locator('.lcd-canvas')).toHaveAttribute('height', '360');

  const screenCount = await page.locator('.lcd-workspace .entity-card').count();
  await inspector.getByRole('button', { name: 'Copy' }).click();
  await expect(page.locator('.lcd-workspace .entity-card')).toHaveCount(screenCount + 1);
  await expect(inspector.getByLabel('Name')).toHaveValue(/Copy$/);
});

test('renames and deletes the first screen without deleting its FSM state', async ({ page }) => {
  await openWorkspace(page, 'lcd');
  const screens = page.locator('.lcd-workspace .entity-card');
  await expect(screens.first()).toBeVisible();
  const initialCount = await screens.count();
  const inspector = page.locator('.lcd-workspace > .workspace-inspector');

  await inspector.getByLabel('Name').fill('Renamed first screen');
  await inspector.getByLabel('Name').press('Enter');
  await expect(screens.first()).toContainText('Renamed first screen');

  await screens.first().getByRole('button', { name: 'Delete' }).click();
  await expect(screens).toHaveCount(initialCount - 1);
  await expect(page.locator('.lcd-workspace')).not.toContainText('Renamed first screen');

  await openWorkspace(page, 'fsm');
  await expect(page.locator('.fsm-workspace .entity-card').filter({ hasText: 'Renamed first screen' })).toHaveCount(1);
});

test('edits localized text and pins its LCD language independently of the interface', async ({ page }) => {
  await openWorkspace(page, 'lcd');
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.locator('.lcd-canvas').click({ position: { x: 160, y: 80 } });

  const properties = page.locator('.object-properties');
  await properties.getByRole('textbox', { name: 'Text EN' }).fill('Pinned English');
  await properties.getByRole('textbox', { name: 'Text RU' }).fill('Русский текст');
  await properties.getByRole('checkbox', { name: 'Pin: Text EN' }).check();
  await page.getByTestId('interface-language-cycle').click();

  await expect(properties.getByRole('textbox', { name: 'Текст EN' })).toHaveValue('Pinned English');
  await expect(properties.getByRole('textbox', { name: 'Текст RU' })).toHaveValue('Русский текст');
  await expect(properties.getByRole('checkbox', { name: 'Закрепить: Текст EN' })).toBeChecked();
});

test('adds requested punctuation and creates an arbitrary custom glyph', async ({ page }) => {
  await openWorkspace(page, 'lcd');
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.locator('.lcd-canvas').click({ position: { x: 160, y: 80 } });

  const properties = page.locator('.object-properties');
  const textEn = properties.getByRole('textbox', { name: 'Text EN' });
  await textEn.fill('Ready');
  await properties.getByRole('button', { name: '?' }).click();
  await properties.getByRole('button', { name: '!' }).click();
  await expect(textEn).toHaveValue('Ready?!');

  await page.getByRole('button', { name: 'Glyph editor', exact: true }).click();
  const customCharacter = page.getByRole('textbox', { name: 'Custom character' });
  await customCharacter.fill('?');
  await page.getByRole('button', { name: 'Create or edit glyph' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Toggle glyph pixel/ }).first().click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
});

test('creates a panel button and binds it to an FSM event', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await openWorkspace(page, 'control-panel');
  await page.getByLabel('Width').fill('1100');
  await page.getByLabel('Height').fill('520');
  await expect(page.locator('.control-panel-canvas')).toHaveAttribute('width', '1100');
  await expect(page.locator('.control-panel-canvas')).toHaveAttribute('height', '520');
  await page.getByRole('button', { name: /^Button$/ }).click();

  const inspector = page.getByRole('heading', { name: 'Element properties' }).locator('..');
  await expect(inspector.getByLabel('Label')).toHaveValue('Button');
  await inspector.getByLabel('Label').fill('TEST');
  await inspector.getByLabel('FSM event').selectOption('START');
  await expect(inspector.getByLabel('FSM event')).toHaveValue('START');
  await expect(page.locator('.control-panel-canvas').getByText('TEST')).toBeVisible();
});

test('presses a virtual button and performs a runtime transition', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await openWorkspace(page, 'runtime');
  await expect(page.locator('.runtime-workspace')).toBeVisible();

  await page.locator('button.runtime-hw-btn', { hasText: /^START$/ }).click();

  await expect(page.locator('.runtime-state-name strong')).toHaveText('Measurement');
  await expect(page.locator('.runtime-log-scroll').getByText(/tr-main-measure/)).toBeVisible();
});

test('queues runtime events in step mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await openWorkspace(page, 'runtime');
  await page.getByRole('button', { name: 'Step mode' }).click();
  await page.locator('button.runtime-hw-btn', { hasText: /^START$/ }).click();
  await expect(page.locator('.runtime-state-name strong')).toHaveText('Main Menu Demo');
  await expect(page.locator('.runtime-log-scroll')).not.toContainText('tr-main-measure');

  await page.getByRole('button', { name: /^Step$/ }).click();
  await expect(page.locator('.runtime-state-name strong')).toHaveText('Measurement');
});

test('warns in runtime and blocks export when validation has reference errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem('lcd-bitmap-ide.project.autosave.v5')))).toBe(true);
  await page.evaluate(() => {
    const raw = localStorage.getItem('lcd-bitmap-ide.project.autosave.v5');
    if (!raw) return;
    const payload = JSON.parse(raw);
    const state = Object.values(payload.project.fsm.states)[0] as { screenId?: string } | undefined;
    if (!state) return;
    state.screenId = 'missing-screen';
    localStorage.setItem('lcd-bitmap-ide.project.autosave.v5', JSON.stringify(payload));
  });
  await page.reload();
  await page.getByRole('button', { name: /Restore autosave|Восстановить автосохранение/ }).click();

  await openWorkspace(page, 'runtime');
  await expect(page.locator('.toast-warning').getByText(/Runtime opened, but the project has \d+ validation errors/)).toBeVisible();
  await expect(page.locator('.workspace-navigation button[data-workspace="runtime"]')).toHaveClass(/active/);

  await page.locator('.project-actions').getByRole('button', { name: /Export universal|Универсальный экспорт/ }).click();
  await expect(page.locator('.toast-danger').getByText(/Export blocked/)).toBeVisible();
});

test('keeps explicit operation feedback in the notification history', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await page.locator('.project-actions').getByRole('button', { name: /Export universal|Универсальный экспорт/ }).click();
  await expect(page.locator('.toast-success')).toBeVisible();

  await page.getByTestId('notification-center-trigger').click();
  const panel = page.locator('#notification-center-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/export|экспорт/i);
});

test('requires explicit FSM edit mode for graph mutations', async ({ page }) => {
  await page.getByRole('button', { name: 'Demo' }).click();
  await openWorkspace(page, 'fsm');

  await expect(page.getByTestId('fsm-add-state')).toBeDisabled();
  await expect(page.getByTestId('fsm-workspace')).toHaveClass(/fsm-readonly-mode/);
  await page.getByTestId('fsm-edit-mode').click();
  await expect(page.getByTestId('fsm-add-state')).toBeEnabled();
  await expect(page.getByTestId('fsm-workspace')).toHaveClass(/fsm-edit-mode/);
});

test('opens the searchable operation manual and guided tour', async ({ page }) => {
  await page.getByRole('button', { name: /^Manual$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Operation manual/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('framebuffer');
  await expect(dialog.getByRole('button', { name: /Data & export reference/i })).toBeVisible();
  await dialog.getByRole('button', { name: /Start guided tour/ }).click();
  await expect(page.getByRole('dialog', { name: /Project actions/ })).toBeVisible();
});

test('switches locales without encoding artifacts', async ({ page }) => {
  const languageButton = page.getByTestId('interface-language-cycle');
  const brokenEncoding = /(?:Р.|С.){3,}|�/;
  for (const expected of ['RU', 'ZH', 'EN']) {
    await languageButton.click();
    await expect(languageButton).toContainText(expected);
    expect(await page.locator('body').innerText()).not.toMatch(brokenEncoding);
  }
});

test('loads without uncaught page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: /LCD-bitmap IDE/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('insert and edit selects the imported bitmap before returning to editor', async ({ page }) => {
  await openDemoAndLcd(page);
  await importFixture(page, 'two-pixel.png');
  await page.getByRole('button', { name: /Insert and edit bitmap|Вставить и редактировать bitmap/ }).click();
  await expect(page.locator('[data-testid="selected-canvas-object"]')).toHaveText(/pixel-import/);
});

test('animation editor creates a resource and shows a live preview', async ({ page }) => {
  await openDemoAndLcd(page);
  await page.getByTestId('lcd-open-animations').click();
  await page.locator('.animation-editor-panel input[type="file"]').setInputFiles({
    name: 'frame.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64')
  });
  await expect(page.getByTestId('animation-preview')).toBeVisible();
  await expect(page.getByTestId('animation-bind-screen')).toBeVisible();
});

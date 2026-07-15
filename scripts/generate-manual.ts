import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import {
  OPERATION_MANUAL_BY_LANGUAGE,
  type ManualBlock,
  type ManualSection
} from '../src/renderer/config/operationManual';
import { loadBundledFsmModel } from '../src/renderer/core/loadBundledFsm';
import { renderCanvasObjects, type FrameBuffer } from '../src/renderer/utils/render';
import type { LanguageCode } from '../src/renderer/types/domain';

const outputDirectory = resolve('docs/generated');
const screenshotsDirectory = resolve(outputDirectory, 'screenshots');
const locales: LanguageCode[] = ['en', 'ru', 'zh'];
const localeNames = {
  en: 'English',
  ru: 'Русский',
  zh: '简体中文'
} satisfies Record<LanguageCode, string>;
const catalogTitles = {
  en: 'LCD state catalog',
  ru: 'Каталог состояний LCD',
  zh: 'LCD 状态目录'
} satisfies Record<LanguageCode, string>;

async function captureGuiScreenshots(browser: Browser): Promise<Record<LanguageCode, string[]>> {
  const result = {} as Record<LanguageCode, string[]>;
  for (const language of locales) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4180');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const demoButton = page.getByRole('button', { name: /Demo|Демо|演示|Open demo|Открыть демо/ }).first();
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
    }
    await page.locator('.project-header').waitFor({ state: 'visible' });

    const languageButton = page.locator('[aria-label="Toggle interface language"]');
    const clickCount = language === 'en' ? 0 : language === 'ru' ? 1 : 2;
    for (let index = 0; index < clickCount; index += 1) {
      await languageButton.click();
    }

    const files: string[] = [];
    files.push(await capture(page, language, 'workspace'));
    await page.keyboard.press('Control+P');
    files.push(await capture(page, language, 'preview'));
    await page.keyboard.press('Control+E');
    await page.getByRole('button', { name: /Manual|Руководство|手册/, exact: true }).click();
    files.push(await capture(page, language, 'manual'));
    result[language] = files;
    await context.close();
  }
  return result;
}

async function capture(page: Page, language: LanguageCode, name: string): Promise<string> {
  const filename = `gui-${name}-${language}.png`;
  await page.screenshot({
    path: resolve(screenshotsDirectory, filename),
    fullPage: true
  });
  return `screenshots/${filename}`;
}

function renderManual(
  language: LanguageCode,
  sections: readonly ManualSection[],
  states: Array<{ stateId: string; title: string; frameBuffer: FrameBuffer }>,
  guiScreenshots: string[]
): string {
  const toc = sections.map((section) => `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`).join('');
  const body = sections.map(renderSection).join('');
  const screenshots = guiScreenshots
    .map((source) => `<figure><img class="gui-shot" src="${source}" alt="${escapeHtml(source)}"></figure>`)
    .join('');
  const stateCatalog = states
    .map((state) => `
      <figure class="lcd-state">
        <figcaption><strong>${escapeHtml(state.title)}</strong><code>${escapeHtml(state.stateId)}</code></figcaption>
        ${frameBufferToSvg(state.frameBuffer)}
      </figure>`)
    .join('');

  return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LCD-bitmap IDE - ${localeNames[language]}</title>
  <style>${manualStyles}</style>
</head>
<body>
  <header><h1>LCD-bitmap IDE</h1><p>${localeNames[language]}</p></header>
  <nav><ol>${toc}<li><a href="#gui">GUI</a></li><li><a href="#lcd-catalog">${catalogTitles[language]}</a></li></ol></nav>
  <main>
    ${body}
    <section id="gui"><h2>GUI</h2>${screenshots}</section>
    <section id="lcd-catalog"><h2>${catalogTitles[language]}</h2><div class="catalog">${stateCatalog}</div></section>
  </main>
</body>
</html>`;
}

function renderSection(section: ManualSection): string {
  return `<section id="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${
    section.summary ? `<p class="summary">${escapeHtml(section.summary)}</p>` : ''
  }${section.blocks.map(renderBlock).join('')}</section>`;
}

function renderBlock(block: ManualBlock): string {
  switch (block.kind) {
    case 'lead':
    case 'text':
      return `<p>${escapeHtml(block.text)}</p>`;
    case 'note':
      return `<aside>${escapeHtml(block.text)}</aside>`;
    case 'steps':
      return `<ol>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
    case 'task':
      return `<article class="task"><h3>${escapeHtml(block.task)}</h3><p>${escapeHtml(block.principle)}</p><ol>${
        block.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')
      }</ol></article>`;
    case 'diagram':
      return `<figure><pre>${escapeHtml(block.art)}</pre>${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
    case 'table':
      return `<table><thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${
        block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`;
  }
}

function frameBufferToSvg(frameBuffer: FrameBuffer): string {
  const height = frameBuffer.length;
  const width = frameBuffer[0]?.length ?? 0;
  const pixels: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (frameBuffer[y][x]) {
        pixels.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg class="lcd-shot" viewBox="0 0 ${width} ${height}" role="img" aria-label="LCD ${width}x${height}"><rect width="${width}" height="${height}" fill="#a9c87c"/><g fill="#17200f">${pixels.join('')}</g></svg>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function waitForUrl(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const manualStyles = `
  :root { font-family: Inter, "Segoe UI", Arial, sans-serif; color: #111827; background: #fff; }
  body { max-width: 1120px; margin: 0 auto; padding: 28px; line-height: 1.5; }
  header { border-bottom: 4px solid #284780; margin-bottom: 20px; }
  header h1 { margin-bottom: 0; color: #284780; }
  nav { padding: 12px 18px; border: 1px solid #cbd5e1; background: #f8fafc; }
  section { break-before: page; margin-top: 28px; }
  section:first-child { break-before: auto; }
  h2 { color: #284780; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; }
  h3 { color: #1e3a5f; }
  .summary { color: #475569; font-style: italic; }
  aside, .task { border-left: 4px solid #16a34a; background: #f0fdf4; padding: 10px 14px; margin: 14px 0; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e2e8f0; }
  pre { overflow: hidden; border: 1px solid #94a3b8; background: #0f172a; color: #dcfce7; padding: 12px; font-size: 10px; }
  figure { break-inside: avoid; margin: 14px 0; }
  figcaption { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; color: #334155; }
  .gui-shot { width: 100%; border: 1px solid #64748b; }
  .catalog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .lcd-state { border: 1px solid #94a3b8; padding: 8px; }
  .lcd-shot { display: block; width: 100%; image-rendering: pixelated; border: 4px solid #17200f; background: #a9c87c; }
  code { font-size: 10px; color: #475569; }
  @media print { body { max-width: none; padding: 0; } a { color: inherit; text-decoration: none; } }
`;

async function main(): Promise<void> {
  await mkdir(screenshotsDirectory, { recursive: true });

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    server = spawn(process.execPath, ['scripts/serve-static.mjs', 'dist/renderer', '4180'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      windowsHide: true
    });
    await waitForUrl('http://127.0.0.1:4180');
    browser = await chromium.launch();

    const guiScreenshots = await captureGuiScreenshots(browser);
    const model = loadBundledFsmModel();

    for (const language of locales) {
      const html = renderManual(
        language,
        OPERATION_MANUAL_BY_LANGUAGE[language],
        model.stateOrder.map((stateId) => ({
          stateId,
          title: model.project.states[stateId]?.title ?? stateId,
          frameBuffer: renderCanvasObjects(model.project.canvasByStateId[stateId]?.objects ?? [], {
            language,
            width: model.project.display.width,
            height: model.project.display.height
          })
        })),
        guiScreenshots[language]
      );
      const htmlPath = resolve(outputDirectory, `lcd-bitmap-ide-manual-${language}.html`);
      await writeFile(htmlPath, html, 'utf8');

      const page = await browser.newPage();
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
      await page.pdf({
        path: resolve(outputDirectory, `lcd-bitmap-ide-manual-${language}.pdf`),
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' }
      });
      await page.close();
    }

    console.log(`Generated trilingual HTML/PDF manuals in ${outputDirectory}`);
  } finally {
    await browser?.close();
    server?.kill();
  }
}

await main();

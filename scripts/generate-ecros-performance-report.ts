import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const reports = resolve(root, 'ECROS-5400UV', 'reports');
const playwright = JSON.parse(readFileSync(resolve(root, 'test-results', 'performance-results.json'), 'utf8'));
const electron = JSON.parse(readFileSync(resolve(reports, 'electron-performance.json'), 'utf8'));
const attachment = playwright.suites[0].specs[0].tests[0].results[0].attachments
  .find((item: { name: string }) => item.name === 'performance-metrics');
const browser = attachment ? JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8')) : null;
const report = {
  generatedAt: new Date().toISOString(),
  methodology: {
    browser: 'Playwright Chromium production preview; six search and graph-toolbar interactions; p95 budget: dispatch <= 16.7 ms, settle <= 500 ms.',
    electron: 'Playwright Electron production main/preload bundle; opening demo and FSM workspace, then main-process and renderer snapshot.'
  },
  before: null,
  after: {
    browser,
    electron
  },
  interpretation: {
    browserBudgetPassed: Boolean(browser && browser.dispatchP95 <= 16.7 && browser.settleP95 <= 500 && browser.longTasks.every((duration: number) => duration <= 200)),
    rendererLcdInstances: electron.renderer.lcdRendererInstances,
    note: 'There was no machine-comparable historical performance baseline in the repository. Values are intentionally recorded as null for before rather than fabricated.'
  },
  residualRisks: [
    'The initial JavaScript chunk remains above the Vite warning threshold; WebGL FSM stays lazy-loaded but the main bundle needs a future split.',
    'OS-level CPU and renderer RSS must be profiled on target hardware before a regulated-device release.'
  ]
};
writeFileSync(resolve(reports, 'performance.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(reports, 'performance.md'), `# ECROS performance baseline\n\n## Method\n\n${report.methodology.browser}\n\n${report.methodology.electron}\n\n## After\n\n- Browser dispatch p95: ${browser?.dispatchP95 ?? 'unavailable'} ms\n- Browser settle p95: ${browser?.settleP95 ?? 'unavailable'} ms\n- Long tasks >200 ms: ${browser?.longTasks?.filter((duration: number) => duration > 200).length ?? 'unavailable'}\n- Electron startup to FSM snapshot: ${electron.applicationStartupMs} ms\n- Main resident set: ${electron.main.memory.residentSet} KiB\n- Renderer JavaScript heap: ${electron.renderer.jsHeapBytes ?? 'unavailable'} bytes\n- React Flow nodes / viewport-visible nodes / edges: ${electron.renderer.flowNodes} / ${electron.renderer.visibleFlowNodes} / ${electron.renderer.flowEdges}\n- LCD renderer instances on FSM canvas: ${electron.renderer.lcdRendererInstances}\n\n## Before / after\n\nA comparable historical baseline was not stored in the repository. The **before** field is deliberately null; this report does not invent a comparison. The current figures are the reproducible baseline for future releases.\n\n## Residual risks\n\n${report.residualRisks.map((risk) => `- ${risk}`).join('\n')}\n`);
console.log(JSON.stringify(report.interpretation, null, 2));

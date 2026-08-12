import { _electron as electron } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const executable = resolve(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const reportDir = resolve(root, 'ECROS-5400UV', 'reports');
const ecrosProject = resolve(root, 'ECROS-5400UV', 'ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj');

async function main(): Promise<void> {
  if (!existsSync(executable)) throw new Error(`Electron executable was not found: ${executable}`);
  const startedAt = performance.now();
  const app = await electron.launch({
    executablePath: executable,
    args: ['.'],
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'VITE_DEV_SERVER_URL' && key !== 'ELECTRON_RUN_AS_NODE'))
  });
  try {
    const window = await app.firstWindow();
    await window.locator('input[type="file"]').first().setInputFiles(ecrosProject);
    await window.locator('.workspace-navigation').waitFor({ state: 'visible' });
    await window.locator('.workspace-navigation button[data-workspace="fsm"]').click();
    await window.locator('[data-testid="fsm-workspace"]').waitFor({ state: 'visible' });
    await window.locator('.react-flow').waitFor({ state: 'visible' });
    await window.waitForTimeout(250);
    const renderer = await window.evaluate(() => {
      const flowNodes = [...document.querySelectorAll<HTMLElement>('.react-flow__node')];
      const stateNodes = flowNodes.filter((element) => Boolean(element.querySelector('.state-node')));
      const flowEdges = [...document.querySelectorAll('.react-flow__edge')];
      const canvasBounds = document.querySelector<HTMLElement>('.fsm-canvas')?.getBoundingClientRect();
      const firstNodeBounds = stateNodes[0]?.getBoundingClientRect();
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      return {
        flowNodes: flowNodes.length,
        visibleFlowNodes: stateNodes.filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 && bounds.right >= 0 && bounds.bottom >= 0 && bounds.left <= innerWidth && bounds.top <= innerHeight;
        }).length,
        stateNodes: stateNodes.length,
        flowEdges: flowEdges.length,
        lcdRendererInstances: document.querySelectorAll('.lcd-canvas').length,
        jsHeapBytes: memory?.usedJSHeapSize ?? null,
        totalJsHeapBytes: memory?.totalJSHeapSize ?? null,
        fsmCanvas: canvasBounds ? { width: canvasBounds.width, height: canvasBounds.height } : null,
        viewportTransform: document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform ?? null,
        firstNode: firstNodeBounds ? { x: firstNodeBounds.x, y: firstNodeBounds.y, width: firstNodeBounds.width, height: firstNodeBounds.height } : null
      };
    });
    const main = await app.evaluate(async () => ({
      memory: await process.getProcessMemoryInfo(),
      cpu: process.getCPUUsage()
    }));
    const metrics = {
      measuredAt: new Date().toISOString(),
      applicationStartupMs: Math.round((performance.now() - startedAt) * 100) / 100,
      renderer,
      main
    };
    await mkdir(reportDir, { recursive: true });
    writeFileSync(resolve(reportDir, 'electron-performance.json'), `${JSON.stringify(metrics, null, 2)}\n`);
    console.log(JSON.stringify(metrics, null, 2));
  } finally {
    await app.close();
  }
}

void main();

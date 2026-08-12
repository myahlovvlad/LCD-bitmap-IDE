import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRuntimeEngine } from '../src/services/runtimeEngine';
import { migrateProject } from '../src/services/projectMigrationService';
import type { ControlPanelButton, FsmTransition } from '../src/domain/project';

const root = process.cwd();
const projectFile = resolve(root, 'ECROS-5400UV', 'ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj');
const reportDir = resolve(root, 'ECROS-5400UV', 'reports');
const snapshot = migrateProject(JSON.parse(readFileSync(projectFile, 'utf8')));
const project = snapshot.project;
const fsm = project.fsm;
const initialStateId = fsm.stateOrder.find((id) => fsm.states[id]?.initial) ?? fsm.stateOrder[0] ?? null;
const buttons = project.controlPanel.elementOrder
  .map((id) => project.controlPanel.elements[id])
  .filter((element): element is ControlPanelButton => element?.type === 'button' && element.visible);

type Scalar = string | number | boolean | null;
type CoverageRow = {
  screen: string;
  sourceState: string;
  hmiControl: string | null;
  event: string;
  transition: string;
  guard: string | null;
  tags: Record<string, Scalar>;
  procedure: string | null;
  cliCommandArgs: string[];
  expectedResult: string;
  actualResult: 'passed' | 'failed' | 'requires-user-decision';
  detail: string;
};

function guardValues(expression: string | null | undefined): Record<string, Scalar> {
  if (!expression?.trim()) return {};
  const match = expression.trim().match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) return { [expression.trim()]: true };
  const [, id, operator, raw] = match;
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
  const expected: Scalar = cleaned === 'true' ? true : cleaned === 'false' ? false : Number.isFinite(Number(cleaned)) ? Number(cleaned) : cleaned;
  if (operator === '!=') return { [id]: typeof expected === 'boolean' ? !expected : '__different__' };
  if (operator === '>') return { [id]: Number(expected) + 1 };
  if (operator === '>=') return { [id]: Number(expected) };
  if (operator === '<') return { [id]: Number(expected) - 1 };
  if (operator === '<=') return { [id]: Number(expected) };
  return { [id]: expected };
}

function cliArguments(transition: FsmTransition): string[] {
  if (!transition.backendProcessId) return [];
  const procedure = project.procedures?.[transition.backendProcessId];
  return procedure?.steps.flatMap((step) => step.type === 'cli' ? [step.cliCommandId, ...(step.cliArgs ?? [])] : []) ?? [];
}

function staticReachability(): { paths: Map<string, string[]>; unreachable: string[] } {
  const paths = new Map<string, string[]>();
  if (!initialStateId) return { paths, unreachable: fsm.stateOrder };
  paths.set(initialStateId, []);
  const queue = [initialStateId];
  while (queue.length) {
    const stateId = queue.shift()!;
    for (const transitionId of fsm.transitionOrder) {
      const transition = fsm.transitions[transitionId];
      if (!transition || transition.from !== stateId || paths.has(transition.to)) continue;
      paths.set(transition.to, [...(paths.get(stateId) ?? []), transition.id]);
      queue.push(transition.to);
    }
  }
  return { paths, unreachable: fsm.stateOrder.filter((id) => !paths.has(id)) };
}

async function main(): Promise<void> {
  await mkdir(reportDir, { recursive: true });
  const rows: CoverageRow[] = [];

  for (const transitionId of fsm.transitionOrder) {
    const transition = fsm.transitions[transitionId];
    if (!transition) continue;
    const values = guardValues(transition.condition ?? transition.trigger.fact);
    const engine = createRuntimeEngine(project, { getGuardValues: () => values });
    engine.start(transition.from);
    const button = buttons.find((candidate) => candidate.fsmEventId === transition.trigger.eventId) ?? null;
    if (button) engine.pressButton(button.id);
    else engine.sendEvent(transition.trigger.eventId);
    const actual = engine.lastTransition;
    const passed = actual?.id === transition.id && engine.getCurrentScreen() !== null;
    const indistinguishable = fsm.transitionOrder
      .map((id) => fsm.transitions[id])
      .filter((candidate): candidate is FsmTransition => Boolean(candidate) &&
        candidate.from === transition.from &&
        candidate.trigger.eventId === transition.trigger.eventId &&
        candidate.trigger.mechanism === transition.trigger.mechanism &&
        candidate.trigger.buttonId === transition.trigger.buttonId &&
        !candidate.condition && !candidate.trigger.fact)
      .length > 1;
    rows.push({
      screen: project.fsm.states[transition.to]?.screenId ?? '',
      sourceState: transition.from,
      hmiControl: button?.id ?? null,
      event: transition.trigger.eventId,
      transition: transition.id,
      guard: transition.condition ?? transition.trigger.fact ?? null,
      tags: values,
      procedure: transition.backendProcessId ?? null,
      cliCommandArgs: cliArguments(transition),
      expectedResult: transition.to,
      actualResult: passed ? 'passed' : indistinguishable ? 'requires-user-decision' : 'failed',
      detail: passed ? 'Target state and its LCD screen opened.' : indistinguishable
        ? `Indistinguishable sibling route selected: ${actual?.id ?? 'no transition'}. No guard or input discriminator exists.`
        : `Runtime selected ${actual?.id ?? 'no transition'} instead of ${transition.id}.`
    });
  }

  const reachability = staticReachability();
  const coverage = {
    project: project.name,
    source: projectFile,
    generatedAt: new Date().toISOString(),
    totals: {
      transitions: rows.length,
      passed: rows.filter((row) => row.actualResult === 'passed').length,
      failed: rows.filter((row) => row.actualResult === 'failed').length,
      requiresUserDecision: rows.filter((row) => row.actualResult === 'requires-user-decision').length,
      hmiRoutes: rows.filter((row) => row.hmiControl).length,
      guardedRoutes: rows.filter((row) => row.guard).length
    },
    routes: rows
  };
  const reachabilityReport = {
    project: project.name,
    initialStateId,
    totals: { screens: fsm.stateOrder.length, reachable: reachability.paths.size, unreachable: reachability.unreachable.length },
    states: fsm.stateOrder.map((stateId) => ({
      stateId,
      screenId: fsm.states[stateId]?.screenId ?? null,
      reachable: reachability.paths.has(stateId),
      transitionPath: reachability.paths.get(stateId) ?? []
    }))
  };
  const markdownRows = rows.map((row) => `| ${row.screen} | ${row.hmiControl ?? 'runtime'} | ${row.transition} | ${row.guard ?? '—'} | ${Object.keys(row.tags).join(', ') || '—'} | ${row.procedure ?? '—'} | ${row.cliCommandArgs.join(' ') || '—'} | ${row.expectedResult} | ${row.actualResult} |`).join('\n');
  const ambiguousRoutes = rows.filter((row) => row.actualResult === 'requires-user-decision');
  writeFileSync(resolve(reportDir, 'e2e-coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`);
  writeFileSync(resolve(reportDir, 'e2e-coverage.md'), `# ECROS runtime coverage\n\n- Routes executed: ${coverage.totals.transitions}\n- Passed: ${coverage.totals.passed}\n- Failed: ${coverage.totals.failed}\n- Require user decision: ${coverage.totals.requiresUserDecision}\n- Guarded routes with injected tag context: ${coverage.totals.guardedRoutes}\n\n| Screen | HMI control | Transition | Guard | Tags | Procedure | CLI command/args | Expected result | Actual result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${markdownRows}\n`);
  writeFileSync(resolve(reportDir, 'reachability.json'), `${JSON.stringify(reachabilityReport, null, 2)}\n`);
  writeFileSync(resolve(reportDir, 'reachability.md'), `# ECROS reachability\n\n- Initial state: \`${initialStateId ?? 'none'}\`\n- States/screens: ${fsm.stateOrder.length}\n- Reachable by transition topology: ${reachability.paths.size}\n- Unreachable: ${reachability.unreachable.length}\n\n${reachability.unreachable.length ? `## Unreachable\n\n${reachability.unreachable.map((id) => `- \`${id}\``).join('\n')}` : 'All project states are reachable from the initial diagnostic state.'}\n`);
  const existingAmbiguities = readFileSync(resolve(reportDir, 'ambiguous-decisions.md'), 'utf8').split('\n---\n')[0];
  const routeDecisions = ambiguousRoutes.length
    ? `\n---\n\n# Runtime routing decisions\n\n${ambiguousRoutes.map((row, index) => `## Decision ${index + 1}: \`${row.sourceState}\` + \`${row.event}\`\n- **Transition:** \`${row.transition}\`\n- **Expected target:** \`${row.expectedResult}\`\n- **Conflict:** ${row.detail}\n- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.\n`).join('\n')}`
    : '';
  writeFileSync(resolve(reportDir, 'ambiguous-decisions.md'), `${existingAmbiguities}${routeDecisions}\n`);
  console.log(JSON.stringify({ coverage: coverage.totals, reachability: reachabilityReport.totals }, null, 2));
  if (coverage.totals.failed) process.exitCode = 1;
}

void main();

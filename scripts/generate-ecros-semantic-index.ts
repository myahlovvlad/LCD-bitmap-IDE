import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { migrateProject } from '../src/services/projectMigrationService';
import { buildProjectSemanticIndex } from '../src/services/semantic/semanticIndexBuilder';
import { renderSemanticReports } from '../src/services/semantic/semanticReport';

const inputPath = resolve(process.argv[2] ?? 'ECROS-5400UV/ECROS-5400UV_FSM_11-09-2026.lcdproj');
const outputDir = resolve(process.argv[3] ?? 'ECROS-5400UV/semantic');

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  const project = migrateProject(raw).project;
  const index = buildProjectSemanticIndex(project);
  const reports = renderSemanticReports(index);

  await mkdir(outputDir, { recursive: true });
  const outputs: Array<[string, string]> = [
    ['semantic-index.json', `${JSON.stringify(index, null, 2)}\n`],
    ['semantic-screen-index.md', `${reports.screens}\n`],
    ['semantic-state-index.md', `${reports.states}\n`],
    ['semantic-transition-index.md', `${reports.transitions}\n`],
    ['workflow-coverage.md', `${reports.workflowCoverage}\n`],
    ['orphan-screens.md', `${reports.orphanScreens}\n`],
    ['ambiguous-semantics.md', `${reports.ambiguousSemantics}\n`]
  ];

  for (const [name, content] of outputs) {
    const path = resolve(outputDir, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }

  const warningCount = index.diagnostics.filter((item) => item.severity === 'warning').length;
  const errorCount = index.diagnostics.filter((item) => item.severity === 'error').length;
  console.log(`Semantic index: ${index.screens.length} screens, ${index.states.length} states, ${index.transitions.length} transitions, ${index.workflows.length} workflows.`);
  console.log(`Diagnostics: ${errorCount} errors, ${warningCount} warnings, ${index.diagnostics.length - errorCount - warningCount} info.`);
  console.log(`Output: ${outputDir}`);
}

void main();

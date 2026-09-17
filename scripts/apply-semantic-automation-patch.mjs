import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`${path}: already patched`);
    return;
  }
  await writeFile(path, after, 'utf8');
  console.log(`${path}: patched`);
}

await patch('src/shared/automation/registry.ts', (source) => {
  if (source.includes("read('get_project_semantic_index'")) return source;
  const needle = "  read('get_project_ux_contract', 'Returns the project UX semantic contract (roles, intents, policies, goals, terminology, scenarios) and a coverage summary.'),";
  if (!source.includes(needle)) throw new Error('registry insertion point not found');
  return source.replace(needle, `${needle}\n  read('get_project_semantic_index', 'Returns the deterministic derived semantic index for screens, FSM states, transitions, controls, relations and ECROS workflows.'),\n  read('list_project_semantic_workflows', 'Returns deterministic semantic workflow summaries for the active project.'),\n  read('get_project_semantic_workflow', 'Returns one derived semantic workflow by id.', z.object({ workflowId: identifier }).strict()),`);
});

await patch('src/renderer/automation/automationDispatcher.ts', (source) => {
  let next = source;
  if (!next.includes("from '../../services/semantic/semanticIndexBuilder'")) {
    const importNeedle = "import { buildProjectUxGraph } from '../../services/ux/uxGraphBuilder';";
    if (!next.includes(importNeedle)) throw new Error('dispatcher import insertion point not found');
    next = next.replace(importNeedle, `${importNeedle}\nimport { buildProjectSemanticIndex } from '../../services/semantic/semanticIndexBuilder';`);
  }
  if (next.includes("case 'get_project_semantic_index':")) return next;
  const switchNeedle = "    case 'get_project_ux_contract': {";
  if (!next.includes(switchNeedle)) throw new Error('dispatcher switch insertion point not found');
  const cases = `    case 'get_project_semantic_index': {\n      if (!project) return blocked('automation.no-project', 'No project loaded');\n      return successful({ semanticIndex: buildProjectSemanticIndex(project) });\n    }\n    case 'list_project_semantic_workflows': {\n      if (!project) return blocked('automation.no-project', 'No project loaded');\n      const semanticIndex = buildProjectSemanticIndex(project);\n      return successful({ workflows: semanticIndex.workflows.map((workflow) => ({ id: workflow.id, title: workflow.title, mode: workflow.mode, stepCount: workflow.steps.length })) });\n    }\n    case 'get_project_semantic_workflow': {\n      if (!project) return blocked('automation.no-project', 'No project loaded');\n      const workflowId = input.workflowId as string;\n      const workflow = buildProjectSemanticIndex(project).workflows.find((item) => item.id === workflowId);\n      return workflow ? successful({ workflow }) : failed('automation.semantic-workflow-not-found', \`Semantic workflow not found: \${workflowId}\`);\n    }\n`;
  return next.replace(switchNeedle, `${cases}${switchNeedle}`);
});

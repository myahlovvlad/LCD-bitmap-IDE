import type { ProjectSemanticIndex, SemanticIndexDiagnostic } from '../../domain/semanticIndex';

function esc(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(esc).join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  return [head, rule, ...rows.map((row) => `| ${row.map(esc).join(' | ')} |`)].join('\n');
}

function diagnosticsTable(items: SemanticIndexDiagnostic[]): string {
  if (!items.length) return '_No diagnostics._';
  return table(['Severity', 'Code', 'Entity', 'Workflow', 'Step', 'Message'], items.map((item) => [
    item.severity, item.code, item.entityId ?? '', item.workflowId ?? '', item.stepId ?? '', item.message
  ]));
}

export interface SemanticReports {
  screens: string;
  states: string;
  transitions: string;
  workflowCoverage: string;
  orphanScreens: string;
  ambiguousSemantics: string;
}

export function renderSemanticReports(index: ProjectSemanticIndex): SemanticReports {
  const screens = [
    '# Semantic Screen Index', '',
    table(['Screen', 'Name', 'Role', 'States', 'Mode', 'Phase', 'Operation', 'Objects'], index.screens.map((item) => [
      item.screenId, item.name, item.role, item.stateIds.join(', '), item.classification?.mode ?? '', item.classification?.phase ?? '', item.classification?.operation ?? '', String(item.layout.objects.length)
    ]))
  ].join('\n');

  const states = [
    '# Semantic State Index', '',
    table(['State', 'Title', 'Screen', 'Domain', 'Mode', 'Phase', 'Quantity', 'Operation', 'Input', 'Workflows'], index.states.map((item) => [
      item.stateId, item.title, item.screenId ?? '', item.classification.domain, item.classification.mode ?? '', item.classification.phase,
      item.classification.quantity ?? '', item.classification.operation, item.classification.inputKind ?? '',
      item.workflowRefs.map((ref) => `${ref.workflowId}/${ref.stepId}`).join(', ')
    ]))
  ].join('\n');

  const transitions = [
    '# Semantic Transition Index', '',
    table(['Transition', 'From', 'To', 'Event', 'Mechanism', 'Controls', 'Intent', 'Backend process'], index.transitions.map((item) => [
      item.transitionId, item.from, item.to, item.eventId, item.mechanism, item.controlIds.join(', '), item.intent, item.backendProcessId ?? ''
    ]))
  ].join('\n');

  const workflowRows: string[][] = [];
  for (const workflow of index.workflows) {
    for (const step of workflow.steps) workflowRows.push([
      workflow.id, step.id, step.title, step.operation, step.branch ?? '', step.stateIds.join(', '), step.screenIds.join(', '), step.next.join(', ')
    ]);
  }
  const workflowCoverage = [
    '# Workflow Coverage', '',
    workflowRows.length ? table(['Workflow', 'Step', 'Title', 'Operation', 'Branch', 'States', 'Screens', 'Next'], workflowRows) : '_No semantic workflows are active for this project._',
    '', '## Workflow diagnostics', '',
    diagnosticsTable(index.diagnostics.filter((item) => item.code.startsWith('semantic.workflow')))
  ].join('\n');

  const orphanScreens = [
    '# Orphan Screens', '',
    diagnosticsTable(index.diagnostics.filter((item) => item.code === 'semantic.screen-state-missing' || item.code === 'semantic.state-screen-missing'))
  ].join('\n');

  const ambiguousSemantics = [
    '# Ambiguous Semantics', '',
    diagnosticsTable(index.diagnostics.filter((item) => item.code.includes('unclassified') || item.code.includes('ambiguous') || item.code.includes('unresolved')))
  ].join('\n');

  return { screens, states, transitions, workflowCoverage, orphanScreens, ambiguousSemantics };
}

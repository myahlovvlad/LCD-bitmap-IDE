import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { buildProjectSemanticIndex } from '../../src/services/semantic/semanticIndexBuilder';
import { renderSemanticReports } from '../../src/services/semantic/semanticReport';

describe('semantic reports', () => {
  it('renders deterministic screen/state/transition/workflow/diagnostic reports', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const index = buildProjectSemanticIndex(project);
    const first = renderSemanticReports(index);
    const second = renderSemanticReports(index);
    expect(first).toEqual(second);
    expect(first.screens).toContain('# Semantic Screen Index');
    expect(first.states).toContain('# Semantic State Index');
    expect(first.transitions).toContain('# Semantic Transition Index');
    expect(first.workflowCoverage).toContain('# Workflow Coverage');
    expect(first.orphanScreens).toContain('# Orphan Screens');
    expect(first.ambiguousSemantics).toContain('# Ambiguous Semantics');
  });
});

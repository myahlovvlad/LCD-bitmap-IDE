import type { UxFindingSeverity } from '../../domain/uxContract';

export type UxFindingCategory =
  | 'structure'
  | 'behavior'
  | 'semantics'
  | 'terminology'
  | 'safety'
  | 'recovery'
  | 'scenario'
  | 'visual'
  | 'traceability';

export interface UxFindingAffected {
  screenIds?: string[];
  stateIds?: string[];
  transitionIds?: string[];
  controlIds?: string[];
  elementIds?: string[];
  goalIds?: string[];
  scenarioIds?: string[];
}

export interface UxValidationFinding {
  id: string;
  ruleId: string;
  category: UxFindingCategory;
  severity: UxFindingSeverity;
  message: string;
  rationale?: string;
  remediation?: string;
  affected: UxFindingAffected;
  evidence?: Record<string, unknown>;
  /** Deterministic rule output by default; heuristic findings imported via import_project_ux_review
   *  are tagged 'heuristic_llm' and can never be blocking (see docs/UX_SEMANTIC_VALIDATION.md). */
  source?: 'deterministic' | 'heuristic_llm';
}

function firstAffectedId(affected: UxFindingAffected): string {
  return (
    affected.stateIds?.[0] ??
    affected.transitionIds?.[0] ??
    affected.controlIds?.[0] ??
    affected.screenIds?.[0] ??
    affected.goalIds?.[0] ??
    affected.scenarioIds?.[0] ??
    affected.elementIds?.[0] ??
    'unscoped'
  );
}

export function makeFinding(params: {
  ruleId: string;
  category: UxFindingCategory;
  severity: UxFindingSeverity;
  message: string;
  affected: UxFindingAffected;
  rationale?: string;
  remediation?: string;
  evidence?: Record<string, unknown>;
}): UxValidationFinding {
  return {
    id: `${params.ruleId}:${firstAffectedId(params.affected)}`,
    ruleId: params.ruleId,
    category: params.category,
    severity: params.severity,
    message: params.message,
    rationale: params.rationale,
    remediation: params.remediation,
    affected: params.affected,
    evidence: params.evidence,
    source: 'deterministic'
  };
}

export function sortFindings(findings: UxValidationFinding[]): UxValidationFinding[] {
  return [...findings].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    return a.id.localeCompare(b.id);
  });
}

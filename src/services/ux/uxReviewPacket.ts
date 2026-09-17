/**
 * Optional, non-blocking LLM UX review channel (Part F). Building a packet never requires cloud
 * access; importing a response validates it structurally and tags every finding
 * `source: 'heuristic_llm'`. The severity enum below deliberately excludes 'error' so an
 * LLM-sourced finding can never be blocking by construction. Nothing here is persisted to the
 * project — see docs/UX_SEMANTIC_VALIDATION.md for the authority/isolation rationale.
 */
import { z } from 'zod';
import { exportFsmScript } from '../../application/fsmRoundTrip/fsmRoundTripFacade';
import { exportSessionScreenInterchangeScreen } from '../../application/screenInterchangeFacade';
import type { ProjectSession } from '../../application/projectSession';
import type { ProjectUxContract, ScreenRole } from '../../domain/uxContract';
import { screenInterchangeToHtml } from '../../screen-html';
import { buildProjectUxGraph, type UxVisibleText } from './uxGraphBuilder';
import type { ProjectUxAnalysisReport } from './uxValidator';
import type { UxValidationFinding } from './uxTypes';

export const uxReviewFindingSchema = z.object({
  ruleId: z.string().optional(),
  category: z.enum([
    'structure', 'behavior', 'semantics', 'terminology', 'safety', 'recovery', 'scenario', 'visual', 'traceability'
  ]),
  severity: z.enum(['suggestion', 'info', 'warning', 'needs_human_review']),
  message: z.string().min(1),
  rationale: z.string().optional(),
  affected: z.object({
    screenIds: z.array(z.string()).optional(),
    stateIds: z.array(z.string()).optional(),
    transitionIds: z.array(z.string()).optional(),
    controlIds: z.array(z.string()).optional(),
    elementIds: z.array(z.string()).optional(),
    goalIds: z.array(z.string()).optional(),
    scenarioIds: z.array(z.string()).optional()
  }).default({}),
  confidence: z.enum(['low', 'medium', 'high']).optional()
}).strict();

export const uxReviewResponseSchema = z.object({
  findings: z.array(uxReviewFindingSchema).max(200)
}).strict();

export type UxReviewResponse = z.infer<typeof uxReviewResponseSchema>;

const REVIEWER_INSTRUCTIONS = [
  'You are reviewing the UX of an embedded LCD/HMI operator workflow. Use only the facts in this',
  'packet — never invent screens, states, controls, or behavior that is not represented here.',
  'Identify contradictions, ambiguity, cognitive load, unclear terminology, inappropriate action',
  'sequencing, missing recovery paths, unsafe confirmation placement, and mismatches between a',
  "screen's stated role and its actual controls.",
  'For every finding, cite the exact screen/state/transition/control ids it concerns.',
  "Separate observed fact ('message') from recommendation ('rationale'); do not blend them.",
  "Mark uncertain findings with severity 'needs_human_review' or a low confidence value — never",
  'upgrade a guess to a stronger severity to seem more useful.',
  "You may never emit severity 'error': this channel is advisory-only and cannot block anything.",
  'Return strict JSON only, matching the provided JSON Schema exactly — no prose, no markdown fences.'
].join(' ');

export interface UxReviewPacket {
  version: 1;
  generatedAt: string;
  projectPurpose?: string;
  intendedUsers?: string[];
  uxContract: ProjectUxContract;
  graphSummary: ProjectUxAnalysisReport['graphSummary'];
  screens: { screenId: string; name: string; role: ScreenRole; html: string }[];
  visibleTexts: UxVisibleText[];
  fsmMermaid: string;
  deterministicReport: ProjectUxAnalysisReport;
  scenarioTraces?: ProjectUxAnalysisReport['scenarioResults'];
  reviewerInstructions: string;
  responseJsonSchema: unknown;
}

export function buildUxReviewPacket(
  session: ProjectSession,
  report: ProjectUxAnalysisReport,
  options: { screenIds?: string[] } = {}
): UxReviewPacket {
  const graph = buildProjectUxGraph(session.project);
  const screenIds = options.screenIds ?? graph.screens.map((s) => s.screenId);
  const screens = screenIds
    .filter((id) => session.project.screens[id])
    .map((screenId) => {
      const exported = exportSessionScreenInterchangeScreen(session, screenId);
      const html = screenInterchangeToHtml(exported.package, screenId);
      const node = graph.screensById.get(screenId);
      return { screenId, name: node?.name ?? screenId, role: node?.role ?? 'unknown', html };
    });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    projectPurpose: graph.contract.projectPurpose,
    intendedUsers: graph.contract.intendedUsers,
    uxContract: graph.contract,
    graphSummary: report.graphSummary,
    screens,
    visibleTexts: graph.visibleTexts,
    fsmMermaid: exportFsmScript(session, 'mermaid'),
    deterministicReport: report,
    scenarioTraces: report.scenarioResults,
    reviewerInstructions: REVIEWER_INSTRUCTIONS,
    responseJsonSchema: z.toJSONSchema(uxReviewResponseSchema)
  };
}

export interface ImportUxReviewResult {
  findings: UxValidationFinding[];
  diagnostics: { code: string; message: string }[];
}

export function importUxReview(raw: unknown): ImportUxReviewResult {
  const parsed = uxReviewResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      findings: [],
      diagnostics: parsed.error.issues.map((issue) => ({
        code: 'ux.review.invalid-response',
        message: `${issue.path.join('.') || '(root)'}: ${issue.message}`
      }))
    };
  }
  const findings: UxValidationFinding[] = parsed.data.findings.map((finding, index) => ({
    id: `heuristic:${finding.ruleId ?? 'unranked'}:${index}`,
    ruleId: finding.ruleId ?? 'ux.heuristic-review',
    category: finding.category,
    severity: finding.severity,
    message: finding.message,
    rationale: finding.rationale,
    affected: finding.affected,
    evidence: finding.confidence ? { confidence: finding.confidence } : undefined,
    source: 'heuristic_llm'
  }));
  return { findings, diagnostics: [] };
}

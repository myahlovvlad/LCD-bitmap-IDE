import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { useProjectStore } from '../../src/renderer/store/projectStore';
import { analyzeProjectUx } from '../../src/services/ux/uxValidator';
import { buildUxReviewPacket, importUxReview, uxReviewResponseSchema } from '../../src/services/ux/uxReviewPacket';

describe('buildUxReviewPacket', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProjectSnapshot(migrateLegacySnapshot(createDemoProject()));
  });

  it('builds a self-contained packet with screens, FSM mermaid, and a JSON schema', async () => {
    const session = useProjectStore.getState().session!;
    const report = await analyzeProjectUx(session.project);
    const packet = buildUxReviewPacket(session, report);

    expect(packet.version).toBe(1);
    expect(packet.screens.length).toBeGreaterThan(0);
    expect(packet.screens[0].html).toContain('data-lcd-format');
    expect(packet.fsmMermaid).toContain('stateDiagram-v2');
    expect(packet.deterministicReport.findings).toEqual(report.findings);
    expect(packet.responseJsonSchema).toBeTruthy();
    expect(typeof packet.reviewerInstructions).toBe('string');
    expect(packet.reviewerInstructions).toContain('strict JSON');
  });

  it('scopes to the requested screen ids only', async () => {
    const session = useProjectStore.getState().session!;
    const report = await analyzeProjectUx(session.project);
    const firstScreenId = session.project.screenOrder[0];
    const packet = buildUxReviewPacket(session, report, { screenIds: [firstScreenId] });
    expect(packet.screens).toHaveLength(1);
    expect(packet.screens[0].screenId).toBe(firstScreenId);
  });
});

describe('importUxReview', () => {
  it('accepts a well-formed response and tags findings as heuristic_llm', () => {
    const result = importUxReview({
      findings: [{
        category: 'semantics',
        severity: 'warning',
        message: 'The "Save" label is ambiguous on this screen.',
        affected: { screenIds: ['main-menu'] }
      }]
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].source).toBe('heuristic_llm');
    expect(result.findings[0].severity).toBe('warning');
  });

  it('rejects malformed input structurally instead of throwing', () => {
    expect(() => importUxReview({ findings: 'not-an-array' })).not.toThrow();
    const result = importUxReview({ findings: 'not-an-array' });
    expect(result.findings).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('ux.review.invalid-response');
  });

  it('rejects a response that tries to smuggle in severity "error"', () => {
    const parsed = uxReviewResponseSchema.safeParse({
      findings: [{ category: 'safety', severity: 'error', message: 'x', affected: {} }]
    });
    expect(parsed.success).toBe(false);
  });
});

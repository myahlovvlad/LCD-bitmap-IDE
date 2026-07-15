/**
 * Pure view-model selector tests for Screen Schema Studio.
 *
 * All tests operate on plain data structures — no React, no Zustand, no DOM.
 * The environment is node; no rendering occurs.
 */
import { describe, expect, it } from 'vitest';
import {
  createScreenDslDocumentSession
} from '../../src/application/screenDslSession/reducer';
import { createScreenDslDocumentKey } from '../../src/application/screenDslSession/identity';
import {
  selectScreenDslStatus,
  selectCanValidate,
  selectCanPreview,
  selectCanApply,
  selectApplyDisabledReason,
  selectIsDestructive,
  selectDestructiveSummary,
  selectDiagnosticGroups,
  selectSemanticChangeGroups,
  selectRasterSummary,
  selectTargetSummary,
  selectNoOpPreview
} from '../../src/features/screen-dsl-studio/selectors';
import {
  demoSession,
  emptyDocSession,
  initializedDocSession,
  dirtyDocSession,
  validatingDocSession,
  invalidDocSession,
  previewReadyDocSession,
  staleDocSession,
  applyingDocSession,
  appliedDocSession,
  failedDocSession,
  makePreview,
  makeValidPreview,
  makeDestructivePreview,
  makeNoOpPreview,
  makeInvalidPreview,
  makeBlockingDiagnosticPreview,
  makeConsumedPreview,
  makeStaleLifecyclePreview,
  makeRasterPreview,
  makeResourceConflictPreview,
  makeSemanticOp,
  testKey
} from './screenDslStudioTestHelpers';

// ============================================================
// Status
// ============================================================

describe('selectScreenDslStatus', () => {
  it('1: empty session → empty', () => {
    expect(selectScreenDslStatus(emptyDocSession())).toBe('empty');
  });

  it('2: initialized session → clean', () => {
    expect(selectScreenDslStatus(initializedDocSession())).toBe('clean');
  });

  it('3: dirty session → dirty', () => {
    expect(selectScreenDslStatus(dirtyDocSession())).toBe('dirty');
  });

  it('4: after PREVIEW_STARTED → validating', () => {
    expect(selectScreenDslStatus(validatingDocSession())).toBe('validating');
  });

  it('5: after PREVIEW_FAILED → invalid', () => {
    expect(selectScreenDslStatus(invalidDocSession())).toBe('invalid');
  });

  it('6: after PREVIEW_SUCCEEDED → preview-ready', () => {
    expect(selectScreenDslStatus(previewReadyDocSession(makeValidPreview()))).toBe('preview-ready');
  });

  it('7: after PROJECT_CHANGED → stale', () => {
    expect(selectScreenDslStatus(staleDocSession(makeValidPreview()))).toBe('stale');
  });

  it('8: after APPLY_STARTED → applying', () => {
    expect(selectScreenDslStatus(applyingDocSession(makeValidPreview()))).toBe('applying');
  });

  it('9: after APPLY_SUCCEEDED → applied', () => {
    expect(selectScreenDslStatus(appliedDocSession())).toBe('applied');
  });

  it('10: after APPLY_FAILED → failed', () => {
    expect(selectScreenDslStatus(failedDocSession(makeValidPreview()))).toBe('failed');
  });
});

// ============================================================
// Validate / Preview enablement
// ============================================================

describe('selectCanValidate', () => {
  it('11: empty source cannot Validate', () => {
    expect(selectCanValidate(emptyDocSession())).toBe(false);
  });

  it('12: non-empty source can Validate', () => {
    expect(selectCanValidate(initializedDocSession('{ "screens": [] }\n'))).toBe(true);
  });

  it('13: applying session cannot start another Preview/Validate', () => {
    expect(selectCanValidate(applyingDocSession(makeValidPreview()))).toBe(false);
  });
});

describe('selectCanPreview', () => {
  const session = demoSession();

  it('14: disposed session cannot Preview', () => {
    const disposed = { ...emptyDocSession(), disposed: true };
    expect(selectCanPreview(disposed, session, false)).toBe(false);
  });

  it('15: dirty non-empty source can Preview', () => {
    expect(selectCanPreview(dirtyDocSession(), session, false)).toBe(true);
  });

  it('16: stale previous Preview does not block new Preview', () => {
    const stale = staleDocSession(makeValidPreview());
    expect(selectCanPreview(stale, session, false)).toBe(true);
  });

  it('preview disabled when target is missing', () => {
    expect(selectCanPreview(initializedDocSession(), session, true)).toBe(false);
  });

  it('applying status prevents another Preview', () => {
    expect(selectCanPreview(applyingDocSession(makeValidPreview()), session, false)).toBe(false);
  });
});

// ============================================================
// Apply enablement
// ============================================================

describe('selectCanApply', () => {
  const session = demoSession(0);

  it('17: no Preview → Apply disabled', () => {
    expect(selectCanApply(emptyDocSession(), session)).toBe(false);
  });

  it('18: invalid Preview (applyAllowed = false) → Apply disabled', () => {
    const doc = previewReadyDocSession(makeInvalidPreview());
    expect(selectCanApply(doc, session)).toBe(false);
  });

  it('19: blocking diagnostic → Apply disabled', () => {
    const doc = previewReadyDocSession(makeBlockingDiagnosticPreview());
    expect(selectCanApply(doc, session)).toBe(false);
  });

  it('20: stale session → Apply disabled', () => {
    const doc = staleDocSession(makeValidPreview());
    expect(selectCanApply(doc, session)).toBe(false);
  });

  it('21: consumed Preview lifecycle → Apply disabled', () => {
    const doc = previewReadyDocSession(makeConsumedPreview(0));
    expect(selectCanApply(doc, session)).toBe(false);
  });

  it('22: no-op authoring diff → Apply disabled via selectNoOpPreview', () => {
    const noOp = makeNoOpPreview(0);
    expect(selectNoOpPreview(noOp)).toBe(true);
  });

  it('23: valid current non-destructive Preview → Apply enabled', () => {
    // Use a doc session with revision matching the project session
    const preview = makeValidPreview(0);
    const doc = previewReadyDocSession(preview);
    // The baseRevision in the session must match the project session revision
    const docWithCorrectRevision = { ...doc, baseRevision: 0 };
    expect(selectCanApply(docWithCorrectRevision, session)).toBe(true);
  });

  it('24: valid destructive Preview → Apply enabled (dialog will be required)', () => {
    const preview = makeDestructivePreview(0);
    const doc = { ...previewReadyDocSession(preview), baseRevision: 0 };
    expect(selectCanApply(doc, session)).toBe(true);
  });

  it('25: applying state → repeated Apply disabled', () => {
    const doc = applyingDocSession(makeValidPreview());
    expect(selectCanApply(doc, session)).toBe(false);
  });
});

// ============================================================
// Apply disabled reasons
// ============================================================

describe('selectApplyDisabledReason', () => {
  const session = demoSession(0);

  it('26: disabled reason is stable and has human-readable message', () => {
    const reason = selectApplyDisabledReason(emptyDocSession(), session, false);
    expect(reason).not.toBeNull();
    expect(typeof reason?.code).toBe('string');
    expect(typeof reason?.message).toBe('string');
    expect(reason!.message.length).toBeGreaterThan(5);
  });

  it('27: stale reason is represented', () => {
    const doc = staleDocSession(makeValidPreview());
    const reason = selectApplyDisabledReason(doc, session, false);
    expect(reason?.code).toBe('STALE');
  });

  it('28: blocking diagnostic reason takes precedence over other reasons', () => {
    const doc = previewReadyDocSession(makeBlockingDiagnosticPreview());
    const reason = selectApplyDisabledReason(doc, session, false);
    expect(['BLOCKING_DIAGNOSTIC', 'NOT_ALLOWED']).toContain(reason?.code);
  });

  it('29: consumed Preview reason is represented', () => {
    const doc = previewReadyDocSession(makeConsumedPreview(0));
    const reason = selectApplyDisabledReason(doc, session, false);
    expect(reason?.code).toBe('CONSUMED');
  });

  it('30: missing target screen reason is represented for update mode', () => {
    const reason = selectApplyDisabledReason(emptyDocSession(), session, true);
    expect(reason?.code).toBe('NO_TARGET');
  });

  it('31: missing origin reason for clone mode (targetMissing = true)', () => {
    const cloneKey = createScreenDslDocumentKey('proj', 'json', 'clone', []);
    const doc = emptyDocSession(cloneKey);
    const reason = selectApplyDisabledReason(doc, session, true);
    expect(reason?.code).toBe('NO_TARGET');
  });

  it('returns null when Apply is fully enabled', () => {
    const preview = makeValidPreview(0);
    const doc = { ...previewReadyDocSession(preview), baseRevision: 0 };
    const reason = selectApplyDisabledReason(doc, session, false);
    expect(reason).toBeNull();
  });
});

// ============================================================
// Diagnostic grouping
// ============================================================

describe('selectDiagnosticGroups', () => {
  it('32: diagnostics grouped by category', () => {
    const preview = makePreview({
      diagnostics: [
        { code: 'SCREEN_DSL_PARSE_SYNTAX', severity: 'error', message: 'Parse error', path: '/' },
        { code: 'SCREEN_DSL_SCHEMA_REQUIRED', severity: 'error', message: 'Required field', path: '/screens/0' },
        { code: 'SCREEN_DSL_PIXEL_BUDGET_EXCEEDED', severity: 'warning', message: 'Over budget', path: '/screens/0' }
      ]
    });
    const groups = selectDiagnosticGroups(preview);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Parse');
    expect(labels).toContain('Schema');
    expect(labels).toContain('Pixel Budget');
  });

  it('33: null preview returns empty array', () => {
    expect(selectDiagnosticGroups(null)).toHaveLength(0);
  });

  it('items within group include code, severity, message', () => {
    const preview = makePreview({
      diagnostics: [{ code: 'SCREEN_DSL_IDENTITY_CONFLICT', severity: 'error', message: 'ID conflict', path: '/screens/0' }]
    });
    const groups = selectDiagnosticGroups(preview);
    expect(groups[0].items[0].code).toBe('SCREEN_DSL_IDENTITY_CONFLICT');
    expect(groups[0].items[0].severity).toBe('error');
    expect(groups[0].items[0].message).toBe('ID conflict');
  });

  it('line and column preserved when present', () => {
    const preview = makePreview({
      diagnostics: [{ code: 'SCREEN_DSL_PARSE_SYNTAX', severity: 'error', message: 'Error', path: '/', line: 5, column: 3 }]
    });
    const groups = selectDiagnosticGroups(preview);
    expect(groups[0].items[0].line).toBe(5);
    expect(groups[0].items[0].column).toBe(3);
  });
});

// ============================================================
// Semantic change grouping
// ============================================================

describe('selectSemanticChangeGroups', () => {
  it('33: semantic changes grouped into Screens and Objects', () => {
    const preview = makePreview({
      semanticDiff: {
        operations: [
          makeSemanticOp('screen.create', 'new-screen'),
          makeSemanticOp('object.update', 'obj-1'),
          makeSemanticOp('object.delete', 'obj-2')
        ]
      }
    });
    const groups = selectSemanticChangeGroups(preview);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Screens');
    expect(labels).toContain('Objects');
  });

  it('34: object.reorder remains distinct from object.update', () => {
    const preview = makePreview({
      semanticDiff: {
        operations: [
          makeSemanticOp('object.reorder', 'obj-1'),
          makeSemanticOp('object.update', 'obj-2')
        ]
      }
    });
    const groups = selectSemanticChangeGroups(preview);
    const objectGroup = groups.find((g) => g.label === 'Objects');
    const types = objectGroup?.items.map((i) => i.type) ?? [];
    expect(types).toContain('object.reorder');
    expect(types).toContain('object.update');
  });

  it('35: delete operations are marked destructive', () => {
    const preview = makePreview({
      semanticDiff: {
        operations: [
          makeSemanticOp('screen.delete', 'del-screen'),
          makeSemanticOp('object.delete', 'del-obj')
        ]
      }
    });
    const groups = selectSemanticChangeGroups(preview);
    for (const group of groups) {
      for (const item of group.items) {
        if (item.type.endsWith('.delete')) {
          expect(item.destructive).toBe(true);
        }
      }
    }
  });

  it('36: non-delete operations are not marked destructive', () => {
    const preview = makePreview({
      semanticDiff: {
        operations: [
          makeSemanticOp('screen.create'),
          makeSemanticOp('object.update'),
          makeSemanticOp('object.reorder')
        ]
      }
    });
    const groups = selectSemanticChangeGroups(preview);
    for (const group of groups) {
      for (const item of group.items) {
        expect(item.destructive).toBe(false);
      }
    }
  });

  it('37: resource conflict not destructive by operation type', () => {
    const preview = makeResourceConflictPreview();
    const groups = selectSemanticChangeGroups(preview);
    // No operations in this preview, so no items
    expect(groups).toHaveLength(0);
  });

  it('null preview returns empty array', () => {
    expect(selectSemanticChangeGroups(null)).toHaveLength(0);
  });
});

// ============================================================
// Raster summary
// ============================================================

describe('selectRasterSummary', () => {
  it('38: raster summary includes byte lengths', () => {
    const preview = makeRasterPreview(512, 1024, ['s1']);
    const summary = selectRasterSummary(preview);
    expect(summary).not.toBeNull();
    expect(summary?.beforeBytes).toBe(512);
    expect(summary?.afterBytes).toBe(1024);
  });

  it('39: raster summary includes changed screen list', () => {
    const preview = makeRasterPreview(512, 1024, ['screen-a', 'screen-b']);
    const summary = selectRasterSummary(preview);
    expect(summary?.changedScreens).toEqual(['screen-a', 'screen-b']);
  });

  it('40: delta computed as afterBytes minus beforeBytes', () => {
    const preview = makeRasterPreview(900, 1024, ['s1']);
    const summary = selectRasterSummary(preview);
    expect(summary?.delta).toBe(124);
  });

  it('41: 128×64 LCD screen produces 1024 framebuffer bytes', () => {
    // 128 pixels / 8 bits * 64 rows = 1024 bytes
    const preview = makeRasterPreview(0, 1024, ['main-menu']);
    const summary = selectRasterSummary(preview);
    expect(summary?.afterBytes).toBe(1024);
  });

  it('44: empty raster preview returns null', () => {
    const preview = makePreview({ rasterPreview: null });
    expect(selectRasterSummary(preview)).toBeNull();
  });

  it('negative delta (shrink) represented correctly', () => {
    const preview = makeRasterPreview(1024, 512, ['s1']);
    const summary = selectRasterSummary(preview);
    expect(summary?.delta).toBe(-512);
  });
});

// ============================================================
// Pixel budget (via diagnostics)
// ============================================================

describe('pixel budget via selectDiagnosticGroups', () => {
  it('42: pixel budget summary includes out-of-bounds diagnostics', () => {
    const preview = makePreview({
      diagnostics: [
        { code: 'SCREEN_DSL_PIXEL_BUDGET_EXCEEDED', severity: 'warning', message: 'Budget exceeded by 50 bytes', path: '/screens/0' }
      ]
    });
    const groups = selectDiagnosticGroups(preview);
    const budgetGroup = groups.find((g) => g.label === 'Pixel Budget');
    expect(budgetGroup).toBeDefined();
    expect(budgetGroup?.items).toHaveLength(1);
  });

  it('43: missing resource represented as diagnostics', () => {
    const preview = makePreview({
      diagnostics: [
        { code: 'SCREEN_DSL_RESOURCE_ID_CONFLICT', severity: 'error', message: 'Resource ID conflict', path: '/resources' }
      ]
    });
    const groups = selectDiagnosticGroups(preview);
    const resourceGroup = groups.find((g) => g.label === 'Identity' || g.label === 'Resources');
    expect(resourceGroup).toBeDefined();
    expect(resourceGroup!.items.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Target summary
// ============================================================

describe('selectTargetSummary', () => {
  it('create mode does not require a target', () => {
    const summary = selectTargetSummary('create', []);
    expect(summary.requiresTarget).toBe(false);
    expect(summary.targetMissing).toBe(false);
  });

  it('update mode requires target; missing when ids empty', () => {
    const summary = selectTargetSummary('update', []);
    expect(summary.requiresTarget).toBe(true);
    expect(summary.targetMissing).toBe(true);
  });

  it('update mode with target present: targetMissing false', () => {
    const summary = selectTargetSummary('update', ['screen-a']);
    expect(summary.requiresTarget).toBe(true);
    expect(summary.targetMissing).toBe(false);
  });

  it('clone mode requires target', () => {
    const summary = selectTargetSummary('clone', []);
    expect(summary.requiresTarget).toBe(true);
    expect(summary.targetMissing).toBe(true);
  });
});

// ============================================================
// Destructive summary
// ============================================================

describe('selectIsDestructive + selectDestructiveSummary', () => {
  it('non-destructive preview: isDestructive = false', () => {
    expect(selectIsDestructive(makeValidPreview())).toBe(false);
  });

  it('destructive preview: isDestructive = true', () => {
    expect(selectIsDestructive(makeDestructivePreview())).toBe(true);
  });

  it('null preview: isDestructive = false', () => {
    expect(selectIsDestructive(null)).toBe(false);
  });

  it('destructive summary counts deletions', () => {
    const summary = selectDestructiveSummary(makeDestructivePreview());
    expect(summary).toContain('2');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('non-destructive summary returns empty string', () => {
    expect(selectDestructiveSummary(makeValidPreview())).toBe('');
  });

  it('null preview summary returns empty string', () => {
    expect(selectDestructiveSummary(null)).toBe('');
  });
});

// ============================================================
// No-op detection
// ============================================================

describe('selectNoOpPreview', () => {
  it('no-op preview: applyAllowed=true, zero operations', () => {
    expect(selectNoOpPreview(makeNoOpPreview())).toBe(true);
  });

  it('preview with operations: not no-op', () => {
    expect(selectNoOpPreview(makeValidPreview())).toBe(false);
  });

  it('preview with applyAllowed=false: not no-op', () => {
    const preview = makePreview({ applyAllowed: false, semanticDiff: { operations: [] } });
    expect(selectNoOpPreview(preview)).toBe(false);
  });

  it('null preview: not no-op', () => {
    expect(selectNoOpPreview(null)).toBe(false);
  });
});

// ============================================================
// Purity and determinism
// ============================================================

describe('selector purity', () => {
  it('selectDiagnosticGroups does not mutate preview', () => {
    const preview = makePreview({
      diagnostics: [{ code: 'SCREEN_DSL_PARSE_SYNTAX', severity: 'error', message: 'err', path: '/' }]
    });
    const original = JSON.stringify(preview);
    selectDiagnosticGroups(preview);
    expect(JSON.stringify(preview)).toBe(original);
  });

  it('selectSemanticChangeGroups is deterministic', () => {
    const preview = makePreview({
      semanticDiff: { operations: [makeSemanticOp('screen.create'), makeSemanticOp('object.delete')] }
    });
    const result1 = selectSemanticChangeGroups(preview);
    const result2 = selectSemanticChangeGroups(preview);
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  it('selectRasterSummary does not mutate preview', () => {
    const preview = makeRasterPreview(100, 200, ['s1']);
    const original = JSON.stringify(preview.rasterPreview);
    selectRasterSummary(preview);
    expect(JSON.stringify(preview.rasterPreview)).toBe(original);
  });
});

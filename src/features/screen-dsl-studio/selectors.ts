import type { ScreenDslDocumentSession } from '../../application/screenDslSession/contracts';
import type { ScreenDslPreviewResult } from '../../application/screenDsl/contracts';
import type { ScreenDslImportMode } from '../../screen-dsl';
import type { ProjectSession } from '../../application';

export type ScreenDslStudioStatus =
  | 'empty'
  | 'clean'
  | 'dirty'
  | 'validating'
  | 'invalid'
  | 'preview-ready'
  | 'stale'
  | 'applying'
  | 'applied'
  | 'failed';

export interface ScreenDslApplyDisabledReason {
  code: string;
  message: string;
}

export interface ScreenDslDiagnosticGroup {
  label: string;
  items: Array<{
    code: string;
    severity: 'error' | 'warning';
    message: string;
    line?: number;
    column?: number;
    path: string;
  }>;
}

export interface ScreenDslSemanticGroup {
  label: string;
  destructive: boolean;
  items: Array<{
    type: string;
    id: string;
    path: string;
    destructive: boolean;
  }>;
}

export interface ScreenDslRasterSummary {
  beforeBytes: number;
  afterBytes: number;
  changedScreens: readonly string[];
  delta: number;
  hasChanges: boolean;
}

export interface ScreenDslTargetSummary {
  importMode: ScreenDslImportMode;
  targetScreenIds: readonly string[];
  requiresTarget: boolean;
  targetMissing: boolean;
}

export function selectScreenDslStatus(docSession: ScreenDslDocumentSession): ScreenDslStudioStatus {
  return docSession.status as ScreenDslStudioStatus;
}

export function selectCanValidate(docSession: ScreenDslDocumentSession): boolean {
  return docSession.sourceText.trim().length > 0 && docSession.status !== 'applying';
}

export function selectCanPreview(
  docSession: ScreenDslDocumentSession,
  projectSession: ProjectSession,
  targetMissing: boolean
): boolean {
  if (docSession.sourceText.trim().length === 0) return false;
  if (docSession.status === 'applying') return false;
  if (targetMissing) return false;
  return true;
}

export function selectCanApply(
  docSession: ScreenDslDocumentSession,
  projectSession: ProjectSession
): boolean {
  if (!docSession.preview) return false;
  if (docSession.preview.lifecycle !== 'current') return false;
  if (!docSession.preview.applyAllowed) return false;
  if (docSession.status === 'stale') return false;
  if (docSession.status === 'applying') return false;
  if (docSession.baseRevision !== projectSession.revision) return false;
  if (docSession.preview.baseRevision !== projectSession.revision) return false;
  const hasBlockingDiagnostic = docSession.preview.diagnostics.some((d) => d.severity === 'error');
  if (hasBlockingDiagnostic) return false;
  return true;
}

export function selectApplyDisabledReason(
  docSession: ScreenDslDocumentSession,
  projectSession: ProjectSession,
  targetMissing: boolean
): ScreenDslApplyDisabledReason | null {
  if (targetMissing) return { code: 'NO_TARGET', message: 'Select a target screen for Update or Clone mode.' };
  // Check transient statuses before presence of preview — stale session has preview cleared by reducer
  if (docSession.status === 'stale') return { code: 'STALE', message: 'Preview is stale. Re-run Preview.' };
  if (docSession.status === 'applying') return { code: 'APPLYING', message: 'Apply in progress.' };
  if (!docSession.preview) return { code: 'NO_PREVIEW', message: 'Run Preview before Apply.' };
  if (docSession.preview.lifecycle === 'consumed') return { code: 'CONSUMED', message: 'Preview already applied. Run Preview again.' };
  if (docSession.preview.lifecycle === 'failed') return { code: 'PREVIEW_FAILED', message: 'Preview is in a failed state. Run Preview again.' };
  if (docSession.baseRevision !== projectSession.revision) return { code: 'STALE_REVISION', message: 'Project changed since Preview. Re-run Preview.' };
  if (docSession.preview.baseRevision !== projectSession.revision) return { code: 'STALE_REVISION', message: 'Project changed since Preview. Re-run Preview.' };
  if (!docSession.preview.applyAllowed) return { code: 'NOT_ALLOWED', message: 'Preview has blocking diagnostics.' };
  const hasBlockingDiagnostic = docSession.preview.diagnostics.some((d) => d.severity === 'error');
  if (hasBlockingDiagnostic) return { code: 'BLOCKING_DIAGNOSTIC', message: 'Resolve errors before Apply.' };
  return null;
}

export function selectIsDestructive(preview: ScreenDslPreviewResult | null): boolean {
  return preview?.destructive === true;
}

export function selectDestructiveSummary(preview: ScreenDslPreviewResult | null): string {
  if (!preview?.destructive) return '';
  const ops = preview.semanticDiff?.operations ?? [];
  const deletions = ops.filter((op) => op.type === 'object.delete' || op.type === 'screen.delete');
  return `${deletions.length} destructive change${deletions.length !== 1 ? 's' : ''} detected. Confirm before Apply.`;
}

export function selectDiagnosticGroups(preview: ScreenDslPreviewResult | null): ScreenDslDiagnosticGroup[] {
  if (!preview) return [];
  const all = preview.diagnostics;
  const buckets = new Map<string, ScreenDslDiagnosticGroup>();
  for (const d of all) {
    const groupKey = classifyDiagnosticGroup(d.code);
    let group = buckets.get(groupKey);
    if (!group) {
      group = { label: groupKey, items: [] };
      buckets.set(groupKey, group);
    }
    group.items.push({
      code: d.code,
      severity: d.severity,
      message: d.message,
      line: d.line,
      column: d.column,
      path: d.path
    });
  }
  return [...buckets.values()];
}

function classifyDiagnosticGroup(code: string): string {
  if (code.startsWith('SCREEN_DSL_PARSE')) return 'Parse';
  if (code.startsWith('SCREEN_DSL_SCHEMA') || code.startsWith('SCREEN_DSL_VALIDATION')) return 'Schema';
  if (code.startsWith('SCREEN_DSL_IDENTITY') || code.startsWith('SCREEN_DSL_RESOURCE_ID_CONFLICT')) return 'Identity';
  if (code.startsWith('SCREEN_DSL_PIXEL') || code.startsWith('SCREEN_DSL_BUDGET')) return 'Pixel Budget';
  if (code.startsWith('SCREEN_DSL_APPLY') || code.startsWith('SCREEN_DSL_TRANSACTION')) return 'Transaction';
  if (code.startsWith('SCREEN_DSL_RESOURCE')) return 'Resources';
  return 'Validation';
}

export function selectSemanticChangeGroups(preview: ScreenDslPreviewResult | null): ScreenDslSemanticGroup[] {
  if (!preview?.semanticDiff) return [];
  const ops = preview.semanticDiff.operations;
  const screenOps: ScreenDslSemanticGroup = { label: 'Screens', destructive: false, items: [] };
  const objectOps: ScreenDslSemanticGroup = { label: 'Objects', destructive: false, items: [] };
  for (const op of ops) {
    const destructive = op.type.endsWith('.delete');
    const item = { type: op.type, id: op.id, path: op.path, destructive };
    if (op.type.startsWith('screen.')) {
      screenOps.items.push(item);
      if (destructive) screenOps.destructive = true;
    } else {
      objectOps.items.push(item);
      if (destructive) objectOps.destructive = true;
    }
  }
  return [screenOps, objectOps].filter((g) => g.items.length > 0);
}

export function selectRasterSummary(preview: ScreenDslPreviewResult | null): ScreenDslRasterSummary | null {
  if (!preview?.rasterPreview) return null;
  const { beforeByteLength, afterByteLength, changedScreens } = preview.rasterPreview;
  return {
    beforeBytes: beforeByteLength,
    afterBytes: afterByteLength,
    changedScreens,
    delta: afterByteLength - beforeByteLength,
    hasChanges: changedScreens.length > 0
  };
}

export function selectTargetSummary(
  importMode: ScreenDslImportMode,
  targetScreenIds: readonly string[]
): ScreenDslTargetSummary {
  const requiresTarget = importMode === 'update' || importMode === 'clone';
  const targetMissing = requiresTarget && targetScreenIds.length === 0;
  return { importMode, targetScreenIds, requiresTarget, targetMissing };
}

export function selectNoOpPreview(preview: ScreenDslPreviewResult | null): boolean {
  if (!preview) return false;
  const ops = preview.semanticDiff?.operations ?? [];
  return preview.applyAllowed && ops.length === 0;
}

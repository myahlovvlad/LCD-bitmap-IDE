import { executeProjectChangeSet } from '../changeSet';
import { createFixedApplicationCommandContext } from '../commandContext';
import type { ProjectSession } from '../projectSession';
import { exportSessionScreenInterchange } from '../screenInterchangeFacade';
import {
  diffScreenInterchange,
  parseScreenDslJson,
  parseScreenDslYaml,
  screenDslDocumentToInterchange,
  validateScreenDslPixelBudget,
  type ScreenDslDiagnostic
} from '../../screen-dsl';
import { validateScreenInterchange } from '../../screen-interchange';
import type { CreateScreenDslPreviewRequest, ScreenDslPreviewResult } from './contracts';
import { fingerprintScreenDslSource } from './hash';
import { mapScreenDslDiffToChangeSet } from './mapDiffToChangeSet';
import { prepareScreenDslCandidate } from './prepareCandidate';
import { createScreenDslIdentityPlan } from './proposedIdentity';
import { createScreenDslRasterPreview } from './rasterPreview';

const PREVIEW_TIMESTAMP = '2026-06-25T00:00:00.000Z';

export function createScreenDslPreview(
  session: ProjectSession,
  request: CreateScreenDslPreviewRequest
): ScreenDslPreviewResult {
  const sourceFingerprint = fingerprintScreenDslSource(request.sourceText);
  const targetScreenIds = request.targetScreenIds ?? [];
  const baseReadModel = exportSessionScreenInterchange(session, targetScreenIds.length > 0 ? targetScreenIds : undefined);
  const baseScreenFingerprint = baseReadModel.fingerprint;
  const base = baseReadModel.package;
  const baseResult = emptyResult(request, session.revision, baseScreenFingerprint, sourceFingerprint);
  const diagnostics: ScreenDslDiagnostic[] = [];

  if (request.projectId !== session.project.meta.id) {
    return {
      ...baseResult,
      diagnostics: [{ code: 'SCREEN_DSL_PROJECT_MISMATCH', severity: 'error', message: 'Preview project does not match session project.', path: '$.projectId' }]
    };
  }
  if (request.expectedRevision !== session.revision) {
    return {
      ...baseResult,
      diagnostics: [{ code: 'SCREEN_DSL_REVISION_CONFLICT', severity: 'error', message: 'Preview revision does not match session revision.', path: '$.expectedRevision' }]
    };
  }

  const parsed = request.format === 'json'
    ? parseScreenDslJson(request.sourceText)
    : parseScreenDslYaml(request.sourceText);
  diagnostics.push(...parsed.diagnostics);
  if (!parsed.document) {
    return { ...baseResult, diagnostics };
  }

  const targetIds = targetScreenIds.length > 0 ? targetScreenIds : parsed.document.screens.map((screen) => screen.id);
  const scopedBase = exportSessionScreenInterchange(session, targetIds).package;
  const rawCandidate = screenDslDocumentToInterchange(parsed.document);
  const identityPlan = createScreenDslIdentityPlan(session, parsed.document, request.importMode, sourceFingerprint);
  const candidate = prepareScreenDslCandidate(rawCandidate, request.importMode, identityPlan);
  const interchangeValidation = validateScreenInterchange(candidate);
  diagnostics.push(...interchangeValidation.issues.map((issue) => ({
    code: `SCREEN_INTERCHANGE_${issue.severity.toUpperCase()}`,
    severity: issue.severity,
    message: issue.message,
    path: issue.path
  })));
  diagnostics.push(...validateScreenDslPixelBudget(parsed.document).diagnostics);

  const diffBase = request.importMode === 'update' ? scopedBase : emptyInterchangeFor(candidate, scopedBase.project.id);
  const semanticDiff = diffScreenInterchange(diffBase, candidate);
  const destructive = semanticDiff.operations.some((operation) => operation.type === 'object.delete' || operation.type === 'screen.delete');
  const mapped = mapScreenDslDiffToChangeSet({
    projectId: request.projectId,
    expectedRevision: request.expectedRevision,
    importMode: request.importMode,
    actor: request.actor,
    sourceFingerprint,
    base: request.importMode === 'update' ? scopedBase : exportSessionScreenInterchange(session).package,
    candidate
  });
  diagnostics.push(...mapped.diagnostics);
  const dryRun = mapped.changeSet
    ? executeProjectChangeSet(session, mapped.changeSet, createFixedApplicationCommandContext(PREVIEW_TIMESTAMP), { dryRun: true })
    : null;
  if (dryRun?.diagnostics.length) {
    diagnostics.push(...dryRun.diagnostics
      .filter((diagnostic) => diagnostic.severity !== 'info')
      .map((diagnostic): ScreenDslDiagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity === 'warning' ? 'warning' : 'error',
      message: diagnostic.message,
      path: '$.changeSet'
    })));
  }
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  const applyAllowed = !hasErrors && Boolean(mapped.changeSet) && dryRun?.status === 'dry-run';

  return {
    success: !hasErrors,
    projectId: request.projectId,
    importMode: request.importMode,
    baseRevision: session.revision,
    baseScreenFingerprint: exportSessionScreenInterchange(session, targetIds).fingerprint,
    sourceFingerprint,
    parsedDocument: parsed.document,
    interchangeCandidate: candidate,
    identityPlan,
    semanticDiff,
    changeSet: mapped.changeSet,
    dryRun,
    rasterPreview: createScreenDslRasterPreview(diffBase, candidate),
    diagnostics,
    destructive,
    applyAllowed,
    lifecycle: 'current' as const
  };
}

function emptyInterchangeFor(candidate: ReturnType<typeof screenDslDocumentToInterchange>, projectId: string) {
  return {
    ...candidate,
    project: {
      ...candidate.project,
      id: projectId,
      screenOrder: []
    },
    screens: [],
    resources: { fonts: {}, glyphs: {}, bitmaps: {} },
    traceability: { projectId, screens: {}, objects: {}, resources: {} }
  };
}

function emptyResult(
  request: CreateScreenDslPreviewRequest,
  baseRevision: number,
  baseScreenFingerprint: string,
  sourceFingerprint: string
): ScreenDslPreviewResult {
  return {
    success: false,
    projectId: request.projectId,
    importMode: request.importMode,
    baseRevision,
    baseScreenFingerprint,
    sourceFingerprint,
    parsedDocument: null,
    interchangeCandidate: null,
    identityPlan: null,
    semanticDiff: null,
    changeSet: null,
    dryRun: null,
    rasterPreview: null,
    diagnostics: [],
    destructive: false,
    applyAllowed: false,
    lifecycle: 'current' as const
  };
}

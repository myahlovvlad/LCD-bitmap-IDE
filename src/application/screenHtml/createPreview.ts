import type { ProjectSession } from '../projectSession';
import { exportSessionScreenInterchange } from '../screenInterchangeFacade';
import { createScreenDslPreview } from '../screenDsl/createPreview';
import { writeCanonicalScreenDslJson, screenDslDocumentToInterchange } from '../../screen-dsl';
import { htmlToScreenDslDocument, screenInterchangeToHtml } from '../../screen-html';
import type { CreateScreenHtmlPreviewRequest, ScreenHtmlPreviewResult } from './contracts';

const SCREEN_HTML_ACTOR = { id: 'screen-html', type: 'adapter' as const, displayName: 'LCD HTML interchange' };

export function createScreenHtmlPreview(session: ProjectSession, request: CreateScreenHtmlPreviewRequest): ScreenHtmlPreviewResult {
  const base = exportSessionScreenInterchange(session).package;
  const parsed = htmlToScreenDslDocument(request.html, base);
  if (!parsed.document) {
    return { success: false, canonicalHtml: null, screenDslSource: null, screenDslPreview: null, diagnostics: parsed.diagnostics };
  }
  const screenId = request.targetScreenId ?? parsed.screenId;
  const document = screenId ? {
    ...parsed.document,
    project: { ...parsed.document.project, screenOrder: [screenId] },
    screens: parsed.document.screens.filter((screen) => screen.id === screenId)
  } : parsed.document;
  const scopedSourceText = writeCanonicalScreenDslJson(document);
  const preview = createScreenDslPreview(session, {
    projectId: session.project.meta.id,
    expectedRevision: request.expectedRevision,
    format: 'json',
    sourceText: scopedSourceText,
    importMode: request.importMode,
    targetScreenIds: screenId ? [screenId] : undefined,
    actor: request.actor ?? SCREEN_HTML_ACTOR
  });
  const diagnostics = [...parsed.diagnostics, ...preview.diagnostics];
  return {
    success: !diagnostics.some((item) => item.severity === 'error') && (preview.applyAllowed || preview.dryRun?.status === 'noop'),
    canonicalHtml: screenInterchangeToHtml(screenDslDocumentToInterchange(document), screenId ?? undefined),
    screenDslSource: scopedSourceText,
    screenDslPreview: preview,
    diagnostics
  };
}

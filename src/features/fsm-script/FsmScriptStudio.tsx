/**
 * @module features/fsm-script/FsmScriptStudio
 * @description Script workspace for synchronizing the visual React Flow FSM
 * with Mermaid stateDiagram-v2 text and a conservative Python-like DSL.
 * Supports importing script files (.mmd/.py/.txt) from disk into the editor.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  acceptFsmScriptPreviewResult,
  beginFsmScriptPreview,
  createFsmScriptDocumentSession,
  editFsmScriptDocument,
  previewFsmScriptImport,
  isFsmScriptPreviewApplicable,
  markFsmScriptDocumentApplied,
  refreshFsmScriptDocumentFromGraph,
  type ProjectCommandResult,
  type ProjectSession
} from '../../application';
import type { FsmScriptDocumentSession, FsmScriptPreview } from '../../application';
import type { FsmScriptFormat } from '../../fsm-interchange';
import { copyToClipboard } from '../../renderer/utils/clipboard';

interface FsmScriptStudioProps {
  readonly session: ProjectSession;
  readonly onApplyPreview: (preview: FsmScriptPreview) => ProjectCommandResult | null;
}

/** Largest script file accepted by the importer (defends against huge pastes). */
const MAX_SCRIPT_BYTES = 512 * 1024;
const AUTO_PREVIEW_DELAY_MS = 350;
const SCRIPT_FORMATS: readonly FsmScriptFormat[] = ['mermaid', 'python'];
const FORMAT_LABEL: Record<FsmScriptFormat, string> = {
  mermaid: 'Mermaid',
  python: 'Python'
};

type DocumentMap = Record<FsmScriptFormat, FsmScriptDocumentSession>;
type AutoPreviewMap = Record<FsmScriptFormat, boolean>;

const draftCache = new Map<string, FsmScriptDocumentSession>();

/**
 * Shows generated Mermaid/Python specifications and lets the user import a
 * script back into the shared FSM model. Mermaid is intentionally text-first
 * here, avoiding CDN/runtime rendering so the application remains offline.
 * Scripts can be typed, pasted, or imported from local files; importing only
 * loads text into the editor so the user can review before applying.
 */
export function FsmScriptStudio({
  session,
  onApplyPreview
}: FsmScriptStudioProps): React.ReactElement {
  const [documents, setDocuments] = useState<DocumentMap>(() => createInitialDocuments(session));
  const documentsRef = useRef(documents);
  const [activeFormat, setActiveFormat] = useState<FsmScriptFormat>('mermaid');
  const [autoPreview, setAutoPreview] = useState<AutoPreviewMap>({ mermaid: true, python: true });
  const [status, setStatus] = useState('');
  const mermaidFileRef = useRef<HTMLInputElement>(null);
  const pythonFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documentsRef.current = documents;
    for (const document of Object.values(documents)) {
      draftCache.set(documentKey(document.projectId, document.format), document);
    }
  }, [documents]);

  useEffect(() => {
    setDocuments((current) => mapDocuments(current, (document) => (
      refreshFsmScriptDocumentFromGraph(document, session)
    )));
  }, [session.project.meta.id, session.revision, session]);

  useEffect(() => {
    const handles = SCRIPT_FORMATS.map((format) => {
      const document = documents[format];
      if (!autoPreview[format] || document.status !== 'scheduled') {
        return null;
      }
      return globalThis.setTimeout(() => runPreview(format), AUTO_PREVIEW_DELAY_MS);
    });
    return () => {
      for (const handle of handles) {
        if (handle !== null) {
          globalThis.clearTimeout(handle);
        }
      }
    };
  }, [
    autoPreview.mermaid,
    autoPreview.python,
    documents.mermaid.sourceFingerprint,
    documents.mermaid.status,
    documents.python.sourceFingerprint,
    documents.python.status,
    session
  ]);

  const activeDocument = documents[activeFormat];
  const activePreview = activeDocument.preview;
  const activePreviewOperationCount = activePreview?.diff?.operations.length ?? 0;
  const activeDocumentStale = Boolean(activeDocument.staleReason || activePreview?.baseRevision !== session.revision);

  function runPreview(format: FsmScriptFormat): void {
    setActiveFormat(format);
    const currentSession = session;
    const previewTask = beginFsmScriptPreview(documentsRef.current[format], currentSession);
    setDocuments((current) => ({ ...current, [format]: previewTask.document }));
    Promise.resolve(previewFsmScriptImport(currentSession, previewTask.document.sourceText, format))
      .then((preview) => {
        setDocuments((current) => {
          const result = acceptFsmScriptPreviewResult(current[format], previewTask.request, preview);
          if (!result.accepted) {
            setStatus(`${FORMAT_LABEL[format]}: ignored stale preview result (${result.reason}).`);
          } else {
            setStatus(formatPreviewStatus(FORMAT_LABEL[format], preview));
          }
          return { ...current, [format]: result.document };
        });
      })
      .catch(() => {
        setDocuments((current) => ({
          ...current,
          [format]: {
            ...current[format],
            status: 'failed',
            activeRequestSequence: null,
            staleReason: null
          }
        }));
        setStatus(`${FORMAT_LABEL[format]}: preview failed.`);
      });
  }

  const updateText = (format: FsmScriptFormat, value: string): void => {
    setActiveFormat(format);
    setDocuments((current) => ({
      ...current,
      [format]: editFsmScriptDocument(current[format], value, { autoPreview: autoPreview[format] })
    }));
    setStatus(autoPreview[format]
      ? `${FORMAT_LABEL[format]}: preview scheduled. Apply remains explicit.`
      : `${FORMAT_LABEL[format]}: draft changed. Preview before Apply.`);
  };

  const refreshFromGraph = (format: FsmScriptFormat): void => {
    const document = documentsRef.current[format];
    if (document.dirty && !globalThis.confirm('Discard dirty script draft and refresh from graph?')) {
      setStatus(`${FORMAT_LABEL[format]}: refresh cancelled; dirty draft preserved.`);
      return;
    }
    setActiveFormat(format);
    setDocuments((current) => ({
      ...current,
      [format]: refreshFsmScriptDocumentFromGraph(current[format], session, { force: true })
    }));
    setStatus(`${FORMAT_LABEL[format]}: refreshed from current graph.`);
  };

  const discardDraft = (format: FsmScriptFormat): void => {
    setActiveFormat(format);
    setDocuments((current) => ({
      ...current,
      [format]: refreshFsmScriptDocumentFromGraph(current[format], session, { force: true })
    }));
    setStatus(`${FORMAT_LABEL[format]}: draft discarded.`);
  };

  const applyCurrentPreview = (format: FsmScriptFormat): void => {
    const document = documentsRef.current[format];
    if (!document.preview || !isFsmScriptPreviewApplicable(document, session)) {
      setStatus('Preview a valid semantic change before Apply.');
      return;
    }
    const result = onApplyPreview(document.preview);
    if (!result) {
      setStatus('Apply failed: no active project session.');
      return;
    }
    if (result.status === 'applied') {
      setStatus(`Applied ${result.changes.length} semantic changes in one history entry.`);
      setDocuments((current) => mapDocuments(current, (item) => (
        item.format === format
          ? markFsmScriptDocumentApplied(item, result.session)
          : refreshFsmScriptDocumentFromGraph(item, result.session)
      )));
      return;
    }
    if (result.status === 'noop') {
      setStatus('No semantic changes to apply.');
      setDocuments((current) => ({
        ...current,
        [format]: refreshFsmScriptDocumentFromGraph(current[format], result.session, { force: true })
      }));
      return;
    }
    setStatus(result.diagnostics[0]?.message ?? 'Apply rejected.');
  };

  const importScriptFile = async (
    file: File | undefined,
    target: FsmScriptFormat,
    label: string
  ): Promise<void> => {
    if (!file) {
      return;
    }
    if (file.size > MAX_SCRIPT_BYTES) {
      setStatus(`Import rejected: ${file.name} exceeds ${Math.round(MAX_SCRIPT_BYTES / 1024)} KB`);
      return;
    }
    try {
      const text = await file.text();
      updateText(target, text);
      setStatus(`Imported ${label} script "${file.name}" (${text.split(/\r?\n/).length} lines). Review, then Apply.`);
    } catch {
      setStatus(`Import failed: could not read ${file.name}`);
    }
  };

  return (
    <section className="script-studio" aria-label="FSM scripts" data-testid="fsm-script-studio">
      <header>
        <div>
          <h2>FSM Scripts</h2>
          <p>Mermaid stateDiagram-v2 and LCD-bitmap IDE Python specification share one FSM data model.</p>
        </div>
        <button type="button" onClick={() => void copyToClipboard(documents.mermaid.sourceText)} data-testid="fsm-script-copy-mermaid">
          Copy Mermaid
        </button>
      </header>

      <div className="script-grid">
        <article className="script-card" data-testid="fsm-script-format-mermaid">
          <h3>Mermaid stateDiagram-v2</h3>
          <textarea
            id="fsm-script-mermaid"
            name="fsm-script-mermaid"
            aria-label="Mermaid stateDiagram-v2 script editor"
            data-testid="fsm-script-source-mermaid"
            value={documents.mermaid.sourceText}
            spellCheck={false}
            onFocus={() => setActiveFormat('mermaid')}
            onChange={(event) => updateText('mermaid', event.target.value)}
          />
          <input
            ref={mermaidFileRef}
            type="file"
            accept=".mmd,.mermaid,.txt,text/plain"
            hidden
            onChange={(event) => {
              void importScriptFile(event.target.files?.[0], 'mermaid', 'Mermaid');
              event.target.value = '';
            }}
          />
          <DocumentStateBadge document={documents.mermaid} />
          <div className="script-actions">
            <button type="button" onClick={() => mermaidFileRef.current?.click()} data-testid="fsm-script-import-mermaid">Import file...</button>
            <button type="button" onClick={() => refreshFromGraph('mermaid')} data-testid="fsm-script-generate-mermaid">Refresh</button>
            <button type="button" onClick={() => discardDraft('mermaid')} data-testid="fsm-script-discard-mermaid">Discard</button>
            <button type="button" onClick={() => runPreview('mermaid')} data-testid="fsm-script-preview-mermaid">
              {documents.mermaid.status === 'stale' ? 'Re-preview' : 'Preview'}
            </button>
            <button type="button" onClick={() => applyCurrentPreview('mermaid')} disabled={!isFsmScriptPreviewApplicable(documents.mermaid, session)} data-testid="fsm-script-apply-mermaid">Apply</button>
            <label className="checkbox-line script-auto-preview">
              <input
                type="checkbox"
                checked={autoPreview.mermaid}
                onChange={(event) => setAutoPreview((current) => ({ ...current, mermaid: event.target.checked }))}
                data-testid="fsm-script-auto-preview-mermaid"
              />
              Auto-preview
            </label>
          </div>
        </article>

        <article className="script-card" data-testid="fsm-script-format-python">
          <h3>LCD-bitmap IDE Python DSL</h3>
          <textarea
            id="fsm-script-python"
            name="fsm-script-python"
            aria-label="LCD-bitmap IDE Python DSL script editor"
            data-testid="fsm-script-source-python"
            value={documents.python.sourceText}
            spellCheck={false}
            onFocus={() => setActiveFormat('python')}
            onChange={(event) => updateText('python', event.target.value)}
          />
          <input
            ref={pythonFileRef}
            type="file"
            accept=".py,.txt,text/x-python,text/plain"
            hidden
            onChange={(event) => {
              void importScriptFile(event.target.files?.[0], 'python', 'Python');
              event.target.value = '';
            }}
          />
          <DocumentStateBadge document={documents.python} />
          <div className="script-actions">
            <button type="button" onClick={() => pythonFileRef.current?.click()} data-testid="fsm-script-import-python">Import file...</button>
            <button type="button" onClick={() => refreshFromGraph('python')} data-testid="fsm-script-generate-python">Refresh</button>
            <button type="button" onClick={() => discardDraft('python')} data-testid="fsm-script-discard-python">Discard</button>
            <button type="button" onClick={() => runPreview('python')} data-testid="fsm-script-preview-python">
              {documents.python.status === 'stale' ? 'Re-preview' : 'Preview'}
            </button>
            <button type="button" onClick={() => applyCurrentPreview('python')} disabled={!isFsmScriptPreviewApplicable(documents.python, session)} data-testid="fsm-script-apply-python">Apply</button>
            <label className="checkbox-line script-auto-preview">
              <input
                type="checkbox"
                checked={autoPreview.python}
                onChange={(event) => setAutoPreview((current) => ({ ...current, python: event.target.checked }))}
                data-testid="fsm-script-auto-preview-python"
              />
              Auto-preview
            </label>
          </div>
        </article>
      </div>

      <pre className="script-help">{`fsm = FSM(version=1, project_id="demo")
fsm.state(id="main_menu", title="Main menu", initial=true, order=0, x=80, y=80)
fsm.state(id="measure_mode", title="Measure", order=1, x=250, y=200)
fsm.event(id="OK", name="OK", order=0)
fsm.transition(id="tr_main_measure", from="main_menu", to="measure_mode", event="OK", order=0)`}</pre>
      {activeDocumentStale ? (
        <p className="script-status danger" role="alert" data-testid="fsm-script-stale-preview">
          {FORMAT_LABEL[activeFormat]} document is stale. Re-preview before Apply.
        </p>
      ) : null}
      {activePreview ? (
        <section className="script-preview-panel" aria-label="FSM script preview" data-testid="fsm-script-preview-panel">
          <div className="script-preview-meta" data-testid="fsm-script-preview-revision">
            Preview revision {activePreview.baseRevision}; current revision {session.revision}
          </div>
          {activePreview.diagnostics.length > 0 ? (
            <ul className="script-diagnostics" aria-label="FSM script diagnostics" data-testid="fsm-script-diagnostics">
              {activePreview.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${diagnostic.line}-${index}`} className={`script-diagnostic severity-${diagnostic.severity}`}>
                  <strong>{diagnostic.code}</strong>
                  <span>{diagnostic.line}:{diagnostic.column}</span>
                  <span>{diagnostic.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {activePreview.diff ? (
            <ul className="script-diff-list" aria-label="FSM semantic diff" data-testid="fsm-script-semantic-diff">
              {activePreviewOperationCount === 0 ? (
                <li data-testid="fsm-script-noop-change">No semantic changes.</li>
              ) : activePreview.diff.operations.map((operation) => (
                <li key={`${operation.type}-${operation.id}`} data-testid={`fsm-script-change-${operation.type}`}>
                  <strong>{operation.type}</strong>
                  <span>{operation.id}</span>
                  {operation.type.endsWith('.delete') ? <span className="script-destructive-marker" data-testid="fsm-script-destructive-change">destructive</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {status ? <p className="script-status" data-testid="fsm-script-status">{status}</p> : null}
    </section>
  );
}

function createInitialDocuments(session: ProjectSession): DocumentMap {
  return {
    mermaid: restoreDocument(session, 'mermaid'),
    python: restoreDocument(session, 'python')
  };
}

function restoreDocument(session: ProjectSession, format: FsmScriptFormat): FsmScriptDocumentSession {
  const key = documentKey(session.project.meta.id, format);
  const cached = draftCache.get(key);
  return cached
    ? refreshFsmScriptDocumentFromGraph(cached, session)
    : createFsmScriptDocumentSession(session, format);
}

function documentKey(projectId: string, format: FsmScriptFormat): string {
  return `${projectId}:${format}`;
}

function mapDocuments(
  documents: DocumentMap,
  map: (document: FsmScriptDocumentSession) => FsmScriptDocumentSession
): DocumentMap {
  return {
    mermaid: map(documents.mermaid),
    python: map(documents.python)
  };
}

function DocumentStateBadge({ document }: { readonly document: FsmScriptDocumentSession }): React.ReactElement {
  const reason = document.staleReason ? ` (${document.staleReason})` : '';
  return (
    <p className={`script-status script-document-status status-${document.status}`} data-testid={`fsm-script-document-state-${document.format}`}>
      {document.status}{document.dirty ? ' dirty' : ' clean'}{reason}
    </p>
  );
}

function formatPreviewStatus(label: string, preview: FsmScriptPreview): string {
  if (!preview.ok) {
    const first = preview.diagnostics[0];
    return first ? `${label}: ${first.code} at ${first.line}:${first.column} - ${first.message}` : `${label}: preview failed`;
  }
  const operations = preview.diff?.operations.length ?? 0;
  return `${label}: ${operations} semantic changes ready for explicit Apply.`;
}

import type React from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  exportScreenDsl,
  type ProjectSession,
  type ScreenDslPreviewResult
} from '../../application';
import type { ApplyScreenDslPreviewResult } from '../../application/screenDsl/applyPreview';
import type { ScreenDslTextFormat } from '../../application/screenDsl/contracts';
import { ScreenDslSessionCoordinator } from '../../application/screenDslSession/coordinator';
import { createScreenDslDocumentKey } from '../../application/screenDslSession/identity';
import type { ScreenDslDocumentSession } from '../../application/screenDslSession/contracts';
import type { ScreenDslImportMode } from '../../screen-dsl';
import type { LanguageCode } from '../../renderer/types/domain';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { HelpCircle } from 'lucide-react';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import {
  selectCanApply,
  selectCanPreview,
  selectApplyDisabledReason,
  selectDiagnosticGroups,
  selectSemanticChangeGroups,
  selectRasterSummary,
  selectTargetSummary,
  selectIsDestructive,
  selectDestructiveSummary,
  selectNoOpPreview,
  type ScreenDslDiagnosticGroup,
  type ScreenDslSemanticGroup,
  type ScreenDslRasterSummary
} from './selectors';
import type { ScreenDslFileAdapter } from './screenDslFileAdapter';
import { electronFileAdapter } from './screenDslFileAdapter';
import { createSafeScreenDslFilename } from '../../shared/screenDslFiles/filename';
import type { ScreenDslFileUIState } from '../../shared/screenDslFiles/contracts';

interface ScreenDslStudioProps {
  readonly session: ProjectSession;
  readonly selectedScreenId: string | null;
  readonly language: LanguageCode;
  readonly onApplyPreview: (preview: ScreenDslPreviewResult, sourceText: string) => ApplyScreenDslPreviewResult | null;
  /** File adapter — defaults to Electron preload adapter. Override for browser tests. */
  readonly fileAdapter?: ScreenDslFileAdapter;
}

interface DirtyReplacement {
  readonly pendingContent: string;
  readonly pendingFormat: ScreenDslTextFormat;
  readonly pendingFilename: string;
}

const ACTOR = { id: 'screen-dsl-studio', type: 'user' as const };
const FORMATS: readonly ScreenDslTextFormat[] = ['json', 'yaml'];
const IMPORT_MODES: readonly ScreenDslImportMode[] = ['create', 'update', 'clone'];
const FORMAT_LABEL: Record<ScreenDslTextFormat, string> = { json: 'JSON', yaml: 'YAML' };

const coordinator = new ScreenDslSessionCoordinator({ actor: ACTOR });

function buildTargetScreenIds(importMode: ScreenDslImportMode, selectedScreenId: string | null): readonly string[] {
  return (importMode === 'update' || importMode === 'clone') && selectedScreenId ? [selectedScreenId] : [];
}

function applyDisabledReasonLabel(code: string, labels: UiText): string {
  switch (code) {
    case 'NO_TARGET': return labels.dslReasonNoTarget;
    case 'STALE': return labels.dslReasonStale;
    case 'APPLYING': return labels.dslReasonApplying;
    case 'NO_PREVIEW': return labels.dslReasonNoPreview;
    case 'CONSUMED': return labels.dslReasonConsumed;
    case 'PREVIEW_FAILED': return labels.dslReasonPreviewFailed;
    case 'STALE_REVISION': return labels.dslReasonStaleRevision;
    case 'NOT_ALLOWED': return labels.dslReasonNotAllowed;
    case 'BLOCKING_DIAGNOSTIC': return labels.dslReasonBlockingDiagnostic;
    default: return code;
  }
}

export function ScreenDslStudio({ session, selectedScreenId, language, onApplyPreview, fileAdapter = electronFileAdapter }: ScreenDslStudioProps): React.ReactElement {
  const labels = UI_TEXT[language];
  const MODE_LABEL: Record<ScreenDslImportMode, string> = {
    create: labels.dslModeCreate,
    update: labels.dslModeUpdate,
    clone: labels.dslModeClone
  };
  const [activeFormat, setActiveFormat] = useState<ScreenDslTextFormat>('json');
  const [activeMode, setActiveMode] = useState<ScreenDslImportMode>('create');
  const [docSession, setDocSession] = useState<ScreenDslDocumentSession>(() =>
    coordinator.getOrCreate(session.project.meta.id, 'json', 'create')
  );
  const [status, setStatus] = useState('');
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'diff' | 'raster' | 'budget'>('diagnostics');
  const [fileUIState, setFileUIState] = useState<ScreenDslFileUIState>('idle');
  const [showTutorial, setShowTutorial] = useState(false);
  const [dirtyReplacement, setDirtyReplacement] = useState<DirtyReplacement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const replaceDialogRef = useRef<HTMLDialogElement>(null);
  const previewingRef = useRef(false);

  const targetScreenIds = buildTargetScreenIds(activeMode, selectedScreenId);
  const key = createScreenDslDocumentKey(session.project.meta.id, activeFormat, activeMode, targetScreenIds);
  const targetSummary = selectTargetSummary(activeMode, targetScreenIds);
  const canPreview = selectCanPreview(docSession, session, targetSummary.targetMissing);
  const canApply = selectCanApply(docSession, session);
  const applyDisabledReason = selectApplyDisabledReason(docSession, session, targetSummary.targetMissing);
  const isDestructive = selectIsDestructive(docSession.preview ?? null);
  const noOp = selectNoOpPreview(docSession.preview ?? null);
  const diagnosticGroups = selectDiagnosticGroups(docSession.preview ?? null);
  const semanticGroups = selectSemanticChangeGroups(docSession.preview ?? null);
  const rasterSummary = selectRasterSummary(docSession.preview ?? null);
  const fileBusy = fileUIState === 'opening' || fileUIState === 'exporting' || fileUIState === 'replacing';

  // Notify coordinator when project revision changes externally (Undo/Redo, other commands)
  useEffect(() => {
    const currentDoc = coordinator.getSession(key);
    if (!currentDoc || currentDoc.disposed) return;
    if (currentDoc.baseRevision !== session.revision) {
      const updated = coordinator.notifyProjectChanged(key, session.revision, '', null);
      setDocSession(updated);
    }
  }, [session.project.meta.id, session.revision, activeFormat, activeMode, targetScreenIds.join(',')]);

  // Sync when session key changes (format/mode/target)
  useEffect(() => {
    const existing = coordinator.getSession(key);
    if (existing && !existing.disposed) {
      setDocSession(existing);
    } else {
      const fresh = coordinator.getOrCreate(session.project.meta.id, activeFormat, activeMode, [...targetScreenIds]);
      setDocSession(fresh);
    }
  }, [session.project.meta.id, activeFormat, activeMode, targetScreenIds.join(',')]);

  function refreshDoc(): void {
    const updated = coordinator.getSession(key);
    if (updated) setDocSession(updated);
  }

  function updateSource(text: string): void {
    setDocSession(coordinator.updateSource(key, text));
  }

  function generateFromProject(): void {
    const currentDoc = coordinator.getSession(key);
    if (currentDoc?.dirty && !globalThis.confirm('Replace current draft with generated source from project?')) {
      setStatus('Generation cancelled. Draft preserved.');
      return;
    }
    const canonical = exportScreenDsl(session, activeFormat, targetScreenIds.length > 0 ? [...targetScreenIds] : undefined);
    setDocSession(coordinator.initialize(session, activeFormat, activeMode, [...targetScreenIds], canonical));
    setStatus(`Generated ${FORMAT_LABEL[activeFormat]} from current project.`);
  }

  function runPreview(): void {
    if (previewingRef.current) return;
    previewingRef.current = true;
    coordinator.requestPreview(session, key).then((updated) => {
      setDocSession(updated);
      const preview = updated.preview;
      if (!preview || updated.status === 'invalid') {
        const firstDiag = preview?.diagnostics[0];
        setStatus(firstDiag ? `Preview failed: ${firstDiag.code} — ${firstDiag.message}` : 'Preview failed.');
      } else {
        const opCount = preview.semanticDiff?.operations.length ?? 0;
        setStatus(opCount === 0 ? 'Preview: no changes. Apply would be a no-op.' : `Preview ready: ${opCount} semantic changes.`);
      }
      previewingRef.current = false;
    }).catch(() => {
      previewingRef.current = false;
      setStatus('Preview failed unexpectedly.');
    });
  }

  function requestApply(): void {
    if (!docSession.preview) return;
    if (isDestructive) {
      setShowApplyDialog(true);
      globalThis.setTimeout(() => dialogRef.current?.showModal(), 0);
    } else {
      executeApply();
    }
  }

  function executeApply(): void {
    setShowApplyDialog(false);
    dialogRef.current?.close();
    const currentDoc = coordinator.getSession(key);
    if (!currentDoc?.preview) return;

    const result = onApplyPreview(currentDoc.preview, currentDoc.sourceText);
    if (!result) {
      setStatus('Apply failed: no active project session.');
      return;
    }
    if (!result.applied) {
      const code = result.diagnostics[0]?.code ?? 'UNKNOWN';
      setStatus(`Apply rejected: ${code}`);
      // Session stays in preview-ready state — user can correct and retry
      refreshDoc();
      return;
    }
    const canonicalForReset = result.result?.session
      ? exportScreenDsl(result.result.session, activeFormat, targetScreenIds.length > 0 ? [...targetScreenIds] : undefined)
      : currentDoc.sourceText;
    setDocSession(coordinator.discardDraft(key, canonicalForReset));
    setStatus('Applied. One history entry created. Use Ctrl+Z to Undo.');
  }

  function discardDraft(): void {
    if (docSession.dirty && !globalThis.confirm('Discard current draft?')) {
      setStatus('Discard cancelled.');
      return;
    }
    const canonical = exportScreenDsl(session, activeFormat, targetScreenIds.length > 0 ? [...targetScreenIds] : undefined);
    setDocSession(coordinator.discardDraft(key, canonical));
    setStatus('Draft discarded.');
  }

  function applyFileContent(content: string, format: ScreenDslTextFormat): void {
    // Load file content into the current session for the matching format tab.
    // Does NOT auto-preview or auto-apply. Does NOT mutate project.
    setActiveFormat(format);
    setDocSession(coordinator.initialize(session, format, activeMode, [...targetScreenIds], content));
    setStatus(`File loaded into ${format.toUpperCase()} session. Review and Preview before Apply.`);
  }

  async function openFile(): Promise<void> {
    if (fileBusy) return;
    setFileUIState('opening');
    try {
      const result = await fileAdapter.open();
      if (result.cancelled) {
        setFileUIState('cancelled');
        setStatus('Open cancelled.');
        return;
      }
      if (!result.content || !result.format) {
        const code = result.diagnostics?.[0]?.code ?? 'UNKNOWN';
        const msg = result.diagnostics?.[0]?.message ?? 'File open failed.';
        setFileUIState('failed');
        setStatus(`Open failed: ${code} — ${msg}`);
        return;
      }
      // Dirty replacement protection
      const currentDoc = coordinator.getSession(key);
      if (currentDoc?.dirty) {
        setDirtyReplacement({
          pendingContent: result.content,
          pendingFormat: result.format,
          pendingFilename: result.filename ?? 'file'
        });
        setFileUIState('replacing');
        globalThis.setTimeout(() => replaceDialogRef.current?.showModal(), 0);
        return;
      }
      applyFileContent(result.content, result.format);
      setFileUIState('completed');
    } catch {
      setFileUIState('failed');
      setStatus('Open failed unexpectedly.');
    }
  }

  function confirmReplacement(): void {
    if (!dirtyReplacement) return;
    replaceDialogRef.current?.close();
    applyFileContent(dirtyReplacement.pendingContent, dirtyReplacement.pendingFormat);
    setDirtyReplacement(null);
    setFileUIState('completed');
  }

  function cancelReplacement(): void {
    replaceDialogRef.current?.close();
    setDirtyReplacement(null);
    setFileUIState('idle');
    setStatus('Open cancelled. Draft preserved.');
  }

  async function exportCanonical(): Promise<void> {
    if (fileBusy) return;
    setFileUIState('exporting');
    try {
      // Generate deterministic canonical source from current project state.
      // Does NOT modify project, session, history, or revision.
      const canonical = exportScreenDsl(
        session,
        activeFormat,
        targetScreenIds.length > 0 ? [...targetScreenIds] : undefined
      );
      const screenName = targetScreenIds.length === 1
        ? targetScreenIds[0]
        : (session.project.meta.name ?? 'screens');
      const suggestedFilename = createSafeScreenDslFilename(screenName, activeFormat);
      const saveResult = await fileAdapter.save({
        format: activeFormat,
        operation: 'canonical-export',
        suggestedFilename,
        content: canonical
      });
      if (saveResult.cancelled) {
        setFileUIState('cancelled');
        setStatus('Export cancelled.');
        return;
      }
      if (saveResult.diagnostics && saveResult.diagnostics.length > 0) {
        const code = saveResult.diagnostics[0].code;
        const msg = saveResult.diagnostics[0].message;
        setFileUIState('failed');
        setStatus(`Export failed: ${code} — ${msg}`);
        return;
      }
      setFileUIState('completed');
      setStatus(`Exported ${saveResult.byteLength ?? 0} bytes to ${saveResult.filename ?? 'file'}.`);
    } catch {
      setFileUIState('failed');
      setStatus('Export failed unexpectedly.');
    }
  }

  const preview = docSession.preview;

  return (
    <section className="screen-dsl-studio" aria-label="Screen Schema Studio" data-testid="screen-dsl-studio">
      <header className="screen-dsl-studio-header">
        <div>
          <h2>{labels.dslTitle}</h2>
          {session.project.meta.name
            ? <p className="screen-dsl-project-name">{session.project.meta.name}</p>
            : null}
        </div>
        <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
          <HelpCircle size={15} />
        </button>
        <span
          className={`screen-dsl-status-badge status-${docSession.status}`}
          aria-label={`Status: ${docSession.status}${docSession.dirty ? ', modified' : ''}`}
          data-testid="screen-dsl-status-badge"
        >
          {docSession.status}{docSession.dirty ? ' •' : ''}
        </span>
      </header>

      <div className="screen-dsl-config-bar" role="toolbar" aria-label="Screen Schema Studio configuration">
        <fieldset className="screen-dsl-format-group">
          <legend>{labels.dslFormat}</legend>
          {FORMATS.map((fmt) => (
            <label key={fmt} className="screen-dsl-radio">
              <input
                type="radio"
                name="screen-dsl-format"
                value={fmt}
                checked={activeFormat === fmt}
                onChange={() => { setActiveFormat(fmt); setStatus(''); }}
              />
              {FORMAT_LABEL[fmt]}
            </label>
          ))}
        </fieldset>

        <fieldset className="screen-dsl-mode-group">
          <legend>{labels.dslMode}</legend>
          {IMPORT_MODES.map((mode) => (
            <label key={mode} className="screen-dsl-radio">
              <input
                type="radio"
                name="screen-dsl-mode"
                value={mode}
                checked={activeMode === mode}
                onChange={() => { setActiveMode(mode); setStatus(''); }}
              />
              {MODE_LABEL[mode]}
            </label>
          ))}
        </fieldset>

        {targetSummary.requiresTarget ? (
          <div
            className={`screen-dsl-target-summary${targetSummary.targetMissing ? ' target-missing' : ''}`}
            aria-label={targetSummary.targetMissing ? 'No target screen selected' : `Target: ${targetScreenIds.join(', ')}`}
            data-testid="screen-dsl-target-summary"
          >
            {targetSummary.targetMissing
              ? `${labels.dslSelectScreenFor} ${MODE_LABEL[activeMode]}`
              : `${labels.dslTarget}: ${targetScreenIds.join(', ')}`}
          </div>
        ) : null}

        <div className="screen-dsl-actions">
          <button type="button" onClick={generateFromProject} data-testid="screen-dsl-generate-btn">
            {labels.dslGenerateFromProject}
          </button>
          <button
            type="button"
            onClick={() => { void openFile(); }}
            disabled={fileBusy}
            data-testid="screen-dsl-open-file-btn"
          >
            {fileUIState === 'opening' ? labels.dslOpening : labels.dslOpenFile}
          </button>
          <button
            type="button"
            onClick={() => { void exportCanonical(); }}
            disabled={fileBusy}
            data-testid="screen-dsl-export-btn"
          >
            {fileUIState === 'exporting' ? labels.dslExporting : labels.dslExportCanonical}
          </button>
          <button type="button" onClick={runPreview} disabled={!canPreview} data-testid="screen-dsl-preview-btn">
            {docSession.status === 'stale' ? labels.dslRePreview : labels.dslPreview}
          </button>
          <button
            type="button"
            onClick={requestApply}
            disabled={!canApply || noOp}
            aria-disabled={!canApply || noOp}
            aria-describedby={applyDisabledReason ? 'screen-dsl-apply-reason' : undefined}
            data-testid="screen-dsl-apply-btn"
          >
            {labels.dslApply}
          </button>
          {applyDisabledReason ? (
            <span id="screen-dsl-apply-reason" className="screen-dsl-apply-reason" role="status" aria-live="polite">
              {applyDisabledReasonLabel(applyDisabledReason.code, labels)}
            </span>
          ) : null}
          <button type="button" onClick={discardDraft} data-testid="screen-dsl-discard-btn">
            {labels.dslDiscard}
          </button>
        </div>
      </div>

      {docSession.staleReason ? (
        <div className="screen-dsl-stale-banner" role="alert" aria-live="assertive" data-testid="screen-dsl-stale-banner">
          <strong>{labels.dslStaleLabel}</strong> {docSession.staleReason}. {labels.dslRerunPreview}
        </div>
      ) : null}

      {noOp && preview ? (
        <div className="screen-dsl-noop-banner" role="status" aria-live="polite" data-testid="screen-dsl-noop-banner">
          {labels.dslNoopBanner}
        </div>
      ) : null}

      <div className="screen-dsl-editor-area">
        <label className="screen-dsl-editor-label" htmlFor="screen-dsl-source">
          {labels.dslSourceLabel} ({FORMAT_LABEL[activeFormat]})
          {docSession.dirty ? <span className="screen-dsl-dirty-marker" aria-label="modified"> •</span> : null}
        </label>
        <textarea
          id="screen-dsl-source"
          name="screen-dsl-source"
          className="screen-dsl-source"
          aria-label={`Screen DSL source (${FORMAT_LABEL[activeFormat]})`}
          data-testid={`screen-dsl-source-${activeFormat}`}
          value={docSession.sourceText}
          spellCheck={false}
          onChange={(event) => updateSource(event.target.value)}
        />
        <p
          className={`screen-dsl-doc-status status-${docSession.status}`}
          aria-live="polite"
          data-testid="screen-dsl-doc-status"
        >
          {docSession.status}{docSession.dirty ? ' (modified)' : ''}
          {docSession.staleReason ? ` — ${docSession.staleReason}` : ''}
        </p>
      </div>

      {preview ? (
        <section className="screen-dsl-result-area" aria-label="Preview results">
          <nav className="screen-dsl-result-tabs" role="tablist" aria-label="Preview result tabs">
            {(['diagnostics', 'diff', 'raster', 'budget'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? 'active' : ''}
                onClick={() => setActiveTab(tab)}
                data-testid={`screen-dsl-tab-${tab}`}
              >
                {tab === 'diagnostics' ? `${labels.dslDiagnosticsTab} (${diagnosticGroups.flatMap((g) => g.items).length})` :
                 tab === 'diff' ? `${labels.dslChangesTab} (${preview.semanticDiff?.operations.length ?? 0})` :
                 tab === 'raster' ? labels.dslRasterTab : labels.dslPixelBudgetTab}
              </button>
            ))}
          </nav>

          <div role="tabpanel" aria-label={`${activeTab} panel`}>
            {activeTab === 'diagnostics' ? <DiagnosticsPanel groups={diagnosticGroups} labels={labels} /> :
             activeTab === 'diff' ? <SemanticDiffPanel groups={semanticGroups} preview={preview} labels={labels} /> :
             activeTab === 'raster' ? <RasterPanel rasterSummary={rasterSummary} labels={labels} /> :
             <PixelBudgetPanel preview={preview} labels={labels} />}
          </div>
        </section>
      ) : null}

      {status ? (
        <p className="screen-dsl-status" role="status" aria-live="polite" data-testid="screen-dsl-status">
          {status}
        </p>
      ) : null}

      {showApplyDialog ? (
        <ScreenDslApplyDialogComp
          ref={dialogRef}
          summary={selectDestructiveSummary(preview ?? null)}
          preview={preview ?? null}
          labels={labels}
          onConfirm={executeApply}
          onCancel={() => { setShowApplyDialog(false); dialogRef.current?.close(); setStatus('Apply cancelled.'); }}
        />
      ) : null}

      {dirtyReplacement ? (
        <dialog
          ref={replaceDialogRef}
          className="screen-dsl-replace-dialog"
          aria-labelledby="screen-dsl-replace-title"
          aria-modal="true"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelReplacement(); } }}
          data-testid="screen-dsl-replace-dialog"
        >
          <h3 id="screen-dsl-replace-title">{labels.dslReplaceTitle}</h3>
          <p>
            {labels.dslReplaceBody} <strong>{dirtyReplacement.pendingFilename}</strong> {labels.dslReplaceBodySuffix}
          </p>
          <div className="screen-dsl-dialog-actions">
            <button type="button" autoFocus onClick={cancelReplacement} data-testid="screen-dsl-replace-cancel">
              {labels.dslKeepDraft}
            </button>
            <button type="button" onClick={confirmReplacement} data-testid="screen-dsl-replace-confirm">
              {labels.dslReplaceWithFile}
            </button>
          </div>
        </dialog>
      ) : null}
      {showTutorial ? (
        <TutorialOverlay workspace="screen-dsl" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}

// — Sub-components —

function DiagnosticsPanel({ groups, labels }: { readonly groups: ScreenDslDiagnosticGroup[]; readonly labels: UiText }): React.ReactElement {
  if (groups.length === 0) {
    return <p className="screen-dsl-empty-panel" data-testid="screen-dsl-no-diagnostics">{labels.dslNoDiagnostics}</p>;
  }
  return (
    <div className="screen-dsl-diagnostics" data-testid="screen-dsl-diagnostics">
      {groups.map((group) => (
        <section key={group.label} className="screen-dsl-diag-group">
          <h4>{group.label}</h4>
          <ul aria-label={`${group.label} diagnostics`}>
            {group.items.map((item, idx) => (
              <li
                key={`${item.code}-${idx}`}
                className={`screen-dsl-diag severity-${item.severity}`}
                data-testid={`screen-dsl-diag-${item.severity}`}
              >
                <span className="screen-dsl-diag-severity" aria-label={`Severity: ${item.severity}`}>{item.severity}</span>
                <strong className="screen-dsl-diag-code">{item.code}</strong>
                {item.line !== undefined ? (
                  <span
                    className="screen-dsl-diag-location"
                    aria-label={`Line ${item.line}, column ${item.column ?? 0}`}
                  >
                    {item.line}:{item.column ?? 0}
                  </span>
                ) : null}
                <span className="screen-dsl-diag-message">{item.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SemanticDiffPanel({ groups, preview, labels }: { readonly groups: ScreenDslSemanticGroup[]; readonly preview: ScreenDslPreviewResult; readonly labels: UiText }): React.ReactElement {
  if (!preview.semanticDiff || preview.semanticDiff.operations.length === 0) {
    return <p className="screen-dsl-empty-panel" data-testid="screen-dsl-no-changes">{labels.dslNoChanges}</p>;
  }
  return (
    <div className="screen-dsl-semantic-diff" data-testid="screen-dsl-semantic-diff">
      {preview.destructive ? (
        <p className="screen-dsl-destructive-warning" role="alert">{labels.dslDestructiveWarning}</p>
      ) : null}
      {groups.map((group) => (
        <section key={group.label} className="screen-dsl-diff-group">
          <h4>{group.label}{group.destructive ? ' ⚠' : ''}</h4>
          <ul aria-label={`${group.label} changes`}>
            {group.items.map((item, idx) => (
              <li
                key={`${item.type}-${item.id}-${idx}`}
                className={item.destructive ? 'screen-dsl-change destructive' : 'screen-dsl-change'}
                data-testid={`screen-dsl-change-${item.type}`}
              >
                <strong>{item.type}</strong>
                <span>{item.id}</span>
                {item.destructive ? (
                  <span className="screen-dsl-destructive-marker" aria-label="Destructive change">{labels.dslDestructiveMarker}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RasterPanel({ rasterSummary, labels }: { readonly rasterSummary: ScreenDslRasterSummary | null; readonly labels: UiText }): React.ReactElement {
  if (!rasterSummary) {
    return <p className="screen-dsl-empty-panel" data-testid="screen-dsl-no-raster">{labels.dslNoRaster}</p>;
  }
  return (
    <div className="screen-dsl-raster-panel" data-testid="screen-dsl-raster-panel">
      <dl className="screen-dsl-raster-summary" aria-label="Raster summary">
        <dt>{labels.dslRasterBefore}</dt><dd data-testid="screen-dsl-raster-before">{rasterSummary.beforeBytes}</dd>
        <dt>{labels.dslRasterAfter}</dt><dd data-testid="screen-dsl-raster-after">{rasterSummary.afterBytes}</dd>
        <dt>{labels.dslRasterDelta}</dt><dd data-testid="screen-dsl-raster-delta">{rasterSummary.delta >= 0 ? '+' : ''}{rasterSummary.delta} bytes</dd>
        <dt>{labels.dslRasterChangedScreens}</dt><dd data-testid="screen-dsl-raster-changed-count">{rasterSummary.changedScreens.length}</dd>
      </dl>
      {rasterSummary.changedScreens.length > 0 ? (
        <ul aria-label="Changed screens">
          {rasterSummary.changedScreens.map((id) => <li key={id}>{id}</li>)}
        </ul>
      ) : (
        <p>{labels.dslNoPixelChanges}</p>
      )}
      <p className="screen-dsl-raster-note">
        {labels.dslRasterNote}
      </p>
    </div>
  );
}

function PixelBudgetPanel({ preview, labels }: { readonly preview: ScreenDslPreviewResult; readonly labels: UiText }): React.ReactElement {
  const raster = preview.rasterPreview;
  if (!raster) {
    return <p className="screen-dsl-empty-panel" data-testid="screen-dsl-no-budget">{labels.dslNoBudget}</p>;
  }
  return (
    <div className="screen-dsl-budget-panel" data-testid="screen-dsl-budget-panel">
      <dl aria-label="Pixel budget summary">
        <dt>{labels.dslBudgetBytes}</dt><dd data-testid="screen-dsl-budget-bytes">{raster.afterByteLength}</dd>
        <dt>{labels.dslBudgetChanged}</dt><dd data-testid="screen-dsl-budget-changed">{raster.changedScreens.length}</dd>
      </dl>
      <p className="screen-dsl-budget-note">
        {labels.dslBudgetNote}
      </p>
    </div>
  );
}

interface ScreenDslApplyDialogProps {
  readonly summary: string;
  readonly preview: ScreenDslPreviewResult | null;
  readonly labels: UiText;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const ScreenDslApplyDialogComp = forwardRef<HTMLDialogElement, ScreenDslApplyDialogProps>(
  function ScreenDslApplyDialog({ summary, preview, labels, onConfirm, onCancel }, ref) {
    const ops = preview?.semanticDiff?.operations ?? [];
    const deletions = ops.filter((op) => op.type === 'object.delete' || op.type === 'screen.delete');

    return (
      <dialog
        ref={ref}
        className="screen-dsl-apply-dialog"
        aria-labelledby="screen-dsl-dialog-title"
        aria-modal="true"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
        data-testid="screen-dsl-apply-dialog"
      >
        <h3 id="screen-dsl-dialog-title">{labels.dslConfirmDestructiveTitle}</h3>
        <p>{summary}</p>
        {deletions.length > 0 ? (
          <ul aria-label="Items to be deleted">
            {deletions.map((op, idx) => (
              <li key={`${op.type}-${op.id}-${idx}`}>{op.type}: {op.id}</li>
            ))}
          </ul>
        ) : null}
        <p className="screen-dsl-dialog-undo-note">{labels.dslUndoNote}</p>
        <div className="screen-dsl-dialog-actions">
          <button type="button" autoFocus onClick={onCancel} data-testid="screen-dsl-dialog-cancel">{labels.dslCancel}</button>
          <button type="button" className="destructive" onClick={onConfirm} data-testid="screen-dsl-dialog-confirm">{labels.dslApplyChanges}</button>
        </div>
      </dialog>
    );
  }
);

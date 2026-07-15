import type React from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Code2,
  Download,
  FolderOpen,
  Globe2,
  History,
  Monitor,
  Network,
  PanelTop,
  Play,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Save,
  Settings,
  Tag,
  Terminal,
  Wand2,
  Workflow
} from 'lucide-react';
import { WorkspaceRouterProvider, useWorkspaceRouter } from '../app/WorkspaceRouter';
import type { WorkspaceLocation, WorkspaceMode, FsmState, FsmTransition } from '../domain/project';
import { createBlankProject } from '../entities/project/factory';
import { createDemoProject } from '../entities/project/demo';
import { PRODUCT_IDENTITY, SUPPORTED_LANGUAGES } from './config/constants';
import { UI_TEXT } from './config/i18n';
import { OperationManualDialog } from './components/OperationManualDialog';
import { MasterWizard } from '../features/master-wizard/MasterWizard';
import { useProjectStore } from './store/projectStore';
import { sanitizeFilename, assertImportFileSize } from '../shared/lib/security';
import {
  createProjectFileV5,
  migrateLegacySnapshot,
  migrateProject
} from '../services/projectMigrationService';
import { hasBlockingValidationIssues } from '../services/projectValidationService';
import { exportScreenEmbedded, EMBEDDED_FORMAT_EXTENSIONS, type EmbeddedExportFormat } from './utils/codegen';
import type { HmiTag } from '../domain/tag';
import type { BackendProcedure } from '../domain/procedure';
import type { AlarmDefinition } from '../domain/alarm';
import { GuidedTour } from '../features/guided-tour/GuidedTour';
import { FIRST_HMI_TOUR } from '../features/guided-tour/tourScenarios';

const AUTOSAVE_KEY_V5 = 'lcd-bitmap-ide.project.autosave.v5';
const LEGACY_AUTOSAVE_KEYS = [
  'lcdVectorEditor.lastState.v4',
  'lcdVectorEditor.lastState.v3',
  'spectrodesigner.project.autosave.v2'
] as const;
const LOCAL_HISTORY_KEY = 'lcd-bitmap-ide.project-history.v5';
const FsmWorkspace = lazy(() => import('../features/fsm/FsmWorkspace').then((module) => ({ default: module.FsmWorkspace })));
const LcdWorkspace = lazy(() => import('../features/lcd/LcdWorkspace').then((module) => ({ default: module.LcdWorkspace })));
const ControlPanelWorkspace = lazy(() => import('../features/control-panel/ControlPanelWorkspace').then((module) => ({ default: module.ControlPanelWorkspace })));
const TagEditorWorkspace = lazy(() => import('../features/tag-editor/TagEditorWorkspace').then((module) => ({ default: module.TagEditorWorkspace })));
const ProcedureEditorWorkspace = lazy(() => import('../features/procedure-editor/ProcedureEditorWorkspace').then((module) => ({ default: module.ProcedureEditorWorkspace })));
const RuntimeWorkspace = lazy(() => import('../features/runtime-workspace/RuntimeWorkspace').then((module) => ({ default: module.RuntimeWorkspace })));
const AlarmWorkspace = lazy(() => import('../features/alarms/AlarmWorkspace').then((module) => ({ default: module.AlarmWorkspace })));
const ScreenDslStudio = lazy(() => import('../features/screen-dsl-studio/ScreenDslStudio').then((module) => ({ default: module.ScreenDslStudio })));
const SettingsWorkspace = lazy(() => import('../features/settings/SettingsWorkspace').then((module) => ({ default: module.SettingsWorkspace })));
const TextRegistryWorkspace = lazy(() => import('../features/text-registry/TextRegistryWorkspace').then((module) => ({ default: module.TextRegistryWorkspace })));

interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export function App(): React.ReactElement {
  return (
    <WorkspaceRouterProvider>
      <AppShell />
    </WorkspaceRouterProvider>
  );
}

function AppShell(): React.ReactElement {
  const {
    project,
    language,
    fontGlyphs,
    loadedFonts,
    savedMeasurements,
    canUndo,
    canRedo,
    setLanguage,
    loadProjectSnapshot,
    updateProjectMetadata,
    undo,
    redo,
    validate
  } = useProjectStore();
  const { location, navigate } = useWorkspaceRouter();
  const labels = UI_TEXT[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showManual, setShowManual] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; name: string; payload: unknown }>>(() => readHistory());

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }, [language]);

  useEffect(() => {
    if (!project) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const payload = createProjectFileV5({
        project,
        language,
        fontGlyphs,
        loadedFonts,
        savedMeasurements
      }, language);
      localStorage.setItem(AUTOSAVE_KEY_V5, JSON.stringify(payload));
      // Push state to main process for API/MCP servers
      window.spectroDesigner?.ipcSend?.('api:project-state', { project });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [fontGlyphs, language, loadedFonts, project, savedMeasurements]);

  useEffect(() => {
    window.spectroDesigner?.onMutateRequest?.((requestId, action, payload) => {
      Promise.resolve()
        .then(() => runMutationAction(action, payload))
        .then((result) => window.spectroDesigner?.ipcSend?.('api:mutate-res', { requestId, result: result ?? null }))
        .catch((error: unknown) =>
          window.spectroDesigner?.ipcSend?.('api:mutate-res', {
            requestId,
            error: error instanceof Error ? error.message : String(error)
          })
        );
    });
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const commandKey = event.ctrlKey || event.metaKey;
      if (!commandKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      } else if (key === 'p') {
        event.preventDefault();
        navigateTo({ mode: 'runtime' });
      } else if (key === 'e') {
        event.preventDefault();
        navigate({ mode: 'fsm' });
      } else if (key === 's') {
        event.preventDefault();
        saveProject();
      } else if (key === 'o') {
        event.preventDefault();
        fileInputRef.current?.click();
      } else if (key === 'n') {
        event.preventDefault();
        createNewProject();
      } else if (key === 'm' || key === '?') {
        event.preventDefault();
        setShowManual(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const pushToast = (text: string, tone: Toast['tone'] = 'info'): void => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((items) => [...items, { id, text, tone }].slice(-5));
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200);
  };

  const navigateTo = (next: WorkspaceLocation): void => {
    if (next.mode === 'runtime') {
      const issues = validate();
      if (hasBlockingValidationIssues(issues)) {
        const errorCount = issues.filter((issue) => issue.severity === 'error').length;
        pushToast(
          language === 'ru'
            ? `Выполнение открыто, но в проекте ${errorCount} ошибок валидации — экран может быть пуст. Список ошибок слева.`
            : `Runtime opened, but the project has ${errorCount} validation errors — the screen may stay blank. See the list on the left.`,
          'warning'
        );
      }
    }
    navigate(next);
  };

  const snapshot = (): ReturnType<typeof createProjectFileV5> | null => project
    ? createProjectFileV5({ project, language, fontGlyphs, loadedFonts, savedMeasurements }, language)
    : null;

  const saveProject = (): void => {
    validate();
    const payload = snapshot();
    if (!payload || !project) {
      return;
    }
    const filename = `${sanitizeFilename(project.meta.name || project.meta.id)}.lcdproj`;
    downloadJson(filename, payload);
    setLastSavedAt(project.meta.updatedAt);
    const entry = { id: `history-${Date.now()}`, name: `${project.meta.name} ${new Date().toLocaleString()}`, payload };
    const nextHistory = [entry, ...history].slice(0, 20);
    setHistory(nextHistory);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(nextHistory));
    pushToast(`${labels.saveProject}: ${filename}`, 'success');
  };

  const exportProject = (): void => {
    const issues = validate();
    if (hasBlockingValidationIssues(issues)) {
      pushToast(`Export blocked: ${issues.filter((issue) => issue.severity === 'error').length} validation errors.`, 'danger');
      return;
    }
    const payload = snapshot();
    if (payload && project) {
      downloadJson(`${sanitizeFilename(project.meta.id)}-v5.json`, payload);
      pushToast('Project JSON exported.', 'success');
    }
  };

  const openProject = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      assertImportFileSize(file);
      const migrated = migrateProject(JSON.parse(await file.text()));
      loadProjectSnapshot(migrated);
      setLastSavedAt(migrated.project.meta.updatedAt);
      navigate({ mode: 'fsm', stateId: migrated.project.fsm.stateOrder[0] });
      pushToast(`${labels.openProject}: ${file.name}`, 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : labels.invalidProjectFile, 'danger');
    }
  };

  const createNewProject = (): void => {
    const name = window.prompt(labels.projectNamePrompt, 'Universal LCD project');
    if (!name) {
      return;
    }
    loadProjectSnapshot(migrateLegacySnapshot(createBlankProject({ name })));
    setLastSavedAt(null);
    navigate({ mode: 'fsm' });
  };

  const loadDemo = (): void => {
    loadProjectSnapshot(migrateLegacySnapshot(createDemoProject()));
    setLastSavedAt(null);
    navigate({ mode: 'fsm' });
  };

  const restoreAutosave = (): void => {
    const restored = readAutosave();
    if (restored) {
      loadProjectSnapshot(restored);
      setLastSavedAt(restored.project.meta.updatedAt);
      navigate({ mode: 'fsm', stateId: restored.project.fsm.stateOrder[0] });
      pushToast(labels.autosaved, 'success');
      return;
    }
    loadProjectSnapshot(migrateLegacySnapshot(createDemoProject()));
    setLastSavedAt(null);
    navigate({ mode: 'fsm' });
  };

  const cycleLanguage = (): void => {
    const index = SUPPORTED_LANGUAGES.indexOf(language);
    setLanguage(SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length]);
  };

  if (!project) {
    return (
      <main className="app-shell startup-shell">
        <section className="startup-dialog" role="dialog" aria-modal="true" aria-labelledby="startup-title">
          <div>
            <h1 id="startup-title">{PRODUCT_IDENTITY.name}</h1>
            <p>{labels.startupPrompt}</p>
          </div>
          <div className="startup-actions">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={17} />{labels.openProject}
            </button>
            <button type="button" onClick={createNewProject}>
              <Monitor size={17} />{labels.createProject}
            </button>
            <button type="button" onClick={restoreAutosave}>
              <History size={17} />{labels.restoreAutosave}
            </button>
            <button type="button" onClick={loadDemo}>
              <Play size={17} />{labels.openDemo}
            </button>
          </div>
        </section>
        <input ref={fileInputRef} type="file" accept=".json,.lcdproj,application/json" hidden onChange={(event) => void openProject(event)} />
        <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
      </main>
    );
  }

  const unsaved = project.meta.updatedAt !== lastSavedAt;
  const errors = project.validation.issues.filter((issue) => issue.severity === 'error').length;

  return (
    <main className="app-shell">
      <header className="project-header">
        <div className="project-identity">
          <h1>{PRODUCT_IDENTITY.name}</h1>
          <label>
            <span>{language === 'ru' ? 'Проект' : 'Project'}</span>
            <input
              value={project.meta.name}
              onChange={(event) => updateProjectMetadata({ name: event.target.value })}
              aria-label={language === 'ru' ? 'Проект' : 'Project'}
            />
          </label>
          <span className="project-version">v{project.meta.version} / schema 6</span>
        </div>
        <div className="project-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()}><FolderOpen size={16} />{labels.openProject}</button>
          <button type="button" onClick={saveProject} data-testid="project-save"><Save size={16} />{labels.saveProject}</button>
          <button type="button" onClick={exportProject}><Download size={16} />{labels.exportUniversal}</button>
          <button type="button" onClick={undo} disabled={!canUndo} data-testid="app-undo"><RotateCcw size={16} />{labels.undo}</button>
          <button type="button" onClick={redo} disabled={!canRedo} data-testid="app-redo"><RotateCw size={16} />{labels.redo}</button>
          <button type="button" onClick={() => setShowManual(true)}><BookOpen size={16} />{labels.manual}</button>
          <button type="button" onClick={() => setShowWizard(true)}><Wand2 size={16} />{labels.wizard}</button>
          <button type="button" onClick={() => setShowTour(true)}><BookOpen size={16} />{labels.startTour}</button>
          <select
            aria-label={labels.versionHistory}
            value=""
            onChange={(event) => {
              const entry = history.find((item) => item.id === event.target.value);
              if (entry) {
                loadProjectSnapshot(migrateProject(entry.payload));
              }
            }}
          >
            <option value="">{labels.versionHistory}</option>
            {history.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <button type="button" onClick={cycleLanguage} aria-label="Toggle interface language"><Globe2 size={16} />{language.toUpperCase()}</button>
          <button type="button" onClick={createNewProject}>{labels.new}</button>
          <button type="button" onClick={loadDemo}>{labels.demo}</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json,.lcdproj,application/json" hidden onChange={(event) => void openProject(event)} />
      </header>

      <nav className="workspace-navigation" aria-label={labels.workspaces} data-testid="workspace-navigation">
        <WorkspaceButton mode="fsm" active={location.mode === 'fsm'} onClick={() => navigateTo({ mode: 'fsm' })} icon={<Workflow size={17} />} label={labels.fsmEditor} />
        <WorkspaceButton mode="lcd" active={location.mode === 'lcd'} onClick={() => navigateTo({ mode: 'lcd' })} icon={<Monitor size={17} />} label={labels.lcdEditor} />
        <WorkspaceButton mode="control-panel" active={location.mode === 'control-panel'} onClick={() => navigateTo({ mode: 'control-panel' })} icon={<PanelTop size={17} />} label={labels.controlPanel} />
        <WorkspaceButton mode="tags" active={location.mode === 'tags'} onClick={() => navigate({ mode: 'tags' })} icon={<Tag size={17} />} label={labels.tagsWorkspace} />
        <WorkspaceButton mode="procedures" active={location.mode === 'procedures'} onClick={() => navigate({ mode: 'procedures' })} icon={<Terminal size={17} />} label={labels.proceduresWorkspace} />
        <WorkspaceButton mode="alarms" active={location.mode === 'alarms'} onClick={() => navigate({ mode: 'alarms' })} icon={<AlertCircle size={17} />} label={labels.alarmsWorkspace} />
        <WorkspaceButton mode="runtime" active={location.mode === 'runtime'} onClick={() => navigateTo({ mode: 'runtime' })} icon={<PlayCircle size={17} />} label={labels.runtimeWorkspace} />
        <WorkspaceButton mode="screen-dsl" active={location.mode === 'screen-dsl'} onClick={() => navigate({ mode: 'screen-dsl' })} icon={<Code2 size={17} />} label={labels.screenDslWorkspace} />
        <WorkspaceButton mode="text-registry" active={location.mode === 'text-registry'} onClick={() => navigate({ mode: 'text-registry' })} icon={<Tag size={17} />} label={labels.textRegistryWorkspace} />
        <WorkspaceButton mode="settings" active={location.mode === 'settings'} onClick={() => navigate({ mode: 'settings' })} icon={<Settings size={17} />} label={labels.settingsWorkspace} />
      </nav>

      <section className="workspace-host">
        <Suspense fallback={<section className="workspace-empty">{labels.loadingWorkspace}</section>}>
          {location.mode === 'fsm' ? <FsmWorkspace requestedStateId={location.stateId} /> : null}
          {location.mode === 'lcd' ? <LcdWorkspace requestedScreenId={location.screenId} /> : null}
          {location.mode === 'control-panel' ? <ControlPanelWorkspace requestedElementId={location.elementId} /> : null}
          {location.mode === 'tags' ? <TagEditorWorkspace /> : null}
          {location.mode === 'procedures' ? <ProcedureEditorWorkspace /> : null}
          {location.mode === 'alarms' ? <AlarmWorkspace /> : null}
          {location.mode === 'runtime' ? <RuntimeWorkspace /> : null}
          {location.mode === 'screen-dsl' ? <ScreenDslStudioWrapper screenId={location.screenId} /> : null}
          {location.mode === 'text-registry' ? <TextRegistryWorkspace /> : null}
          {location.mode === 'settings' ? <SettingsWorkspace /> : null}
        </Suspense>
      </section>

      <footer className="statusbar">
        <span>{project.display.width}x{project.display.height}</span>
        <span><Network size={13} />{project.fsm.stateOrder.length} {labels.statesMetric} / {project.fsm.transitionOrder.length} {labels.transitionsMetric}</span>
        <span>{project.screenOrder.length} {labels.screens} / {project.controlPanel.elementOrder.length} {labels.panelElements}</span>
        <span className={errors > 0 ? 'status-errors' : 'status-valid'}>{errors > 0 ? `${errors} ${labels.errors}` : labels.valid}</span>
        <span className={unsaved ? 'status-unsaved' : 'status-saved'}>{unsaved ? labels.unsavedChanges : labels.saved}</span>
      </footer>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
      {showManual ? <OperationManualDialog labels={labels} language={language} onClose={() => setShowManual(false)} /> : null}
      {showWizard ? (
        <MasterWizard
          language={language}
          onClose={() => setShowWizard(false)}
          onScenarioComplete={(scenario) => {
            if (scenario === 'demo-project') {
              loadDemo();
            }
            setShowWizard(false);
          }}
        />
      ) : null}
      {showTour ? (
        <GuidedTour steps={FIRST_HMI_TOUR} language={language} onClose={() => setShowTour(false)} />
      ) : null}
    </main>
  );
}

function WorkspaceButton({
  mode,
  active,
  onClick,
  icon,
  label
}: {
  mode: WorkspaceMode;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <button type="button" data-workspace={mode} data-testid={`workspace-${mode}`} className={active ? 'active' : ''} onClick={onClick}>
      {icon}{label}
    </button>
  );
}

function ScreenDslStudioWrapper({ screenId }: { screenId?: string }): React.ReactElement {
  const { session, language, applyScreenDslPreview } = useProjectStore();
  if (!session) {
    return <section className="workspace-empty">No project loaded.</section>;
  }
  return (
    <ScreenDslStudio
      session={session}
      selectedScreenId={screenId ?? null}
      language={language}
      onApplyPreview={applyScreenDslPreview}
    />
  );
}

function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}): React.ReactElement | null {
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className={`toast toast-${toast.tone}`} onClick={() => onDismiss(toast.id)}>
          {toast.text}
        </button>
      ))}
    </div>
  );
}

function readAutosave(): ReturnType<typeof migrateProject> | null {
  const keys = [AUTOSAVE_KEY_V5, ...LEGACY_AUTOSAVE_KEYS];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      return migrateProject(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return null;
}

function readHistory(): Array<{ id: string; name: string; payload: unknown }> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Dispatches a single API/MCP write request to the Zustand store. Invoked from
 * the `api:mutate-req` IPC handler registered in AppShell — every external
 * mutation (REST API, MCP tools) ultimately runs through here.
 */
async function runMutationAction(action: string, payload: unknown): Promise<unknown> {
  const store = useProjectStore.getState();
  const body = (payload ?? {}) as Record<string, unknown>;

  switch (action) {
    case 'addFsmState': {
      store.addFsmState();
      const newStateId = useProjectStore.getState().selectedStateId;
      if (newStateId && typeof body['title'] === 'string' && body['title']) {
        store.updateFsmState(newStateId, { title: body['title'] as string });
      }
      return { stateId: newStateId };
    }
    case 'updateFsmState':
      store.updateFsmState(body['stateId'] as string, body['updates'] as Partial<FsmState>);
      return { stateId: body['stateId'] };
    case 'deleteFsmState':
      store.deleteFsmState(body['stateId'] as string);
      return { stateId: body['stateId'] };
    case 'addFsmTransition': {
      store.addFsmTransition(body['from'] as string, body['to'] as string, body['eventId'] as string | undefined);
      const newTransitionId = useProjectStore.getState().selectedTransitionId;
      return { transitionId: newTransitionId };
    }
    case 'updateFsmTransition':
      store.updateFsmTransition(body['transitionId'] as string, body['updates'] as Partial<FsmTransition>);
      return { transitionId: body['transitionId'] };
    case 'deleteFsmTransition':
      store.deleteFsmTransition(body['transitionId'] as string);
      return { transitionId: body['transitionId'] };

    case 'upsertHmiTag':
      store.upsertHmiTag(body as unknown as HmiTag);
      return { tagId: (body as unknown as HmiTag).id };
    case 'deleteHmiTag':
      store.deleteHmiTag(body['tagId'] as string);
      return { tagId: body['tagId'] };

    case 'upsertHmiProcedure':
      store.upsertHmiProcedure(body as unknown as BackendProcedure);
      return { procedureId: (body as unknown as BackendProcedure).id };
    case 'deleteHmiProcedure':
      store.deleteHmiProcedure(body['procedureId'] as string);
      return { procedureId: body['procedureId'] };

    case 'upsertAlarm':
      store.upsertAlarm(body as unknown as AlarmDefinition);
      return { alarmId: (body as unknown as AlarmDefinition).id };
    case 'deleteAlarm':
      store.deleteAlarm(body['alarmId'] as string);
      return { alarmId: body['alarmId'] };

    case 'compileProject':
      return compileProjectForExternalRequest(body);

    default:
      throw new Error(`Unknown mutation action: ${action}`);
  }
}

/** Compiles one or all screens to an embedded export format, for the REST API / MCP `compile_screen` tool. */
function compileProjectForExternalRequest(body: Record<string, unknown>): { artifacts: Array<{ screenId: string; filename: string; format: string; content: string; encoding: 'utf8' | 'base64' }> } {
  const store = useProjectStore.getState();
  const project = store.project;
  if (!project) {
    throw new Error('No project loaded');
  }
  const format = (body['format'] as EmbeddedExportFormat) ?? 'c-vertical-lsb';
  const scope = (body['scope'] as string) ?? 'all-screens';
  const requestedScreenId = body['screenId'] as string | undefined;

  const targetScreenIds =
    scope === 'selected-screen'
      ? [requestedScreenId ?? store.selectedScreenId ?? project.screenOrder[0]].filter((id): id is string => Boolean(id))
      : project.screenOrder;

  if (targetScreenIds.length === 0) {
    throw new Error('No LCD screens available to compile');
  }

  const artifacts = targetScreenIds.map((screenId) => {
    const screen = project.screens[screenId];
    if (!screen) {
      throw new Error(`Screen not found: ${screenId}`);
    }
    const symbolName = `${project.meta.name}_${screen.name || screen.id}_screen`;
    const result = exportScreenEmbedded(screen.objects, format, {
      symbolName,
      language: store.language,
      width: screen.width,
      height: screen.height
    });
    const ext = EMBEDDED_FORMAT_EXTENSIONS[format] ?? 'h';
    if (typeof result === 'string') {
      return { screenId, filename: `${screen.id}_screen.${ext}`, format, content: result, encoding: 'utf8' as const };
    }
    return { screenId, filename: `${screen.id}_screen.${ext}`, format, content: uint8ArrayToBase64(result), encoding: 'base64' as const };
  });

  return { artifacts };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

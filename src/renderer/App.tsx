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
  PanelsTopLeft,
  Package,
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
import type { WorkspaceLocation, WorkspaceMode } from '../domain/project';
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
import { GuidedTour } from '../features/guided-tour/GuidedTour';
import { FIRST_HMI_TOUR } from '../features/guided-tour/tourScenarios';
import { NotificationCenter, NotificationViewport } from './components/NotificationCenter';
import { beginOperation, notify, type NotificationTone } from './notifications/notificationStore';
import type { AutomationRequest } from '../shared/automation';
import { executeAutomationRequest } from './automation/automationDispatcher';

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
const HmiHandoffWorkspace = lazy(() => import('../features/hmi-handoff/HmiHandoffWorkspace').then((module) => ({ default: module.HmiHandoffWorkspace })));
const HmiDesignerWorkspace = lazy(() => import('../features/hmi-designer/HmiDesignerWorkspace').then((module) => ({ default: module.HmiDesignerWorkspace })));

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
    revision,
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; name: string; payload: unknown }>>(() => readHistory());
  const autosaveFailureNotifiedRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }, [language]);

  useEffect(() => {
    const hasUnsavedChanges = Boolean(project && project.meta.updatedAt !== lastSavedAt);
    if (!hasUnsavedChanges) {
      return;
    }
    const preventAccidentalUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventAccidentalUnload);
    return () => window.removeEventListener('beforeunload', preventAccidentalUnload);
  }, [lastSavedAt, project]);

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
      // Push state to main process for API/MCP servers
      window.spectroDesigner?.ipcSend?.('api:project-state', { project, revision });
      try {
        localStorage.setItem(AUTOSAVE_KEY_V5, JSON.stringify(payload));
        autosaveFailureNotifiedRef.current = false;
      } catch (error) {
        console.error('[autosave] local snapshot failed', error);
        if (!autosaveFailureNotifiedRef.current) {
          autosaveFailureNotifiedRef.current = true;
          pushToast(labels.autosaveFailed, 'danger');
        }
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [fontGlyphs, language, loadedFonts, project, revision, savedMeasurements]);

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
    window.spectroDesigner?.onStartupProject?.(({ filename, content }) => {
      try {
        const migrated = migrateProject(JSON.parse(content));
        loadProjectSnapshot(migrated);
        setLastSavedAt(migrated.project.meta.updatedAt);
        navigate({ mode: 'fsm', stateId: migrated.project.fsm.stateOrder[0] });
        pushToast(`${labels.openProject}: ${filename}`, 'success');
      } catch (error) {
        pushToast(error instanceof Error ? error.message : labels.invalidProjectFile, 'danger');
      }
    });
  }, [labels.invalidProjectFile, labels.openProject, loadProjectSnapshot, navigate]);

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

  const pushToast = (text: string, tone: NotificationTone = 'info', message?: string): void => {
    notify({ title: text, message, tone, source: 'application' });
  };

  const navigateTo = (next: WorkspaceLocation): void => {
    if (next.mode === 'runtime') {
      const issues = validate();
      if (hasBlockingValidationIssues(issues)) {
        const errorCount = issues.filter((issue) => issue.severity === 'error').length;
        pushToast(formatUi(labels.runtimeValidationWarning, { count: errorCount }), 'warning');
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
    setHistory(persistHistoryWithinQuota(nextHistory));
    pushToast(`${labels.saveProject}: ${filename}`, 'success');
  };

  const exportProject = (): void => {
    const issues = validate();
    if (hasBlockingValidationIssues(issues)) {
      pushToast(formatUi(labels.exportBlockedWithErrors, {
        count: issues.filter((issue) => issue.severity === 'error').length
      }), 'danger');
      return;
    }
    const payload = snapshot();
    if (payload && project) {
      downloadJson(`${sanitizeFilename(project.meta.id)}-v5.json`, payload);
      pushToast(labels.projectJsonExported, 'success');
    }
  };

  const openProject = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const operation = beginOperation(labels.openProject, { message: file.name, source: 'project-file', dedupeKey: 'project-open' });
    try {
      assertImportFileSize(file);
      const migrated = migrateProject(JSON.parse(await file.text()));
      loadProjectSnapshot(migrated);
      setLastSavedAt(migrated.project.meta.updatedAt);
      navigate({ mode: 'fsm', stateId: migrated.project.fsm.stateOrder[0] });
      operation.succeed(`${labels.openProject}: ${file.name}`);
    } catch (error) {
      operation.fail(labels.invalidProjectFile, error instanceof Error ? error.message : undefined);
    }
  };

  const createNewProject = (): void => {
    const name = window.prompt(labels.projectNamePrompt, labels.defaultProjectName);
    if (!name) {
      return;
    }
    loadProjectSnapshot(migrateLegacySnapshot({ ...createBlankProject({ name }), language }));
    setLastSavedAt(null);
    navigate({ mode: 'fsm' });
  };

  const loadDemo = (): void => {
    loadProjectSnapshot(migrateLegacySnapshot({ ...createDemoProject(), language }));
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
    loadProjectSnapshot(migrateLegacySnapshot({ ...createDemoProject(), language }));
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
          <label className="startup-language">
            <Globe2 size={17} />
            <span>{labels.interfaceLanguage}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as typeof language)}
              data-testid="startup-language"
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="zh">中文</option>
            </select>
          </label>
          <div className="startup-actions">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={17} />{labels.openProject}
            </button>
            <button type="button" onClick={createNewProject} data-testid="startup-create-project">
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
        <NotificationViewport language={language} />
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
            <span>{labels.projectLabel}</span>
            <input
              value={project.meta.name}
              onChange={(event) => updateProjectMetadata({ name: event.target.value })}
              aria-label={labels.projectLabel}
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
          <button
            type="button"
            onClick={cycleLanguage}
            aria-label={labels.interfaceLanguage}
            data-testid="interface-language-cycle"
          >
            <Globe2 size={16} />{language.toUpperCase()}
          </button>
          <NotificationCenter language={language} />
          <button type="button" onClick={createNewProject}>{labels.new}</button>
          <button type="button" onClick={loadDemo}>{labels.demo}</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json,.lcdproj,application/json" hidden onChange={(event) => void openProject(event)} />
      </header>

      <nav className="workspace-navigation" aria-label={labels.workspaces} data-testid="workspace-navigation">
        <WorkspaceButton mode="fsm" active={location.mode === 'fsm'} onClick={() => navigateTo({ mode: 'fsm' })} icon={<Workflow size={17} />} label={labels.fsmEditor} />
        <WorkspaceButton mode="lcd" active={location.mode === 'lcd'} onClick={() => navigateTo({ mode: 'lcd' })} icon={<Monitor size={17} />} label={labels.lcdEditor} />
        <WorkspaceButton mode="control-panel" active={location.mode === 'control-panel'} onClick={() => navigateTo({ mode: 'control-panel' })} icon={<PanelTop size={17} />} label={labels.controlPanel} />
        <WorkspaceButton mode="hmi" active={location.mode === 'hmi'} onClick={() => navigateTo({ mode: 'hmi' })} icon={<PanelsTopLeft size={17} />} label={labels.hmiDesigner} />
        <WorkspaceButton mode="tags" active={location.mode === 'tags'} onClick={() => navigate({ mode: 'tags' })} icon={<Tag size={17} />} label={labels.tagsWorkspace} />
        <WorkspaceButton mode="procedures" active={location.mode === 'procedures'} onClick={() => navigate({ mode: 'procedures' })} icon={<Terminal size={17} />} label={labels.proceduresWorkspace} />
        <WorkspaceButton mode="alarms" active={location.mode === 'alarms'} onClick={() => navigate({ mode: 'alarms' })} icon={<AlertCircle size={17} />} label={labels.alarmsWorkspace} />
        <WorkspaceButton mode="runtime" active={location.mode === 'runtime'} onClick={() => navigateTo({ mode: 'runtime' })} icon={<PlayCircle size={17} />} label={labels.runtimeWorkspace} />
        <WorkspaceButton mode="screen-dsl" active={location.mode === 'screen-dsl'} onClick={() => navigate({ mode: 'screen-dsl' })} icon={<Code2 size={17} />} label={labels.screenDslWorkspace} />
        <WorkspaceButton mode="text-registry" active={location.mode === 'text-registry'} onClick={() => navigate({ mode: 'text-registry' })} icon={<Tag size={17} />} label={labels.textRegistryWorkspace} />
        <WorkspaceButton mode="handoff" active={location.mode === 'handoff'} onClick={() => navigate({ mode: 'handoff' })} icon={<Package size={17} />} label={labels.hmiHandoffWorkspace} />
        <WorkspaceButton mode="settings" active={location.mode === 'settings'} onClick={() => navigate({ mode: 'settings' })} icon={<Settings size={17} />} label={labels.settingsWorkspace} />
      </nav>

      <section className="workspace-host">
        <Suspense fallback={<section className="workspace-empty">{labels.loadingWorkspace}</section>}>
          {location.mode === 'fsm' ? <FsmWorkspace requestedStateId={location.stateId} /> : null}
          {location.mode === 'lcd' ? <LcdWorkspace requestedScreenId={location.screenId} /> : null}
          {location.mode === 'control-panel' ? <ControlPanelWorkspace requestedElementId={location.elementId} /> : null}
          {location.mode === 'hmi' ? <HmiDesignerWorkspace requestedStateId={location.stateId} requestedElementId={location.elementId} /> : null}
          {location.mode === 'tags' ? <TagEditorWorkspace /> : null}
          {location.mode === 'procedures' ? <ProcedureEditorWorkspace /> : null}
          {location.mode === 'alarms' ? <AlarmWorkspace /> : null}
          {location.mode === 'runtime' ? <RuntimeWorkspace /> : null}
          {location.mode === 'screen-dsl' ? <ScreenDslStudioWrapper screenId={location.screenId} /> : null}
          {location.mode === 'text-registry' ? <TextRegistryWorkspace /> : null}
          {location.mode === 'handoff' ? <HmiHandoffWorkspace /> : null}
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

      <NotificationViewport language={language} />
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
    return <section className="workspace-empty">{UI_TEXT[language].noProjectLoaded}</section>;
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

function formatUi(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function readAutosave(): ReturnType<typeof migrateProject> | null {
  const keys = [AUTOSAVE_KEY_V5, ...LEGACY_AUTOSAVE_KEYS];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      return migrateProject(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return null;
}

function persistHistoryWithinQuota(
  entries: Array<{ id: string; name: string; payload: unknown }>
): Array<{ id: string; name: string; payload: unknown }> {
  for (let count = entries.length; count > 0; count -= 1) {
    const candidate = entries.slice(0, count);
    try {
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(candidate));
      return candidate;
    } catch {
      // A large project can exceed the browser quota. Retain as many of the
      // newest snapshots as will fit instead of failing the explicit save.
    }
  }
  return [];
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
  if (action === 'automation.execute') return executeAutomationRequest(payload as AutomationRequest);
  const legacy = legacyAutomationRequest(action, payload);
  if (!legacy) throw new Error(`Unknown mutation action: ${action}`);
  return executeAutomationRequest(legacy);
}

function legacyAutomationRequest(action: string, payload: unknown): AutomationRequest | null {
  const body = (payload ?? {}) as Record<string, unknown>;
  const mapping: Record<string, { command: string; input: unknown }> = {
    addFsmState: { command: 'create_fsm_state', input: body },
    updateFsmState: { command: 'update_fsm_state', input: body },
    deleteFsmState: { command: 'delete_fsm_state', input: body },
    addFsmTransition: { command: 'create_fsm_transition', input: body },
    updateFsmTransition: { command: 'update_fsm_transition', input: body },
    deleteFsmTransition: { command: 'delete_fsm_transition', input: body },
    addFsmEvent: { command: 'create_fsm_event', input: body },
    updateFsmEvent: { command: 'update_fsm_event', input: body },
    deleteFsmEvent: { command: 'delete_fsm_event', input: body },
    updateControlElement: { command: 'update_control_panel_element', input: body },
    autoLayoutFsm: { command: 'auto_layout_fsm', input: {} },
    upsertHmiTag: { command: 'upsert_tag', input: { tag: body } },
    deleteHmiTag: { command: 'delete_tag', input: body },
    upsertHmiProcedure: { command: 'upsert_procedure', input: { procedure: body } },
    deleteHmiProcedure: { command: 'delete_procedure', input: body },
    upsertAlarm: { command: 'upsert_alarm', input: { alarm: body } },
    deleteAlarm: { command: 'delete_alarm', input: body },
    setAuthoringLanguage: { command: 'set_authoring_language', input: body },
    compileProject: { command: 'compile_assets', input: body }
  };
  const target = mapping[action];
  if (!target) return null;
  return {
    command: target.command,
    input: target.input,
    expectedRevision: useProjectStore.getState().revision,
    correlationId: crypto.randomUUID(),
    source: 'electron-rest',
    permissions: ['project:read', 'project:write', 'project:destructive', 'runtime:write'],
    actor: { id: 'automation:legacy-electron', type: 'adapter', displayName: 'Legacy Electron API' }
  };
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

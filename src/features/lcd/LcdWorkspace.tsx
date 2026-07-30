import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Workflow
} from 'lucide-react';
import { useWorkspaceRouter } from '../../app/WorkspaceRouter';
import { PixelImporter } from '../pixel-importer/PixelImporter';
import { LCDCanvasEditor } from '../../renderer/components/LCDCanvasEditor';
import { UI_TEXT } from '../../renderer/config/i18n';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { LcdScreen } from '../../domain/project';
import { ValidationPanel } from '../validation/ValidationPanel';
import { GlyphCGenerator } from './GlyphCGenerator';
import { ScreenDslStudio } from '../screen-dsl-studio';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

type LcdToolPanel = 'editor' | 'pixel-import' | 'glyph-c' | 'templates' | 'screen-dsl';
const SCREEN_TEMPLATES_KEY = 'lcd-bitmap-ide.screen-templates.v1';
const LCD_LAYOUT_KEY = 'lcd-bitmap-ide.workspace.lcd-layout.v1';

interface LcdWorkspaceLayout {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

interface SidebarResize {
  side: 'left' | 'right';
  startX: number;
  startWidth: number;
}

export function LcdWorkspace({ requestedScreenId }: { requestedScreenId?: string }): React.ReactElement {
  const {
    project,
    session,
    language,
    fontGlyphs,
    selectedScreenId,
    selectScreen,
    createScreen,
    duplicateScreen,
    renameScreen,
    resizeScreen,
    deleteScreen,
    saveScreenTemplate,
    createScreenFromTemplate,
    applyScreenDslPreview
  } = useProjectStore();
  const { navigate } = useWorkspaceRouter();
  const [toolPanel, setToolPanel] = useState<LcdToolPanel>('editor');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPixelGrid, setShowPixelGrid] = useState(true);
  const [templatesVersion, setTemplatesVersion] = useState(0);
  const [screenSearch, setScreenSearch] = useState('');
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<LcdWorkspaceLayout>(readWorkspaceLayout);
  const [sidebarResize, setSidebarResize] = useState<SidebarResize | null>(null);

  useEffect(() => {
    if (requestedScreenId && project?.screens[requestedScreenId]) {
      selectScreen(requestedScreenId);
    }
  }, [project, requestedScreenId, selectScreen]);

  useEffect(() => {
    localStorage.setItem(LCD_LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  const updateSidebarResize = (event: React.PointerEvent<HTMLElement>): void => {
    if (!sidebarResize) {
      return;
    }
    const delta = event.clientX - sidebarResize.startX;
    setLayout((current) => sidebarResize.side === 'left'
      ? { ...current, leftWidth: clampSidebarWidth(sidebarResize.startWidth + delta, 180, 520) }
      : { ...current, rightWidth: clampSidebarWidth(sidebarResize.startWidth - delta, 240, 560) });
  };

  const templates = useMemo(() => readTemplates(), [templatesVersion]);
  const labels = UI_TEXT[language];
  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }
  const visibleScreenIds = project.screenOrder.filter((screenId) => {
    const item = project.screens[screenId];
    const query = screenSearch.trim().toLowerCase();
    return !query || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });
  const screen = selectedScreenId ? project.screens[selectedScreenId] : null;
  const linkedStates = screen
    ? project.fsm.stateOrder.map((id) => project.fsm.states[id]).filter((state) => state.screenId === screen.id)
    : [];
  return (
    <section
      className="workspace-root lcd-workspace lcd-workspace-resizable"
      aria-label={labels.lcdEditor}
      style={{
        gridTemplateColumns: `${layout.leftCollapsed ? 46 : layout.leftWidth}px 6px minmax(420px, 1fr) 6px ${layout.rightCollapsed ? 46 : layout.rightWidth}px`
      }}
      onPointerMove={updateSidebarResize}
      onPointerUp={() => setSidebarResize(null)}
      onPointerCancel={() => setSidebarResize(null)}
    >
      <aside className={layout.leftCollapsed ? 'workspace-sidebar collapsible-sidebar collapsed' : 'workspace-sidebar collapsible-sidebar'}>
        <header className="workspace-section-header">
          <h2>{labels.screens}</h2>
          <div className="sidebar-header-actions">
            {!layout.leftCollapsed ? <button type="button" onClick={() => createScreen()} title={labels.addScreen}><Plus size={16} /></button> : null}
            <button
              type="button"
              className="sidebar-collapse-button"
              onClick={() => setLayout((current) => ({ ...current, leftCollapsed: !current.leftCollapsed }))}
              title={layout.leftCollapsed ? labels.openLeftSidebar : labels.collapseLeftSidebar}
              aria-label={layout.leftCollapsed ? labels.openLeftSidebar : labels.collapseLeftSidebar}
            >
              {layout.leftCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
        </header>
        <div className="sidebar-search sidebar-content">
          <Search size={14} />
          <input
            value={screenSearch}
            onChange={(event) => setScreenSearch(event.target.value)}
            placeholder={labels.searchScreens}
            aria-label={labels.searchScreens}
          />
        </div>
        <div className="sidebar-content entity-list">
          {visibleScreenIds.map((screenId) => {
            const item = project.screens[screenId];
            return (
              <article key={screenId} className={screenId === selectedScreenId ? 'entity-card active' : 'entity-card'}>
                <button type="button" className="entity-row" onClick={() => selectScreen(screenId)}>
                  <strong>{item.name}</strong>
                  <small>{item.id}</small>
                </button>
                <div>
                  <button type="button" onClick={() => duplicateScreen(screenId)} title={labels.duplicate}><Copy size={14} /></button>
                  <button type="button" onClick={() => deleteScreen(screenId)} title={labels.delete}><Trash2 size={14} /></button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="sidebar-content">
          <ValidationPanel issues={project.validation.issues} domain="lcd" title={labels.lcdValidation} labels={labels} />
        </div>
      </aside>

      <div
        className={layout.leftCollapsed ? 'workspace-splitter disabled' : 'workspace-splitter'}
        role="separator"
        aria-label={labels.resizeLeftSidebar}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          if (layout.leftCollapsed) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'left', startX: event.clientX, startWidth: layout.leftWidth });
        }}
      />

      <main className="workspace-canvas-column">
        <header className="workspace-toolbar">
          <button type="button" className={toolPanel === 'editor' ? 'active' : ''} onClick={() => setToolPanel('editor')}>{labels.canvas}</button>
          <button type="button" className={toolPanel === 'pixel-import' ? 'active' : ''} onClick={() => setToolPanel('pixel-import')}>
            <Upload size={15} /> {labels.importImage}
          </button>
          <button type="button" className={toolPanel === 'glyph-c' ? 'active' : ''} onClick={() => setToolPanel('glyph-c')}>{labels.cGlyphTab}</button>
          <button type="button" className={toolPanel === 'templates' ? 'active' : ''} onClick={() => setToolPanel('templates')}>{labels.templates}</button>
          <button
            type="button"
            className={toolPanel === 'screen-dsl' ? 'active' : ''}
            onClick={() => setToolPanel('screen-dsl')}
            aria-label={labels.dslTitle}
            data-testid="lcd-open-screen-dsl-studio"
          >
            <Workflow size={15} /> {labels.schemaShort}
          </button>
          {screen ? (
            <button
              type="button"
              onClick={() => {
                saveScreenTemplate(screen.id);
                setTemplatesVersion((value) => value + 1);
              }}
            >
              <Save size={15} /> {labels.saveAsTemplate}
            </button>
          ) : null}
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </header>

        {toolPanel === 'pixel-import' ? (
          <PixelImporter
            language={language}
            onOpenEditor={() => setToolPanel('editor')}
            labels={{
              pixelImporter: language === 'ru' ? 'Импорт пикселей' : language === 'zh' ? '像素导入' : 'Pixel importer',
              chooseImage: language === 'ru' ? 'Выбрать изображение' : language === 'zh' ? '选择图像' : 'Choose image',
              threshold: language === 'ru' ? 'Порог' : language === 'zh' ? '阈值' : 'Threshold',
              dithering: language === 'ru' ? 'Дизеринг' : language === 'zh' ? '抖动' : 'Dithering',
              applyNewScreen: language === 'ru' ? 'Создать экран' : language === 'zh' ? '作为新屏幕应用' : 'Apply as new screen',
              insertCurrentScreen: language === 'ru' ? 'Вставить в экран' : language === 'zh' ? '插入当前屏幕' : 'Insert into current screen',
              applyAndEditBitmap: labels.applyAndEditBitmap,
              importedOriginal: labels.importedOriginal
            }}
          />
        ) : toolPanel === 'glyph-c' ? (
          <GlyphCGenerator fontGlyphs={fontGlyphs} labels={labels} />
        ) : toolPanel === 'templates' ? (
          <section className="template-gallery">
            <header className="template-gallery-header">
              <h2>{labels.screenTemplates}</h2>
              <div>
                <button type="button" onClick={() => exportTemplates(templates)}>
                  <Download size={15} /> {labels.exportLabel}
                </button>
                <button type="button" onClick={() => templateInputRef.current?.click()}>
                  <Upload size={15} /> {labels.importTemplate}
                </button>
              </div>
            </header>
            {templates.length === 0 ? <p>{labels.noSavedTemplates}</p> : templates.map((template) => (
              <button key={template.id} type="button" onClick={() => createScreenFromTemplate(template.id)}>
                <strong>{template.name}</strong>
                <span>{template.width}x{template.height}, {template.objects.length} {labels.canvasObjects.toLowerCase()}</span>
              </button>
            ))}
            <input
              ref={templateInputRef}
              type="file"
              accept=".json,.lcdtemplate,application/json"
              hidden
              onChange={(event) => {
                void importTemplates(event, () => setTemplatesVersion((value) => value + 1));
              }}
            />
          </section>
        ) : toolPanel === 'screen-dsl' && session ? (
          <ScreenDslStudio
            session={session}
            selectedScreenId={selectedScreenId}
            language={language}
            onApplyPreview={(preview, sourceText) => applyScreenDslPreview(preview, sourceText)}
          />
        ) : screen ? (
          <LCDCanvasEditor
            canvasData={{
              stateId: screen.id,
              width: screen.width,
              height: screen.height,
              objects: screen.objects,
              selectedObjectIds: screen.selectedObjectIds,
              updatedAt: screen.updatedAt
            }}
            language={language}
            labels={labels}
            showPixelGrid={showPixelGrid}
            onTogglePixelGrid={() => setShowPixelGrid((value) => !value)}
            onOpenImageGlyphImport={() => setToolPanel('pixel-import')}
          />
        ) : <section className="workspace-empty">{labels.selectOrCreateScreen}</section>}
      </main>

      <div
        className={layout.rightCollapsed ? 'workspace-splitter disabled' : 'workspace-splitter'}
        role="separator"
        aria-label={labels.resizeRightSidebar}
        aria-orientation="vertical"
        onPointerDown={(event) => {
          if (layout.rightCollapsed) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setSidebarResize({ side: 'right', startX: event.clientX, startWidth: layout.rightWidth });
        }}
      />

      <aside className={layout.rightCollapsed ? 'workspace-inspector collapsible-sidebar collapsed' : 'workspace-inspector collapsible-sidebar'}>
        <header className="sidebar-drawer-header">
          <strong>{labels.screenProperties}</strong>
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setLayout((current) => ({ ...current, rightCollapsed: !current.rightCollapsed }))}
            title={layout.rightCollapsed ? labels.openRightSidebar : labels.collapseRightSidebar}
            aria-label={layout.rightCollapsed ? labels.openRightSidebar : labels.collapseRightSidebar}
          >
            {layout.rightCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
          </button>
        </header>
        <section className="inspector-card sidebar-content">
          <h3>{labels.screenLabel}</h3>
          {screen ? (
            <>
              <ScreenNameInput
                key={screen.id}
                label={labels.nameLabel}
                value={screen.name}
                onCommit={(name) => renameScreen(screen.id, name)}
              />
              <div className="screen-property-actions">
                <small>ID: {screen.id}</small>
                <button type="button" onClick={() => duplicateScreen(screen.id)}><Copy size={14} />{labels.copy}</button>
              </div>
              <div className="geometry-grid">
                <label>
                  {labels.width}
                  <input
                    type="number"
                    min={8}
                    max={1024}
                    value={screen.width}
                    onChange={(event) => resizeScreen(screen.id, Number(event.target.value), screen.height)}
                  />
                </label>
                <label>
                  {labels.height}
                  <input
                    type="number"
                    min={8}
                    max={1024}
                    value={screen.height}
                    onChange={(event) => resizeScreen(screen.id, screen.width, Number(event.target.value))}
                  />
                </label>
              </div>
              <small>{screen.width}x{screen.height}</small>
            </>
          ) : <p>{labels.noScreenSelected}</p>}
        </section>
        <section className="inspector-card sidebar-content">
          <h3>{labels.linkedFsmStates}</h3>
          {linkedStates.length === 0 ? <p>{labels.screenNotLinked}</p> : linkedStates.map((state) => (
            <button
              key={state.id}
              type="button"
              onClick={() => navigate({ mode: 'fsm', stateId: state.id })}
            >
              <Workflow size={14} /> {state.title}
            </button>
          ))}
        </section>
      </aside>
      {showTutorial ? (
        <TutorialOverlay workspace="lcd" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}

function ScreenNameInput({
  label,
  value,
  onCommit
}: {
  label: string;
  value: string;
  onCommit: (name: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    const next = draft.trim().slice(0, 160);
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <label>
      {label}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function readTemplates(): LcdScreen[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCREEN_TEMPLATES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function exportTemplates(templates: LcdScreen[]): void {
  const blob = new Blob([JSON.stringify({ kind: 'lcd-screen-templates', templates }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lcd-screen-templates-${Date.now()}.lcdtemplate`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importTemplates(
  event: React.ChangeEvent<HTMLInputElement>,
  onImported: () => void
): Promise<void> {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) {
    return;
  }
  const parsed = JSON.parse(await file.text()) as unknown;
  const incoming = Array.isArray(parsed)
    ? parsed.filter(isLcdScreenTemplate)
    : isTemplateBundle(parsed)
      ? parsed.templates.filter(isLcdScreenTemplate)
      : isLcdScreenTemplate(parsed)
        ? [parsed]
        : [];
  if (incoming.length === 0) {
    return;
  }
  const templates = readTemplates();
  const prepared = incoming.map((template: LcdScreen, index: number) => ({
    ...template,
    id: `template-import-${Date.now()}-${index + 1}`,
    selectedObjectIds: []
  }));
  localStorage.setItem(SCREEN_TEMPLATES_KEY, JSON.stringify([...prepared, ...templates].slice(0, 48)));
  onImported();
}

function isTemplateBundle(value: unknown): value is { templates: unknown[] } {
  return typeof value === 'object'
    && value !== null
    && 'templates' in value
    && Array.isArray((value as { templates?: unknown }).templates);
}

function isLcdScreenTemplate(value: unknown): value is LcdScreen {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { width?: unknown }).width === 'number'
    && typeof (value as { height?: unknown }).height === 'number'
    && Array.isArray((value as { objects?: unknown }).objects);
}

function readWorkspaceLayout(): LcdWorkspaceLayout {
  try {
    const value = JSON.parse(localStorage.getItem(LCD_LAYOUT_KEY) ?? '{}') as Partial<LcdWorkspaceLayout>;
    return {
      leftWidth: clampSidebarWidth(value.leftWidth ?? 270, 180, 520),
      rightWidth: clampSidebarWidth(value.rightWidth ?? 360, 240, 560),
      leftCollapsed: value.leftCollapsed ?? false,
      rightCollapsed: value.rightCollapsed ?? false
    };
  } catch {
    return { leftWidth: 270, rightWidth: 360, leftCollapsed: false, rightCollapsed: false };
  }
}

function clampSidebarWidth(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

import type React from 'react';
import { useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignStartVertical,
  Group,
  HelpCircle,
  Image,
  LayoutGrid,
  Lock,
  Monitor,
  MousePointer2,
  Square,
  Type,
  Ungroup,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type {
  ControlPanelButton,
  ControlPanelElement,
  ControlPanelImage,
  HmiBindings,
  HmiTag
} from '../../domain/project';
import type { ValueExpression } from '../../domain/tag';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { assertImportFileSize } from '../../shared/lib/security';
import { ValidationPanel } from '../validation/ValidationPanel';

function parseValueExpr(raw: string): ValueExpression | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('@')) return { kind: 'tag', tagId: trimmed.slice(1) };
  return { kind: 'literal', value: trimmed };
}

function serializeValueExpr(expr: ValueExpression | undefined): string {
  if (!expr) return '';
  if (expr.kind === 'tag') return `@${expr.tagId}`;
  if (expr.kind === 'literal') return String(expr.value);
  return expr.expression ?? '';
}
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

interface InteractionState {
  mode: 'move' | 'resize';
  elementId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
}

export function ControlPanelWorkspace({ requestedElementId }: { requestedElementId?: string }): React.ReactElement {
  const {
    project,
    language,
    selectedControlElementIds,
    selectControlElements,
    addControlElement,
    updateControlElement,
    deleteControlElements,
    groupControlElements,
    ungroupControlElements,
    alignControlElements,
    updateControlPanelSettings,
    captureHistory
  } = useProjectStore();
  const [zoom, setZoom] = useState(1);
  const [showTutorial, setShowTutorial] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const labels = UI_TEXT[language];

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }
  const panel = project.controlPanel;
  const selected = selectedControlElementIds
    .map((id) => panel.elements[id])
    .filter(Boolean);
  const primary = selected[0] ?? (requestedElementId ? panel.elements[requestedElementId] : null);

  const addImage = async (file?: File): Promise<void> => {
    if (!file) {
      return;
    }
    assertImportFileSize(file);
    const dataUrl = await readDataUrl(file);
    addControlElement('image');
    const state = useProjectStore.getState();
    const elementId = state.selectedControlElementIds[0];
    if (elementId) {
      updateControlElement(elementId, {
        name: file.name,
        dataUrl
      } as Partial<ControlPanelImage>);
    }
  };

  const beginDrag = (event: React.PointerEvent, element: ControlPanelElement): void => {
    if (element.locked) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    captureHistory();
    if (event.shiftKey) {
      selectControlElements(Array.from(new Set([...selectedControlElementIds, element.id])));
    } else if (!selectedControlElementIds.includes(element.id)) {
      selectControlElements([element.id]);
    }
    setInteraction({
      mode: 'move',
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height
    });
  };

  const beginResize = (event: React.PointerEvent, element: ControlPanelElement): void => {
    if (element.locked) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    captureHistory();
    selectControlElements([element.id]);
    setInteraction({
      mode: 'resize',
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height
    });
  };

  const updateInteraction = (event: React.PointerEvent): void => {
    if (!interaction) {
      return;
    }
    const dx = (event.clientX - interaction.startX) / zoom;
    const dy = (event.clientY - interaction.startY) / zoom;
    const grid = panel.snapToGrid ? panel.gridSize : 1;
    if (interaction.mode === 'resize') {
      updateControlElement(interaction.elementId, {
        width: Math.max(8, snap(interaction.originWidth + dx, grid)),
        height: Math.max(8, snap(interaction.originHeight + dy, grid))
      }, { history: false });
      return;
    }
    updateControlElement(interaction.elementId, {
      x: snap(interaction.originX + dx, grid),
      y: snap(interaction.originY + dy, grid)
    }, { history: false });
  };

  return (
    <section className="workspace-root control-panel-workspace" aria-label={labels.controlPanelEditor}>
      <main className="control-panel-main">
        <header className="workspace-toolbar control-panel-toolbar">
          <button type="button" onClick={() => addControlElement('display')}><Monitor size={15} />LCD</button>
          <button type="button" onClick={() => addControlElement('button')}><MousePointer2 size={15} />{labels.button}</button>
          <button type="button" onClick={() => addControlElement('text')}><Type size={15} />{labels.labelText}</button>
          <button type="button" onClick={() => addControlElement('rectangle')}><Square size={15} />{labels.rect}</button>
          <button type="button" onClick={() => imageInputRef.current?.click()}><Image size={15} />{labels.image}</button>
          <input
            ref={imageInputRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => {
              void addImage(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button type="button" onClick={() => groupControlElements(selectedControlElementIds)} disabled={selected.length < 2}><Group size={15} />{labels.group}</button>
          <button type="button" onClick={() => ungroupControlElements(selectedControlElementIds)}><Ungroup size={15} />{labels.ungroup}</button>
          <button type="button" onClick={() => alignControlElements(selectedControlElementIds, 'left')} disabled={selected.length < 2}><AlignLeft size={15} /></button>
          <button type="button" onClick={() => alignControlElements(selectedControlElementIds, 'top')} disabled={selected.length < 2}><AlignStartVertical size={15} /></button>
          <button type="button" onClick={() => alignControlElements(selectedControlElementIds, 'center-x')} disabled={selected.length < 2}><AlignCenterHorizontal size={15} /></button>
          <button type="button" onClick={() => alignControlElements(selectedControlElementIds, 'center-y')} disabled={selected.length < 2}><AlignCenterVertical size={15} /></button>
          <button type="button" className={panel.gridEnabled ? 'active' : ''} onClick={() => updateControlPanelSettings({ gridEnabled: !panel.gridEnabled })}><LayoutGrid size={15} />{labels.grid}</button>
          <button type="button" className={panel.snapToGrid ? 'active' : ''} onClick={() => updateControlPanelSettings({ snapToGrid: !panel.snapToGrid })}>{labels.snap}</button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}><ZoomOut size={15} /></button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.1))}><ZoomIn size={15} /></button>
          <button type="button" className="hmi-help-button" title={labels.showHelp} onClick={() => setShowTutorial(true)}>
            <HelpCircle size={15} />
          </button>
        </header>

        <div className="control-panel-stage" onPointerMove={updateInteraction} onPointerUp={() => setInteraction(null)} onPointerCancel={() => setInteraction(null)}>
          <svg
            className="control-panel-canvas"
            width={panel.width * zoom}
            height={panel.height * zoom}
            viewBox={`0 0 ${panel.width} ${panel.height}`}
            role="img"
            aria-label={labels.controlPanelCanvas}
            style={{ background: panel.backgroundColor }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                selectControlElements([]);
              }
            }}
          >
            {panel.gridEnabled ? <GridPattern width={panel.width} height={panel.height} size={panel.gridSize} /> : null}
            {panel.elementOrder.map((elementId) => {
              const element = panel.elements[elementId];
              if (!element?.visible) {
                return null;
              }
              return (
                <ControlElementView
                  key={element.id}
                  element={element}
                  selected={selectedControlElementIds.includes(element.id)}
                  tokens={panel.tokens}
                  language={language}
                  onPointerDown={(event) => beginDrag(event, element)}
                  onResizePointerDown={(event) => beginResize(event, element)}
                />
              );
            })}
          </svg>
        </div>

        <footer className="control-panel-status">
          <span>{primary ? `x ${Math.round(primary.x)}, y ${Math.round(primary.y)}` : labels.noSelection}</span>
          <span>{labels.zoom} {Math.round(zoom * 100)}%</span>
          <span>{labels.grid} {panel.gridEnabled ? `${panel.gridSize}px` : labels.off}</span>
          <span>{labels.snap} {panel.snapToGrid ? labels.on : labels.off}</span>
        </footer>
      </main>

      <aside className="workspace-inspector">
        <section className="inspector-card">
          <h3>{labels.controlPanelCanvas}</h3>
          <div className="geometry-grid">
            <label>
              {labels.displayWidth}
              <input
                type="number"
                min={160}
                max={4096}
                value={panel.width}
                onChange={(event) => updateControlPanelSettings({ width: clampPanelSize(event.target.value, 160) })}
              />
            </label>
            <label>
              {labels.displayHeight}
              <input
                type="number"
                min={120}
                max={4096}
                value={panel.height}
                onChange={(event) => updateControlPanelSettings({ height: clampPanelSize(event.target.value, 120) })}
              />
            </label>
            <label>
              {labels.gridSize}
              <input
                type="number"
                min={1}
                max={128}
                value={panel.gridSize}
                onChange={(event) => updateControlPanelSettings({ gridSize: Math.min(128, Math.max(1, Number(event.target.value) || 1)) })}
              />
            </label>
            <label>
              {labels.background}
              <input type="color" value={panel.backgroundColor} onChange={(event) => updateControlPanelSettings({ backgroundColor: event.target.value })} />
            </label>
          </div>
        </section>
        <ControlElementInspector
          element={primary}
          events={project.fsm.eventOrder.map((id) => project.fsm.events[id])}
          states={project.fsm.stateOrder.map((id) => project.fsm.states[id])}
          tags={Object.values(project.tags ?? {})}
          labels={labels}
          onUpdate={(updates) => primary && updateControlElement(primary.id, updates)}
          onDelete={() => deleteControlElements(selectedControlElementIds)}
        />
        <ValidationPanel issues={project.validation.issues} domain="control-panel" title={labels.panelValidation} />
      </aside>
      {showTutorial ? (
        <TutorialOverlay workspace="control-panel" language={language} onClose={() => setShowTutorial(false)} />
      ) : null}
    </section>
  );
}

function ControlElementView({
  element,
  selected,
  tokens,
  language,
  onPointerDown,
  onResizePointerDown
}: {
  element: ControlPanelElement;
  selected: boolean;
  tokens: {
    panelStroke: string;
    buttonFill: string;
    buttonStroke: string;
    buttonText: string;
    displayBackground: string;
    labelText: string;
  };
  language: 'en' | 'ru' | 'zh';
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onResizePointerDown: (event: React.PointerEvent<SVGRectElement>) => void;
}): React.ReactElement {
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})`;
  const selection = selected ? <rect x={-4} y={-4} width={element.width + 8} height={element.height + 8} className="control-selection" /> : null;
  return (
    <g transform={transform} onPointerDown={onPointerDown} className={element.locked ? 'control-element locked' : 'control-element'}>
      {selection}
      {element.type === 'button' ? (
        <>
          {element.shape === 'diamond' ? (
            <polygon
              points={`${element.width / 2},0 ${element.width},${element.height / 2} ${element.width / 2},${element.height} 0,${element.height / 2}`}
              fill={element.fillColor ?? tokens.buttonFill}
              stroke={element.strokeColor ?? tokens.buttonStroke}
            />
          ) : (
            <rect
              width={element.width}
              height={element.height}
              rx={element.shape === 'rounded-rect' ? 9 : element.shape === 'circle' || element.shape === 'ellipse' ? element.height / 2 : 1}
              fill={element.fillColor ?? tokens.buttonFill}
              stroke={element.strokeColor ?? tokens.buttonStroke}
            />
          )}
          <text x={element.width / 2} y={element.height / 2} textAnchor="middle" dominantBaseline="middle" fill={element.textColor ?? tokens.buttonText} fontSize={element.fontSize ?? 12}>
            {element.label}
          </text>
        </>
      ) : element.type === 'display' ? (
        <>
          <rect width={element.width} height={element.height} rx={4} fill="#18230b" stroke={tokens.panelStroke} strokeWidth={4} />
          <rect x={8} y={8} width={Math.max(1, element.width - 16)} height={Math.max(1, element.height - 16)} fill={tokens.displayBackground} />
        </>
      ) : element.type === 'text' ? (
        <text x={0} y={element.height / 2} dominantBaseline="middle" fill={element.color ?? tokens.labelText} fontSize={element.fontSize ?? 16}>
          {element.text[language] ?? element.text.en}
        </text>
      ) : element.type === 'rectangle' ? (
        <rect width={element.width} height={element.height} fill={element.fillColor ?? 'transparent'} stroke={element.strokeColor ?? tokens.panelStroke} />
      ) : element.type === 'image' ? (
        element.dataUrl
          ? <image href={element.dataUrl} width={element.width} height={element.height} opacity={element.opacity} preserveAspectRatio="xMidYMid meet" />
          : <rect width={element.width} height={element.height} fill="transparent" stroke={tokens.panelStroke} strokeDasharray="6 4" />
      ) : (
        <rect width={element.width} height={element.height} fill="transparent" stroke={tokens.labelText} strokeDasharray="8 5" />
      )}
      {element.locked ? <Lock x={element.width - 16} y={4} width={12} height={12} /> : null}
      {selected && !element.locked ? (
        <rect
          x={element.width - 5}
          y={element.height - 5}
          width={10}
          height={10}
          rx={2}
          className="control-resize-handle"
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </g>
  );
}

function ControlElementInspector({
  element,
  events,
  states,
  tags,
  labels,
  onUpdate,
  onDelete
}: {
  element: ControlPanelElement | null | undefined;
  events: Array<{ id: string; name: string }>;
  states: Array<{ id: string; title: string }>;
  tags: HmiTag[];
  labels: UiText;
  onUpdate: (updates: Partial<ControlPanelElement>) => void;
  onDelete: () => void;
}): React.ReactElement {
  if (!element) {
    return <section className="inspector-card"><h3>{labels.elementProperties}</h3><p>{labels.selectElement}</p></section>;
  }
  const numberField = (label: string, key: 'x' | 'y' | 'width' | 'height' | 'rotation', minimum?: number): React.ReactElement => (
    <label>{label}<input type="number" min={minimum} value={element[key]} onChange={(event) => onUpdate({ [key]: Math.max(minimum ?? -10000, Number(event.target.value) || 0) })} /></label>
  );
  return (
    <section className="inspector-card">
      <h3>{labels.elementProperties}</h3>
      <small>{element.type} / {element.id}</small>
      <div className="geometry-grid">
        {numberField(labels.xAxis, 'x')}
        {numberField(labels.yAxis, 'y')}
        {numberField(labels.width, 'width', 1)}
        {numberField(labels.height, 'height', 1)}
        {numberField(labels.rotation, 'rotation')}
      </div>
      <label className="checkbox-line"><input type="checkbox" checked={element.locked} onChange={(event) => onUpdate({ locked: event.target.checked })} />{labels.locked}</label>
      <label className="checkbox-line"><input type="checkbox" checked={element.visible} onChange={(event) => onUpdate({ visible: event.target.checked })} />{labels.visible}</label>
      {element.type === 'button' ? (
        <ButtonFields button={element} events={events} states={states} tags={tags} labels={labels} onUpdate={onUpdate} />
      ) : null}
      <button type="button" className="delete-button" onClick={onDelete}>{labels.deleteSelected}</button>
    </section>
  );
}

function ButtonFields({
  button,
  events,
  states,
  tags,
  labels,
  onUpdate
}: {
  button: ControlPanelButton;
  events: Array<{ id: string; name: string }>;
  states: Array<{ id: string; title: string }>;
  tags: HmiTag[];
  labels: UiText;
  onUpdate: (updates: Partial<ControlPanelButton>) => void;
}): React.ReactElement {
  const setBinding = (field: keyof HmiBindings, raw: string): void => {
    const expr = parseValueExpr(raw);
    const next: HmiBindings = { ...button.bindings };
    if (expr) {
      (next as Record<string, unknown>)[field] = expr;
    } else {
      delete (next as Record<string, unknown>)[field];
    }
    onUpdate({ bindings: Object.keys(next).length > 0 ? next : undefined });
  };
  return (
    <>
      <label>{labels.labelText}<input value={button.label} onChange={(event) => onUpdate({ label: event.target.value })} /></label>
      <label>
        {labels.shape}
        <select value={button.shape} onChange={(event) => onUpdate({ shape: event.target.value as ControlPanelButton['shape'] })}>
          {['rect', 'rounded-rect', 'circle', 'ellipse', 'diamond', 'custom'].map((shape) => <option key={shape}>{shape}</option>)}
        </select>
      </label>
      <label>
        {labels.fsmEvent}
        <select value={button.fsmEventId ?? ''} onChange={(event) => onUpdate({ fsmEventId: event.target.value || undefined })}>
          <option value="">{labels.unbound}</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
      </label>
      <label>{labels.keyCode}<input value={button.keyCode ?? ''} onChange={(event) => onUpdate({ keyCode: event.target.value || undefined })} /></label>
      <label>
        {labels.allowedStates}
        <select multiple value={button.allowedStates ?? []} onChange={(event) => onUpdate({ allowedStates: selectedValues(event) })}>
          {states.map((state) => <option key={state.id} value={state.id}>{state.title}</option>)}
        </select>
      </label>
      <label>
        {labels.disabledStates}
        <select multiple value={button.disabledStates ?? []} onChange={(event) => onUpdate({ disabledStates: selectedValues(event) })}>
          {states.map((state) => <option key={state.id} value={state.id}>{state.title}</option>)}
        </select>
      </label>
      <label>
        {labels.pressType}
        <select value={button.pressType ?? 'short'} onChange={(event) => onUpdate({ pressType: event.target.value as ControlPanelButton['pressType'] })}>
          <option value="short">short</option>
          <option value="long">long</option>
          <option value="repeat">repeat</option>
        </select>
      </label>
      <h4>{labels.bindingsSection}</h4>
      {tags.length === 0 ? (
        <small>{labels.noTagsDefined}</small>
      ) : (
        <>
          <small>{labels.bindingHint}</small>
          <label>
            {labels.bindingVisibility}
            <input
              value={serializeValueExpr(button.bindings?.visibility)}
              placeholder="@lamp_fail"
              onChange={(event) => setBinding('visibility', event.target.value)}
            />
          </label>
          <label>
            {labels.bindingText}
            <input
              value={serializeValueExpr(button.bindings?.text)}
              placeholder="@absorbance"
              onChange={(event) => setBinding('text', event.target.value)}
            />
          </label>
        </>
      )}
    </>
  );
}

function GridPattern({ width, height, size }: { width: number; height: number; size: number }): React.ReactElement {
  return (
    <>
      <defs>
        <pattern id="control-grid" width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#control-grid)" pointerEvents="none" />
    </>
  );
}

function selectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function snap(value: number, grid: number): number {
  return Math.max(0, Math.round(value / grid) * grid);
}

function clampPanelSize(value: string, minimum: number): number {
  return Math.min(4096, Math.max(minimum, Number(value) || minimum));
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Image read failed.'));
    reader.readAsDataURL(file);
  });
}

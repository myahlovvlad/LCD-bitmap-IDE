import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  createApplicationWorkspace,
  generateAllScreensBinary,
  generateAllScreensCHeader,
  generateSelectedScreenBinary,
  generateSelectedScreenCHeader
} from '../../application';
import { DOMAIN_GLOSSARY } from '../config/constants';
import { FontRenderer, resolveLocalizedBitmapText, type FontVariantKey, type Glyph } from '../core/fonts';
import {
  getScreenByteLength,
  parseCHeaderScreenArrays,
  exportScreenEmbedded,
  EMBEDDED_FORMAT_EXTENSIONS,
  EMBEDDED_FORMAT_LABELS,
  type EmbeddedExportFormat
} from '../utils/codegen';
import { packFrameBuffer, unpackBytesToFrameBuffer, type FrameBuffer } from '../utils/render';
import { importFont, type FontMergeMode } from '../utils/fontImport';
import { copyToClipboard } from '../utils/clipboard';
import type {
  CanvasData,
  CanvasObject,
  BitmapCanvasObject,
  FontMetadata,
  FontVariant,
  InvertCanvasObject,
  LanguageCode,
  SavedMeasurement,
  SpecialCanvasObject,
  SpecialElementKind,
  TextCanvasObject
} from '../types/domain';
import { getObjectBounds, LCDCanvas, type MarqueeRect } from './LCDCanvas';
import { useProjectStore } from '../store/projectStore';
import type { UiText } from '../config/i18n';
import type { HmiTag, HmiBindings, ValueExpression } from '../../domain/tag';

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

type EditorMode = 'select' | 'text' | 'line' | 'rect' | 'invert' | 'special' | 'glyph';

interface Point {
  x: number;
  y: number;
}

interface DragState {
  start: Point;
  snapshot: CanvasObject[];
  createdObjectId?: string;
}

interface EditingGlyph {
  char: string;
  variant: FontVariantKey;
  glyph: Glyph;
  targetObjectId?: string;
}

interface LCDCanvasEditorProps {
  canvasData: CanvasData;
  language: LanguageCode;
  labels: UiText;
  showPixelGrid: boolean;
  onTogglePixelGrid: () => void;
  onOpenImageGlyphImport?: () => void;
}

const specialChars = ['#', '%', '/', '+', '-', '=', '.', ',', ':'];
const specialGlyphChars = ['#', '%', '/', '+', '-', '=', '.', ',', ':', '☐', '☑', '✓', '×', '№', 'λ'];
const specialElementKinds: SpecialElementKind[] = ['checkbox', 'radio', 'progress', 'battery', 'signal', 'scrollbar'];
type GlyphEditScope = 'global' | 'local';

export function LCDCanvasEditor({
  canvasData,
  language,
  labels,
  showPixelGrid,
  onTogglePixelGrid,
  onOpenImageGlyphImport
}: LCDCanvasEditorProps): React.ReactElement {
  const {
    project,
    fontGlyphs,
    loadedFonts,
    addCanvasObject,
    addBitmapLayer,
    updateCanvasObjects,
    updateCanvasObject,
    setCanvasSelection,
    deleteSelectedCanvasObjects,
    captureHistory,
    updateGlyph,
    savedMeasurements,
    addSavedMeasurement,
    updateSavedMeasurement,
    deleteSavedMeasurement,
    importFontGlyphs
  } = useProjectStore();
  const fontRenderer = useMemo(() => new FontRenderer(fontGlyphs), [fontGlyphs]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [editingGlyph, setEditingGlyph] = useState<EditingGlyph | null>(null);
  const [editingBitmap, setEditingBitmap] = useState<BitmapCanvasObject | null>(null);
  const [specialKind, setSpecialKind] = useState<SpecialElementKind>('checkbox');
  const [fontTargetVariant, setFontTargetVariant] = useState<FontVariantKey>('1');
  const [glyphEditScope, setGlyphEditScope] = useState<GlyphEditScope>('global');
  const [fontMergeMode, setFontMergeMode] = useState<FontMergeMode>('merge');
  const [fontStatus, setFontStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [embeddedFormat, setEmbeddedFormat] = useState<EmbeddedExportFormat>('c-vertical-lsb');

  const selectedObjects = canvasData.objects.filter((object) =>
    canvasData.selectedObjectIds.includes(object.id)
  );
  const codegenWorkspace = useMemo(
    () => project
      ? createApplicationWorkspace({ project, fontGlyphs, loadedFonts, savedMeasurements })
      : null,
    [project, fontGlyphs, loadedFonts, savedMeasurements]
  );
  const firstSelected = selectedObjects[0] ?? null;
  const allCanvases = useMemo(
    () => project
      ? project.screenOrder.map((screenId) => project.screens[screenId]).filter(Boolean).map((screen) => ({
          stateId: screen.id,
          width: screen.width,
          height: screen.height,
          objects: screen.objects,
          selectedObjectIds: screen.selectedObjectIds,
          updatedAt: screen.updatedAt
        }))
      : [],
    [project]
  );

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const point = getCanvasPoint(event, canvasData);
    if (mode === 'select') {
      const hitObject = findObjectAtPoint(canvasData.objects, point, language, fontRenderer);
      if (hitObject && !hitObject.locked) {
        const nextSelection = event.shiftKey
          ? Array.from(new Set([...canvasData.selectedObjectIds, hitObject.id]))
          : canvasData.selectedObjectIds.includes(hitObject.id)
            ? canvasData.selectedObjectIds
            : [hitObject.id];
        captureHistory();
        setCanvasSelection(canvasData.stateId, nextSelection);
        setDragState({
          start: point,
          snapshot: canvasData.objects.filter((object) => nextSelection.includes(object.id))
        });
        return;
      }

      setCanvasSelection(canvasData.stateId, []);
      setMarquee({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
      return;
    }

    if (mode === 'text') {
      const textObject: TextCanvasObject = {
        id: createObjectId(canvasData.stateId, 'text'),
        type: 'text',
        text: {
          en: DOMAIN_GLOSSARY.parameters.preferred,
          ru: DOMAIN_GLOSSARY.parameters.ru,
          zh: labels.defaultText
        },
        x: point.x,
        y: point.y,
        zIndex: canvasData.objects.length,
        visible: true,
        locked: false,
        source: 'user',
        fontVariant: '1',
        pendingTranslation: false
      };
      addCanvasObject(canvasData.stateId, textObject);
      setMode('select');
      return;
    }

    if (mode === 'line') {
      const lineObject: CanvasObject = {
        id: createObjectId(canvasData.stateId, 'line'),
        type: 'line',
        x0: point.x,
        y0: point.y,
        x1: point.x,
        y1: point.y,
        zIndex: canvasData.objects.length,
        visible: true,
        locked: false,
        source: 'user'
      };
      addCanvasObject(canvasData.stateId, lineObject);
      setDragState({ start: point, snapshot: [lineObject], createdObjectId: lineObject.id });
      return;
    }

    if (mode === 'rect') {
      const rectObject: CanvasObject = {
        id: createObjectId(canvasData.stateId, 'rect'),
        type: 'rect',
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        filled: false,
        zIndex: canvasData.objects.length,
        visible: true,
        locked: false,
        source: 'user'
      };
      addCanvasObject(canvasData.stateId, rectObject);
      setDragState({ start: point, snapshot: [rectObject], createdObjectId: rectObject.id });
      return;
    }

    if (mode === 'invert') {
      const rowHeight = Math.min(8, canvasData.height);
      const invertObject: InvertCanvasObject = {
        id: createObjectId(canvasData.stateId, 'invert'),
        type: 'invert',
        x: 0,
        y: Math.min(point.y, canvasData.height - rowHeight),
        width: canvasData.width,
        height: rowHeight,
        zIndex: canvasData.objects.length,
        visible: true,
        locked: false,
        source: 'user'
      };
      addCanvasObject(canvasData.stateId, invertObject);
      setDragState({ start: point, snapshot: [invertObject], createdObjectId: invertObject.id });
      return;
    }

    if (mode === 'special') {
      const size = getDefaultSpecialSize(specialKind);
      const specialObject: SpecialCanvasObject = {
        id: createObjectId(canvasData.stateId, 'special'),
        type: 'special',
        kind: specialKind,
        x: point.x,
        y: point.y,
        width: size.width,
        height: size.height,
        checked: specialKind === 'checkbox' || specialKind === 'radio',
        value: specialKind === 'checkbox' || specialKind === 'radio' ? 100 : 60,
        fontVariant: fontTargetVariant,
        glyphChar: getSpecialGlyphChar(specialKind, true),
        zIndex: canvasData.objects.length,
        visible: true,
        locked: false,
        source: 'user'
      };
      addCanvasObject(canvasData.stateId, specialObject);
      setMode('select');
      return;
    }

    if (mode === 'glyph') {
      const hitObject = findObjectAtPoint(canvasData.objects, point, language, fontRenderer);
      if (!hitObject) {
        return;
      }

      if (hitObject.type === 'text') {
        const char = findCharacterAtPoint(hitObject, point, language, fontRenderer);
        if (!char) {
          return;
        }

        setEditingGlyph({
          char,
          variant: hitObject.fontVariant as FontVariantKey,
          glyph: { ...fontRenderer.getGlyph(char, hitObject.fontVariant as FontVariantKey) }
        });
        return;
      }

      if (hitObject.type === 'special') {
        const char = hitObject.glyphChar || getSpecialGlyphChar(hitObject.kind, hitObject.checked);
        const variant = hitObject.fontVariant ?? fontTargetVariant;
        setEditingGlyph({
          char,
          variant,
          targetObjectId: hitObject.id,
          glyph: { ...(hitObject.glyphOverride ?? fontRenderer.getGlyph(char, variant)) }
        });
      }
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const point = getCanvasPoint(event, canvasData);
    if (marquee) {
      setMarquee({ ...marquee, x1: point.x, y1: point.y });
      return;
    }

    if (!dragState) {
      return;
    }

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;
    const snapshotById = new Map(dragState.snapshot.map((object) => [object.id, object]));

    updateCanvasObjects(
      canvasData.stateId,
      canvasData.objects.map((object) => {
        const snapshot = snapshotById.get(object.id);
        if (!snapshot || object.locked) {
          return object;
        }

        if (dragState.createdObjectId === object.id && object.type === 'line' && snapshot.type === 'line') {
          return { ...object, x1: point.x, y1: point.y };
        }

        if (dragState.createdObjectId === object.id && object.type === 'rect' && snapshot.type === 'rect') {
          const left = Math.min(dragState.start.x, point.x);
          const top = Math.min(dragState.start.y, point.y);
          return {
            ...object,
            x: left,
            y: top,
            width: Math.max(1, Math.abs(point.x - dragState.start.x) + 1),
            height: Math.max(1, Math.abs(point.y - dragState.start.y) + 1)
          };
        }

        if (dragState.createdObjectId === object.id && object.type === 'invert' && snapshot.type === 'invert') {
          const top = Math.min(dragState.start.y, point.y);
          return {
            ...object,
            y: top,
            height: Math.max(1, Math.abs(point.y - dragState.start.y) + 1)
          };
        }

        return moveObject(snapshot, dx, dy, canvasData);
      }),
      { history: false }
    );
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (marquee) {
      const selectionRect = toRect(marquee);
      const nextSelection = canvasData.objects
        .filter((object) => rectsIntersect(selectionRect, getObjectBounds(object, language, fontRenderer)))
        .map((object) => object.id);
      setCanvasSelection(
        canvasData.stateId,
        event.shiftKey
          ? Array.from(new Set([...canvasData.selectedObjectIds, ...nextSelection]))
          : nextSelection
      );
      setMarquee(null);
    }

    setDragState(null);
    if (mode === 'line' || mode === 'rect' || mode === 'invert') {
      setMode('select');
    }
  };

  const updateSelected = (updates: Partial<CanvasObject>): void => {
    for (const object of selectedObjects) {
      updateCanvasObject(canvasData.stateId, { ...object, ...updates } as CanvasObject);
    }
  };

  const updateSelectedText = (updates: Partial<TextCanvasObject>): void => {
    if (!firstSelected || firstSelected.type !== 'text') {
      return;
    }
    updateCanvasObject(canvasData.stateId, { ...firstSelected, ...updates });
  };

  const updateSelectedGeometry = (object: CanvasObject): void => {
    updateCanvasObject(canvasData.stateId, object);
  };

  const downloadScreenshot = (): void => {
    const canvas = wrapperRef.current?.querySelector('canvas');
    if (!canvas) {
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `lcd_${canvasData.stateId}_${Date.now()}.png`;
    link.click();
  };

  const copyCCode = async (): Promise<void> => {
    if (!codegenWorkspace) {
      return;
    }
    const cCode = generateSelectedScreenCHeader(codegenWorkspace, canvasData.stateId, { language });
    await copyToClipboard(cCode);
  };

  const downloadSelectedHeader = (): void => {
    if (!codegenWorkspace) {
      return;
    }
    downloadBlob(
      `${sanitizeFilename(canvasData.stateId)}_screen.h`,
      generateSelectedScreenCHeader(codegenWorkspace, canvasData.stateId, { language }),
      'text/x-c'
    );
  };

  const downloadSelectedBinary = (): void => {
    if (!codegenWorkspace) {
      return;
    }
    downloadBlob(
      `${sanitizeFilename(canvasData.stateId)}_screen.bin`,
      generateSelectedScreenBinary(codegenWorkspace, canvasData.stateId, { language }),
      'application/octet-stream'
    );
  };

  const downloadAllHeaders = (): void => {
    if (!project || !codegenWorkspace) {
      return;
    }
    downloadBlob(
      `${sanitizeFilename(project.meta.id)}_lcd_screens.h`,
      generateAllScreensCHeader(codegenWorkspace, { language }),
      'text/x-c'
    );
  };

  const downloadAllBinary = (): void => {
    if (!project || !codegenWorkspace) {
      return;
    }
    downloadBlob(
      `${sanitizeFilename(project.meta.id)}_lcd_screens.bin`,
      generateAllScreensBinary(codegenWorkspace, { language }),
      'application/octet-stream'
    );
  };

  const downloadSelectedEmbedded = (): void => {
    const ext = EMBEDDED_FORMAT_EXTENSIONS[embeddedFormat];
    const content = exportScreenEmbedded(canvasData.objects, embeddedFormat, {
      symbolName: `${canvasData.stateId}_screen`,
      language,
      fontRenderer,
      width: canvasData.width,
      height: canvasData.height
    });
    downloadBlob(
      `${sanitizeFilename(canvasData.stateId)}_screen.${ext}`,
      content,
      ext === 'bin' ? 'application/octet-stream' : 'text/plain'
    );
  };

  const downloadAllEmbedded = (): void => {
    if (!project) {
      return;
    }
    const ext = EMBEDDED_FORMAT_EXTENSIONS[embeddedFormat];
    if (embeddedFormat === 'binary') {
      const chunks = allCanvases.map((screen) =>
        exportScreenEmbedded(screen.objects, embeddedFormat, {
          symbolName: `${screen.stateId}_screen`,
          language,
          fontRenderer,
          width: screen.width,
          height: screen.height
        }) as Uint8Array
      );
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      downloadBlob(`${sanitizeFilename(project.meta.id)}_lcd_screens.${ext}`, combined, 'application/octet-stream');
      return;
    }
    const sections = allCanvases.map((screen) =>
      exportScreenEmbedded(screen.objects, embeddedFormat, {
        symbolName: `${screen.stateId}_screen`,
        language,
        fontRenderer,
        width: screen.width,
        height: screen.height
      }) as string
    );
    downloadBlob(`${sanitizeFilename(project.meta.id)}_lcd_screens.${ext}`, sections.join('\n\n'), 'text/plain');
  };

  const importCHeader = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const arrays = parseCHeaderScreenArrays(await file.text(), getScreenByteLength(canvasData.width, canvasData.height));
      addBitmapLayer(canvasData.stateId, arrays[0].symbolName, arrays[0].bytes);
      setImportStatus(`${arrays[0].symbolName}: ${arrays[0].bytes.length} bytes`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const loadFontFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (fontMergeMode === 'replace' && !window.confirm(labels.replaceFont)) {
      return;
    }

    try {
      const imported = importFont({
        filename: file.name,
        text: await file.text(),
        variant: fontTargetVariant
      });
      importFontGlyphs(fontTargetVariant, imported.glyphs, imported.metadata, fontMergeMode);
      setFontStatus(`${imported.metadata.name}: ${imported.metadata.glyphCount} glyphs`);
    } catch (error) {
      setFontStatus(error instanceof Error ? error.message : 'Font import failed');
    }
  };

  return (
    <section className="lcd-editor bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col xl:flex-row gap-8">
      <div className="flex-1 flex flex-col gap-5 min-w-[320px]">
        <div className="editor-tools-card bg-gray-700/50 p-4 rounded-xl border border-gray-600">
          <div className="block text-sm text-gray-400 mb-3 font-bold uppercase tracking-wider">
            {labels.canvasTools}
          </div>
          <div className="editor-toolbar grid grid-cols-2 gap-2" aria-label={labels.canvasTools}>
            <ToolButton mode="select" activeMode={mode} onSelect={setMode} label={labels.select} />
            <ToolButton mode="text" activeMode={mode} onSelect={setMode} label={labels.addText} />
            <ToolButton mode="line" activeMode={mode} onSelect={setMode} label={labels.line} />
            <ToolButton mode="rect" activeMode={mode} onSelect={setMode} label={labels.rect} />
            <ToolButton mode="invert" activeMode={mode} onSelect={setMode} label={labels.invertRow} />
            <ToolButton mode="special" activeMode={mode} onSelect={setMode} label={labels.specialElement} />
            <ToolButton
              mode="glyph"
              activeMode={mode}
              onSelect={setMode}
              label={labels.glyphEditor}
            />
            <button
              type="button"
              className="tool-action-button"
              disabled={firstSelected?.type !== 'bitmap'}
              onClick={() => {
                if (firstSelected?.type === 'bitmap') {
                  setEditingBitmap(firstSelected);
                }
              }}
            >
              {labels.userPixelEditor}
            </button>
            {onOpenImageGlyphImport ? (
              <button type="button" className="tool-action-button" onClick={onOpenImageGlyphImport}>
                {labels.importImageGlyphEditor}
              </button>
            ) : null}
          </div>
          <label className="special-kind-select">
            {labels.specialType}
            <select value={specialKind} onChange={(event) => setSpecialKind(event.target.value as SpecialElementKind)}>
              {specialElementKinds.map((kind) => (
                <option key={kind} value={kind}>{getSpecialKindLabel(labels, kind)}</option>
              ))}
            </select>
          </label>
          <div className="editor-tip text-xs text-gray-400 mt-3 text-center">
            {mode === 'text' ? labels.textTip : mode === 'special' ? labels.specialTip : mode === 'invert' ? labels.invertRowTip : labels.selectTip}
          </div>
        </div>

        {mode === 'special' || mode === 'glyph' ? (
          <SpecialGlyphPanel
            labels={labels}
            language={language}
            variant={fontTargetVariant}
            scope={glyphEditScope}
            onVariantChange={setFontTargetVariant}
            onScopeChange={setGlyphEditScope}
            onEdit={(char) =>
              setEditingGlyph({
                char,
                variant: fontTargetVariant,
                glyph: { ...fontRenderer.getGlyph(char, fontTargetVariant) }
              })
            }
          />
        ) : null}

        <ExportImportPanel
          labels={labels}
          importStatus={importStatus}
          screenCount={allCanvases.length}
          onCopyC={() => void copyCCode()}
          onDownloadHeader={downloadSelectedHeader}
          onDownloadBinary={downloadSelectedBinary}
          onDownloadAllHeaders={downloadAllHeaders}
          onDownloadAllBinary={downloadAllBinary}
          onImportHeader={() => cHeaderInputRef.current?.click()}
          embeddedFormat={embeddedFormat}
          onEmbeddedFormatChange={setEmbeddedFormat}
          onDownloadEmbedded={downloadSelectedEmbedded}
          onDownloadAllEmbedded={downloadAllEmbedded}
        />

        <FontLoaderPanel
          labels={labels}
          loadedFonts={loadedFonts}
          targetVariant={fontTargetVariant}
          mergeMode={fontMergeMode}
          status={fontStatus}
          onTargetVariantChange={setFontTargetVariant}
          onMergeModeChange={setFontMergeMode}
          onChooseFile={() => fontInputRef.current?.click()}
        />

        <ObjectProperties
          selectedObjects={selectedObjects}
          language={language}
          labels={labels}
          tags={Object.values(project?.tags ?? {})}
          onUpdateSelected={updateSelected}
          onUpdateText={updateSelectedText}
          onUpdateGeometry={updateSelectedGeometry}
          canvasData={canvasData}
          onEditBitmap={setEditingBitmap}
          onDelete={() => deleteSelectedCanvasObjects(canvasData.stateId)}
        />
        <input
          ref={cHeaderInputRef}
          type="file"
          accept=".h,.hpp,.c,.txt,text/x-c,text/plain"
          hidden
          onChange={(event) => void importCHeader(event)}
        />
        <input
          ref={fontInputRef}
          type="file"
          accept=".bdf,.fnt,text/plain"
          hidden
          onChange={(event) => void loadFontFile(event)}
        />
        <SavedMeasurementsPanel
          measurements={savedMeasurements}
          stateId={canvasData.stateId}
          labels={labels}
          onAdd={() => addSavedMeasurement(canvasData.stateId, canvasData.stateId, getMeasurementValue(canvasData, language, fontRenderer))}
          onUpdate={updateSavedMeasurement}
          onDelete={deleteSavedMeasurement}
        />
      </div>

      <div className="lcd-display-column flex-[2] flex flex-col justify-start items-center gap-4">
        <div
          ref={wrapperRef}
          className="lcd-editor-frame p-4 bg-[#18230b] rounded-xl shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] border-[6px] border-gray-900 relative w-full overflow-x-auto select-none"
        >
          <LCDCanvas
            canvasData={canvasData}
            language={language}
            scale={5}
            showPixelGrid={showPixelGrid}
            className={`lcd-canvas block rounded-sm shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] mx-auto editor-mode-${mode}`}
            fontRenderer={fontRenderer}
            marquee={marquee}
            onCanvasMouseDown={handleMouseDown}
            onCanvasMouseMove={handleMouseMove}
            onCanvasMouseUp={handleMouseUp}
          />
          <div className="lcd-glass absolute inset-0 pointer-events-none rounded-xl border border-white/5" />
        </div>

        <div className="lcd-action-row">
          <button
            type="button"
            onClick={downloadScreenshot}
            className="screenshot-button px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-colors flex items-center gap-2"
          >
            📸 {labels.screenshotPng}
          </button>
          <button type="button" className="utility-button" onClick={onTogglePixelGrid}>
            {labels.pixelGrid}
          </button>
          <button type="button" className="utility-button" onClick={() => void copyCCode()}>
            {labels.copyC}
          </button>
        </div>
      </div>

      {editingGlyph ? (
        <GlyphEditorModal
          editingGlyph={editingGlyph}
          labels={labels}
          onChange={setEditingGlyph}
          onCancel={() => setEditingGlyph(null)}
          onSave={() => {
            if (glyphEditScope === 'local' && editingGlyph.targetObjectId) {
              const target = canvasData.objects.find((object) => object.id === editingGlyph.targetObjectId);
              if (target?.type === 'special') {
                updateCanvasObject(canvasData.stateId, {
                  ...target,
                  fontVariant: editingGlyph.variant,
                  glyphChar: editingGlyph.char,
                  glyphOverride: editingGlyph.glyph
                });
              }
            } else {
              updateGlyph(editingGlyph.variant, editingGlyph.char, editingGlyph.glyph);
            }
            setEditingGlyph(null);
          }}
        />
      ) : null}
      {editingBitmap ? (
        <BitmapEditorModal
          bitmap={editingBitmap}
          labels={labels}
          onCancel={() => setEditingBitmap(null)}
          onSave={(bitmap) => {
            updateCanvasObject(canvasData.stateId, bitmap);
            setEditingBitmap(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ExportImportPanel({
  labels,
  importStatus,
  screenCount,
  onCopyC,
  onDownloadHeader,
  onDownloadBinary,
  onDownloadAllHeaders,
  onDownloadAllBinary,
  onImportHeader,
  embeddedFormat,
  onEmbeddedFormatChange,
  onDownloadEmbedded,
  onDownloadAllEmbedded
}: {
  labels: UiText;
  importStatus: string;
  screenCount: number;
  onCopyC: () => void;
  onDownloadHeader: () => void;
  onDownloadBinary: () => void;
  onDownloadAllHeaders: () => void;
  onDownloadAllBinary: () => void;
  onImportHeader: () => void;
  embeddedFormat: EmbeddedExportFormat;
  onEmbeddedFormatChange: (format: EmbeddedExportFormat) => void;
  onDownloadEmbedded: () => void;
  onDownloadAllEmbedded: () => void;
}): React.ReactElement {
  return (
    <section className="editor-tools-card export-import-panel">
      <h3>{labels.screenExport}</h3>
      <div className="compact-action-grid">
        <button type="button" onClick={onCopyC}>{labels.copyC}</button>
        <button type="button" onClick={onDownloadHeader}>{labels.downloadHeader}</button>
        <button type="button" onClick={onDownloadBinary}>{labels.downloadBin}</button>
        <button type="button" onClick={onImportHeader}>{labels.importHeader}</button>
        <button type="button" onClick={onDownloadAllHeaders}>{labels.downloadAllHeaders}</button>
        <button type="button" onClick={onDownloadAllBinary}>{labels.downloadAllBin}</button>
      </div>
      <h3>{labels.embeddedExportFormat}</h3>
      <select
        value={embeddedFormat}
        onChange={(event) => onEmbeddedFormatChange(event.target.value as EmbeddedExportFormat)}
      >
        {Object.entries(EMBEDDED_FORMAT_LABELS).map(([id, label]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
      <div className="compact-action-grid">
        <button type="button" onClick={onDownloadEmbedded}>{labels.downloadEmbeddedSelected}</button>
        <button type="button" onClick={onDownloadAllEmbedded}>{labels.downloadEmbeddedAll}</button>
      </div>
      <small>{labels.screenCount}: {screenCount}</small>
      {importStatus ? <small>{importStatus}</small> : null}
    </section>
  );
}

function FontLoaderPanel({
  labels,
  loadedFonts,
  targetVariant,
  mergeMode,
  status,
  onTargetVariantChange,
  onMergeModeChange,
  onChooseFile
}: {
  labels: UiText;
  loadedFonts: FontMetadata[];
  targetVariant: FontVariantKey;
  mergeMode: FontMergeMode;
  status: string;
  onTargetVariantChange: (variant: FontVariantKey) => void;
  onMergeModeChange: (mode: FontMergeMode) => void;
  onChooseFile: () => void;
}): React.ReactElement {
  return (
    <section className="editor-tools-card font-loader-panel">
      <h3>{labels.fontLoader}</h3>
      <div className="font-loader-controls">
        <select value={targetVariant} onChange={(event) => onTargetVariantChange(event.target.value as FontVariantKey)}>
          <option value="1">{labels.fontOne}</option>
          <option value="2">{labels.fontTwo}</option>
        </select>
        <select value={mergeMode} onChange={(event) => onMergeModeChange(event.target.value as FontMergeMode)}>
          <option value="merge">{labels.mergeFont}</option>
          <option value="replace">{labels.replaceFont}</option>
        </select>
        <button type="button" onClick={onChooseFile}>{labels.loadFont}</button>
      </div>
      {status ? <small>{status}</small> : null}
      <div className="loaded-font-list">
        {loadedFonts.slice(0, 6).map((font) => (
          <div key={font.id} className="loaded-font-row">
            <strong>{font.name}</strong>
            <span>{font.sourceFormat} / {labels.font} {font.variant} / {font.glyphCount}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecialGlyphPanel({
  labels,
  language,
  variant,
  scope,
  onVariantChange,
  onScopeChange,
  onEdit
}: {
  labels: UiText;
  language: LanguageCode;
  variant: FontVariantKey;
  scope: GlyphEditScope;
  onVariantChange: (variant: FontVariantKey) => void;
  onScopeChange: (scope: GlyphEditScope) => void;
  onEdit: (char: string) => void;
}): React.ReactElement {
  return (
    <section className="editor-tools-card special-glyph-panel">
      <h3>{labels.specialGlyphs}</h3>
      <div className="font-loader-controls">
        <select value={variant} onChange={(event) => onVariantChange(event.target.value as FontVariantKey)}>
          <option value="1">{labels.fontOne}</option>
          <option value="2">{labels.fontTwo}</option>
        </select>
        <div className="segmented-control" role="group" aria-label="Glyph edit scope">
          <button
            type="button"
            className={scope === 'global' ? 'active' : ''}
            onClick={() => onScopeChange('global')}
          >
            {language === 'ru' ? 'Глобально' : 'Global'}
          </button>
          <button
            type="button"
            className={scope === 'local' ? 'active' : ''}
            onClick={() => onScopeChange('local')}
          >
            {language === 'ru' ? 'Локально' : 'Local'}
          </button>
        </div>
      </div>
      <div className="special-glyph-grid">
        {specialGlyphChars.map((char) => (
          <button key={char} type="button" onClick={() => onEdit(char)} title={`${labels.editGlyph}: ${char}`}>
            {char}
          </button>
        ))}
      </div>
    </section>
  );
}

function SavedMeasurementsPanel({
  measurements,
  stateId,
  labels,
  onAdd,
  onUpdate,
  onDelete
}: {
  measurements: SavedMeasurement[];
  stateId: string;
  labels: UiText;
  onAdd: () => void;
  onUpdate: (measurement: SavedMeasurement) => void;
  onDelete: (measurementId: string) => void;
}): React.ReactElement {
  const currentMeasurements = measurements.filter((measurement) => measurement.stateId === stateId);

  return (
    <section className="saved-measurements-panel">
      <div className="properties-title">
        <h3>{labels.savedMeasurements}</h3>
        <button type="button" className="measurement-save-button" onClick={onAdd}>
          {labels.saveMeasurement}
        </button>
      </div>
      {currentMeasurements.length === 0 ? (
        <div className="empty-selection">{labels.noSavedMeasurements}</div>
      ) : (
        <div className="measurement-list">
          {currentMeasurements.map((measurement) => (
            <div key={measurement.id} className="measurement-row">
              <label>
                {labels.measurementName}
                <input
                  value={measurement.label}
                  onChange={(event) => onUpdate({ ...measurement, label: event.target.value })}
                />
              </label>
              <label>
                {labels.measurementValue}
                <input
                  value={measurement.value}
                  onChange={(event) => onUpdate({ ...measurement, value: event.target.value })}
                />
              </label>
              <label className="measurement-note">
                {labels.measurementNote}
                <input
                  value={measurement.note}
                  onChange={(event) => onUpdate({ ...measurement, note: event.target.value })}
                />
              </label>
              <button type="button" className="delete-button" onClick={() => onDelete(measurement.id)}>
                <Trash2 size={14} />
                {labels.deleteMeasurement}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ToolButton({
  mode,
  activeMode,
  onSelect,
  label,
  className = ''
}: {
  mode: EditorMode;
  activeMode: EditorMode;
  onSelect: (mode: EditorMode) => void;
  label: string;
  className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={`${className} px-4 py-2 rounded-lg font-semibold transition-colors ${
        activeMode === mode
          ? 'active bg-green-600 text-white shadow-[0_0_10px_#16a34a]'
          : 'bg-gray-700 hover:bg-gray-600'
      }`}
      onClick={() => onSelect(mode)}
    >
      {label}
    </button>
  );
}

function ObjectProperties({
  selectedObjects,
  language,
  labels,
  tags,
  onUpdateSelected,
  onUpdateText,
  onUpdateGeometry,
  canvasData,
  onEditBitmap,
  onDelete
}: {
  selectedObjects: CanvasObject[];
  language: LanguageCode;
  labels: UiText;
  tags: HmiTag[];
  onUpdateSelected: (updates: Partial<CanvasObject>) => void;
  onUpdateText: (updates: Partial<TextCanvasObject>) => void;
  onUpdateGeometry: (object: CanvasObject) => void;
  canvasData: CanvasData;
  onEditBitmap: (object: BitmapCanvasObject) => void;
  onDelete: () => void;
}): React.ReactElement {
  const firstSelected = selectedObjects[0] ?? null;

  if (!firstSelected) {
    return (
      <div className="object-properties empty bg-gray-700/30 p-4 rounded-xl border border-gray-600 flex-1">
        <div className="properties-title flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
          <div className="block text-sm text-gray-400 font-bold uppercase tracking-wider">
            {labels.elementProperties}
          </div>
          <span className="text-xs text-gray-500">{labels.selectedCount}: 0</span>
        </div>
        <div className="empty-selection text-center text-gray-500 text-sm mt-8">{labels.selectObject}</div>
      </div>
    );
  }

  return (
    <section className="object-properties bg-gray-700/30 p-4 rounded-xl border border-gray-600 flex-1">
      <div className="properties-title flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
        <div className="block text-sm text-gray-400 font-bold uppercase tracking-wider">
          {labels.elementProperties}
        </div>
        <span className="text-xs text-gray-500">{labels.selectedCount}: {selectedObjects.length}</span>
      </div>

      {firstSelected.type === 'text' && selectedObjects.length === 1 ? (
        <>
          <label>
            {labels.textEn}
            <input
              value={firstSelected.text.en}
              onChange={(event) =>
                onUpdateText({ text: { ...firstSelected.text, en: event.target.value } })
              }
            />
          </label>
          <label>
            {labels.textRu}
            <input
              value={firstSelected.text.ru}
              onChange={(event) =>
                onUpdateText({ text: { ...firstSelected.text, ru: event.target.value } })
              }
            />
          </label>
          <label>
            {labels.textZh}
            <input
              value={firstSelected.text.zh ?? ''}
              onChange={(event) =>
                onUpdateText({ text: { ...firstSelected.text, zh: event.target.value } })
              }
            />
          </label>
          <div className="special-char-row">
            {specialChars.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() =>
                  onUpdateText({
                    text: {
                      ...firstSelected.text,
                      [language]: `${firstSelected.text[language] ?? firstSelected.text.ru ?? firstSelected.text.en}${char}`
                    }
                  })
                }
              >
                {char}
              </button>
            ))}
          </div>
          <h4 style={{ marginTop: 8 }}>{labels.bindingsSection}</h4>
          {tags.length === 0 ? (
            <small>{labels.noTagsDefined}</small>
          ) : (
            <>
              <small>{labels.bindingHint}</small>
              <label>
                {labels.bindingText}
                <input
                  value={serializeValueExpr(firstSelected.bindings?.text)}
                  placeholder="@absorbance"
                  onChange={(event) => {
                    const expr = parseValueExpr(event.target.value);
                    const next: HmiBindings = { ...firstSelected.bindings };
                    if (expr) { next.text = expr; } else { delete next.text; }
                    onUpdateSelected({ bindings: Object.keys(next).length > 0 ? next : undefined });
                  }}
                />
              </label>
            </>
          )}
          <label>
            {labels.font}
            <select
              value={firstSelected.fontVariant}
              onChange={(event) =>
                onUpdateText({ fontVariant: event.target.value as FontVariant })
              }
            >
              <option value="1">{labels.fontOne}</option>
              <option value="2">{labels.fontTwo}</option>
            </select>
          </label>
          <GeometryInput label="X" value={firstSelected.x} axis="x" canvasData={canvasData} onChange={(x) => onUpdateText({ x })} />
          <GeometryInput label="Y" value={firstSelected.y} axis="y" canvasData={canvasData} onChange={(y) => onUpdateText({ y })} />
        </>
      ) : null}

      {firstSelected.type === 'line' && selectedObjects.length === 1 ? (
        <div className="geometry-grid">
          <GeometryInput label="X0" value={firstSelected.x0} axis="x" canvasData={canvasData} onChange={(x0) => onUpdateGeometry({ ...firstSelected, x0 })} />
          <GeometryInput label="Y0" value={firstSelected.y0} axis="y" canvasData={canvasData} onChange={(y0) => onUpdateGeometry({ ...firstSelected, y0 })} />
          <GeometryInput label="X1" value={firstSelected.x1} axis="x" canvasData={canvasData} onChange={(x1) => onUpdateGeometry({ ...firstSelected, x1 })} />
          <GeometryInput label="Y1" value={firstSelected.y1} axis="y" canvasData={canvasData} onChange={(y1) => onUpdateGeometry({ ...firstSelected, y1 })} />
        </div>
      ) : null}

      {firstSelected.type === 'rect' && selectedObjects.length === 1 ? (
        <div className="geometry-grid">
          <GeometryInput label="X" value={firstSelected.x} axis="x" canvasData={canvasData} onChange={(x) => onUpdateGeometry({ ...firstSelected, x })} />
          <GeometryInput label="Y" value={firstSelected.y} axis="y" canvasData={canvasData} onChange={(y) => onUpdateGeometry({ ...firstSelected, y })} />
          <GeometryInput label="W" value={firstSelected.width} axis="x" canvasData={canvasData} onChange={(width) => onUpdateGeometry({ ...firstSelected, width: Math.max(1, width) })} />
          <GeometryInput label="H" value={firstSelected.height} axis="y" canvasData={canvasData} onChange={(height) => onUpdateGeometry({ ...firstSelected, height: Math.max(1, height) })} />
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={firstSelected.filled}
              onChange={(event) => onUpdateGeometry({ ...firstSelected, filled: event.target.checked })}
            />
            {labels.filled}
          </label>
        </div>
      ) : null}

      {firstSelected.type === 'invert' && selectedObjects.length === 1 ? (
        <div className="geometry-grid">
          <GeometryInput label="X" value={firstSelected.x} axis="x" canvasData={canvasData} onChange={(x) => onUpdateGeometry({ ...firstSelected, x })} />
          <GeometryInput label={labels.rowY} value={firstSelected.y} axis="y" canvasData={canvasData} onChange={(y) => onUpdateGeometry({ ...firstSelected, y })} />
          <GeometryInput label="W" value={firstSelected.width} axis="x" canvasData={canvasData} onChange={(width) => onUpdateGeometry({ ...firstSelected, width: Math.max(1, width) })} />
          <GeometryInput label={labels.rowHeight} value={firstSelected.height} axis="y" canvasData={canvasData} onChange={(height) => onUpdateGeometry({ ...firstSelected, height: Math.max(1, height) })} />
        </div>
      ) : null}

      {firstSelected.type === 'bitmap' && selectedObjects.length === 1 ? (
        <div className="bitmap-properties">
          <strong>{firstSelected.name}</strong>
          <span>{firstSelected.width}x{firstSelected.height}, {firstSelected.bytes.length} bytes</span>
          <GeometryInput label="X" value={firstSelected.x} axis="x" canvasData={canvasData} onChange={(x) => onUpdateGeometry({ ...firstSelected, x })} />
          <GeometryInput label="Y" value={firstSelected.y} axis="y" canvasData={canvasData} onChange={(y) => onUpdateGeometry({ ...firstSelected, y })} />
          <button type="button" onClick={() => onEditBitmap(firstSelected)}>
            {labels.editBitmapGlyph}
          </button>
        </div>
      ) : null}

      {firstSelected.type === 'special' && selectedObjects.length === 1 ? (
        <div className="geometry-grid">
          <label>
            {labels.specialType}
            <select
              value={firstSelected.kind}
              onChange={(event) => {
                const kind = event.target.value as SpecialElementKind;
                onUpdateGeometry({
                  ...firstSelected,
                  kind,
                  glyphChar: getSpecialGlyphChar(kind, firstSelected.checked),
                  glyphOverride: undefined
                });
              }}
            >
              {specialElementKinds.map((kind) => (
                <option key={kind} value={kind}>{getSpecialKindLabel(labels, kind)}</option>
              ))}
            </select>
          </label>
          <label>
            {labels.valuePercent}
            <input
              type="number"
              min={0}
              max={100}
              value={firstSelected.value}
              onChange={(event) => onUpdateGeometry({ ...firstSelected, value: clampPercent(Number.parseInt(event.target.value, 10) || 0) })}
            />
          </label>
          <GeometryInput label="X" value={firstSelected.x} axis="x" canvasData={canvasData} onChange={(x) => onUpdateGeometry({ ...firstSelected, x })} />
          <GeometryInput label="Y" value={firstSelected.y} axis="y" canvasData={canvasData} onChange={(y) => onUpdateGeometry({ ...firstSelected, y })} />
          <GeometryInput label="W" value={firstSelected.width} axis="x" canvasData={canvasData} onChange={(width) => onUpdateGeometry({ ...firstSelected, width: Math.max(1, width) })} />
          <GeometryInput label="H" value={firstSelected.height} axis="y" canvasData={canvasData} onChange={(height) => onUpdateGeometry({ ...firstSelected, height: Math.max(1, height) })} />
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={firstSelected.checked}
              onChange={(event) => onUpdateGeometry({
                ...firstSelected,
                checked: event.target.checked,
                glyphChar: getSpecialGlyphChar(firstSelected.kind, event.target.checked),
                glyphOverride: undefined
              })}
            />
            {labels.checked}
          </label>
        </div>
      ) : null}

      <button type="button" className="delete-button" onClick={onDelete}>
        <Trash2 size={16} />
        {labels.deleteSelected}
      </button>
    </section>
  );
}

function GeometryInput({
  label,
  value,
  axis,
  canvasData,
  onChange
}: {
  label: string;
  value: number;
  axis: 'x' | 'y';
  canvasData: CanvasData;
  onChange: (value: number) => void;
}): React.ReactElement {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) =>
          onChange(clampToAxis(Number.parseInt(event.target.value, 10) || 0, axis, canvasData))
        }
      />
    </label>
  );
}

function BitmapEditorModal({
  bitmap,
  labels,
  onCancel,
  onSave
}: {
  bitmap: BitmapCanvasObject;
  labels: UiText;
  onCancel: () => void;
  onSave: (bitmap: BitmapCanvasObject) => void;
}): React.ReactElement {
  const [frameBuffer, setFrameBuffer] = useState<FrameBuffer>(() =>
    unpackBytesToFrameBuffer(bitmap.bytes, bitmap.width, bitmap.height)
  );
  const togglePixel = (x: number, y: number): void => {
    setFrameBuffer((current) => current.map((row, rowIndex) =>
      rowIndex === y ? row.map((cell, colIndex) => colIndex === x ? !cell : cell) : row
    ));
  };
  return (
    <div className="glyph-modal" role="dialog" aria-modal="true">
      <div className="glyph-dialog bitmap-glyph-dialog">
        <div
          className="bitmap-glyph-grid"
          style={{ gridTemplateColumns: `repeat(${bitmap.width}, minmax(5px, 1fr))` }}
        >
          {frameBuffer.map((row, y) => row.map((cell, x) => (
            <button
              key={`${x}-${y}`}
              type="button"
              className={cell ? 'on' : ''}
              onMouseDown={() => togglePixel(x, y)}
              onMouseEnter={(event) => {
                if (event.buttons === 1) {
                  togglePixel(x, y);
                }
              }}
              aria-label={`Toggle bitmap pixel ${y}, ${x}`}
            />
          )))}
        </div>
        <div className="glyph-controls">
          <h3>{labels.bitmapGlyphEditor}</h3>
          <p className="bitmap-glyph-meta">{bitmap.name}: {bitmap.width}x{bitmap.height}</p>
          <div className="glyph-actions">
            <button type="button" onClick={onCancel}>{labels.cancel}</button>
            <button type="button" onClick={() => onSave({
              ...bitmap,
              bytes: packFrameBuffer(frameBuffer, bitmap.width, bitmap.height)
            })}>{labels.save}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlyphEditorModal({
  editingGlyph,
  labels,
  onChange,
  onCancel,
  onSave
}: {
  editingGlyph: EditingGlyph;
  labels: UiText;
  onChange: (glyph: EditingGlyph) => void;
  onCancel: () => void;
  onSave: () => void;
}): React.ReactElement {
  const rows = editingGlyph.glyph.data;

  const updateRows = (data: string[]): void => {
    onChange({
      ...editingGlyph,
      glyph: {
        width: Math.max(1, data.reduce((max, row) => Math.max(max, row.length), 0)),
        data
      }
    });
  };

  const togglePixel = (rowIndex: number, colIndex: number): void => {
    const nextRows = rows.map((row, index) => {
      if (index !== rowIndex) {
        return row;
      }
      const cells = row.split('');
      cells[colIndex] = cells[colIndex] === '#' ? '.' : '#';
      return cells.join('');
    });
    updateRows(nextRows);
  };

  const modifyRowsCols = (action: 'addR' | 'remR' | 'addC' | 'remC', position: 'top' | 'bottom' | 'left' | 'right'): void => {
    const width = rows[0]?.length ?? 1;
    let nextRows = [...rows];
    if (action === 'addR') {
      nextRows = position === 'top' ? ['.'.repeat(width), ...nextRows] : [...nextRows, '.'.repeat(width)];
    }
    if (action === 'remR' && nextRows.length > 1) {
      nextRows = position === 'top' ? nextRows.slice(1) : nextRows.slice(0, -1);
    }
    if (action === 'addC') {
      nextRows = nextRows.map((row) => (position === 'left' ? `.${row}` : `${row}.`));
    }
    if (action === 'remC' && width > 1) {
      nextRows = nextRows.map((row) => (position === 'left' ? row.slice(1) : row.slice(0, -1)));
    }
    updateRows(nextRows);
  };

  return (
    <div className="glyph-modal" role="dialog" aria-modal="true">
      <div className="glyph-dialog">
        <div className="glyph-grid">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="glyph-row">
              {row.split('').map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  className={cell === '#' ? 'on' : ''}
                  onMouseDown={() => togglePixel(rowIndex, colIndex)}
                  onMouseEnter={(event) => {
                    if (event.buttons === 1) {
                      togglePixel(rowIndex, colIndex);
                    }
                  }}
                  aria-label={`Toggle glyph pixel ${rowIndex}, ${colIndex}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="glyph-controls">
          <h3>{labels.glyph} '{editingGlyph.char}'</h3>
          <div className="glyph-metrics">
            <label>
              {labels.nominalHeight}
              <input
                type="number"
                min={1}
                value={editingGlyph.glyph.nominalHeight ?? editingGlyph.glyph.data.length}
                onChange={(event) =>
                  onChange({
                    ...editingGlyph,
                    glyph: {
                      ...editingGlyph.glyph,
                      nominalHeight: Math.max(1, Number.parseInt(event.target.value, 10) || 1)
                    }
                  })
                }
              />
            </label>
            <label>
              {labels.topOffset}
              <input
                type="number"
                min={0}
                value={editingGlyph.glyph.topOffset ?? 0}
                onChange={(event) =>
                  onChange({
                    ...editingGlyph,
                    glyph: {
                      ...editingGlyph.glyph,
                      topOffset: Math.max(0, Number.parseInt(event.target.value, 10) || 0)
                    }
                  })
                }
              />
            </label>
          </div>
          <button type="button" onClick={() => modifyRowsCols('addR', 'top')}>{labels.addRowTop}</button>
          <button type="button" onClick={() => modifyRowsCols('addR', 'bottom')}>{labels.addRowBottom}</button>
          <button type="button" onClick={() => modifyRowsCols('remR', 'top')}>{labels.removeRowTop}</button>
          <button type="button" onClick={() => modifyRowsCols('remR', 'bottom')}>{labels.removeRowBottom}</button>
          <button type="button" onClick={() => modifyRowsCols('addC', 'left')}>{labels.addColLeft}</button>
          <button type="button" onClick={() => modifyRowsCols('addC', 'right')}>{labels.addColRight}</button>
          <button type="button" onClick={() => modifyRowsCols('remC', 'left')}>{labels.removeColLeft}</button>
          <button type="button" onClick={() => modifyRowsCols('remC', 'right')}>{labels.removeColRight}</button>
          <div className="glyph-actions">
            <button type="button" onClick={onCancel}>{labels.cancel}</button>
            <button type="button" onClick={onSave}>{labels.save}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMeasurementValue(
  canvasData: CanvasData,
  language: LanguageCode,
  fontRenderer: FontRenderer
): string {
  return canvasData.objects
    .filter((object): object is TextCanvasObject => object.type === 'text')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((object) => resolveLocalizedBitmapText(object.text, language, fontRenderer, object.fontVariant as FontVariantKey))
    .find((text) => /\d/.test(text)) ??
    `${fontRenderer.measureText(canvasData.stateId, '1')}px`;
}

function getCanvasPoint(event: React.MouseEvent<HTMLCanvasElement>, canvasData: CanvasData): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampToAxis(Math.floor(((event.clientX - rect.left) / rect.width) * canvasData.width), 'x', canvasData),
    y: clampToAxis(Math.floor(((event.clientY - rect.top) / rect.height) * canvasData.height), 'y', canvasData)
  };
}

function findObjectAtPoint(
  objects: CanvasObject[],
  point: Point,
  language: LanguageCode,
  fontRenderer: FontRenderer
): CanvasObject | null {
  return (
    [...objects]
      .reverse()
      .find((object) => object.visible && pointInRect(point, getObjectBounds(object, language, fontRenderer))) ??
    null
  );
}

function findTextObjectAtPoint(
  objects: CanvasObject[],
  point: Point,
  language: LanguageCode,
  fontRenderer: FontRenderer
): TextCanvasObject | null {
  const object = findObjectAtPoint(objects, point, language, fontRenderer);
  return object?.type === 'text' ? object : null;
}

function findCharacterAtPoint(
  object: TextCanvasObject,
  point: Point,
  language: LanguageCode,
  fontRenderer: FontRenderer
): string | null {
  const text = resolveLocalizedBitmapText(object.text, language, fontRenderer, object.fontVariant as FontVariantKey);
  let cursorX = object.x;
  for (const char of text) {
    const glyph = fontRenderer.getGlyph(char, object.fontVariant as FontVariantKey);
    if (point.x >= cursorX && point.x <= cursorX + glyph.width) {
      return char;
    }
    cursorX += glyph.width + 1;
  }
  return null;
}

function moveObject(object: CanvasObject, dx: number, dy: number, canvasData: CanvasData): CanvasObject {
  if (object.type === 'text') {
    return { ...object, x: clampToAxis(object.x + dx, 'x', canvasData), y: clampToAxis(object.y + dy, 'y', canvasData) };
  }
  if (object.type === 'line') {
    return {
      ...object,
      x0: clampToAxis(object.x0 + dx, 'x', canvasData),
      y0: clampToAxis(object.y0 + dy, 'y', canvasData),
      x1: clampToAxis(object.x1 + dx, 'x', canvasData),
      y1: clampToAxis(object.y1 + dy, 'y', canvasData)
    };
  }
  if (object.type === 'rect') {
    return { ...object, x: clampToAxis(object.x + dx, 'x', canvasData), y: clampToAxis(object.y + dy, 'y', canvasData) };
  }
  if (object.type === 'special') {
    return { ...object, x: clampToAxis(object.x + dx, 'x', canvasData), y: clampToAxis(object.y + dy, 'y', canvasData) };
  }
  return { ...object, x: clampToAxis(object.x + dx, 'x', canvasData), y: clampToAxis(object.y + dy, 'y', canvasData) };
}

function toRect(rect: MarqueeRect): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(rect.x0, rect.x1),
    y: Math.min(rect.y0, rect.y1),
    width: Math.abs(rect.x1 - rect.x0),
    height: Math.abs(rect.y1 - rect.y0)
  };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(b.x > a.x + a.width || b.x + b.width < a.x || b.y > a.y + a.height || b.y + b.height < a.y);
}

function pointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function clampToAxis(value: number, axis: 'x' | 'y', canvasData: CanvasData): number {
  const max = axis === 'x' ? canvasData.width - 1 : canvasData.height - 1;
  return Math.min(max, Math.max(0, value));
}

function createObjectId(stateId: string, type: string): string {
  return `canvas-${stateId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${type}-${Date.now()}`;
}

function downloadBlob(filename: string, data: string | Uint8Array, type: string): void {
  const part = data instanceof Uint8Array ? toArrayBuffer(data) : data;
  const blob = new Blob([part], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '_') || 'lcd_screen';
}

function getDefaultSpecialSize(kind: SpecialElementKind): { width: number; height: number } {
  if (kind === 'progress') {
    return { width: 36, height: 8 };
  }
  if (kind === 'battery') {
    return { width: 18, height: 8 };
  }
  if (kind === 'signal') {
    return { width: 15, height: 12 };
  }
  if (kind === 'scrollbar') {
    return { width: 42, height: 6 };
  }
  return { width: 8, height: 8 };
}

function getSpecialKindLabel(labels: UiText, kind: SpecialElementKind): string {
  const labelsByKind: Record<SpecialElementKind, string> = {
    checkbox: labels.checkbox,
    radio: labels.radio,
    progress: labels.progressBar,
    battery: labels.battery,
    signal: labels.signalBars,
    scrollbar: labels.scrollbar
  };
  return labelsByKind[kind];
}

function getSpecialGlyphChar(kind: SpecialElementKind, checked: boolean): string {
  if (kind === 'checkbox') {
    return checked ? '☑' : '☐';
  }
  return '';
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

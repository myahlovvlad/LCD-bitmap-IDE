/**
 * @module features/animation-editor/AnimationEditor
 * @description Authoring panel for 1bpp animation resources: create/rename/delete
 * a resource, build its frame list from imported images, preview it with a
 * deterministic clock, and bind it to the current screen or selected bitmap layer.
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { defaultFontRenderer } from '../../renderer/core/fonts';
import { useProjectStore } from '../../renderer/store/projectStore';
import { UI_TEXT, type UiText } from '../../renderer/config/i18n';
import { prepareImageFile } from '../pixel-importer/imageProcessor';
import type { PixelWorkerRequest, PixelWorkerResponse } from '../pixel-importer/pixelWorker';
import { assertImportFileSize } from '../../shared/lib/security';
import type { AnimationFrame, AnimationResource } from '../../domain/animation';
import type { BitmapCanvasObject, CanvasData, LanguageCode } from '../../renderer/types/domain';
import type { LcdScreen } from '../../domain/project';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function totalDurationMs(resource: AnimationResource): number {
  return resource.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
}

interface AnimationEditorProps {
  readonly language: LanguageCode;
  readonly selectedScreen: LcdScreen | null;
  readonly selectedBitmap: BitmapCanvasObject | null;
}

export function AnimationEditor({ language, selectedScreen, selectedBitmap }: AnimationEditorProps): React.ReactElement {
  const {
    project,
    createAnimation,
    updateAnimation,
    deleteAnimation,
    addAnimationFrame,
    updateAnimationFrame,
    removeAnimationFrame,
    reorderAnimationFrames,
    bindScreenAnimation,
    bindBitmapAnimation
  } = useProjectStore();
  const labels: UiText = UI_TEXT[language];
  const catalog = project?.animations ?? { resources: {}, order: [] };
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(catalog.order[0] ?? null);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [threshold, setThreshold] = useState(128);
  const [dither, setDither] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const newAnimationFileRef = useRef<HTMLInputElement | null>(null);
  const playStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedAnimationId && !catalog.resources[selectedAnimationId]) {
      setSelectedAnimationId(catalog.order[0] ?? null);
    }
  }, [catalog, selectedAnimationId]);

  const resource = selectedAnimationId ? catalog.resources[selectedAnimationId] ?? null : null;

  useEffect(() => {
    setPlaying(false);
    setElapsedMs(0);
  }, [selectedAnimationId]);

  useEffect(() => {
    if (!playing || !resource || !resource.frames.length) {
      return;
    }
    const total = totalDurationMs(resource);
    playStartRef.current = performance.now() - elapsedMs;
    const tick = (): void => {
      const next = performance.now() - playStartRef.current;
      if (!resource.loop && next >= total) {
        setElapsedMs(Math.max(0, total - 1));
        setPlaying(false);
        return;
      }
      setElapsedMs(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, resource?.id]);

  if (!project) {
    return <section className="animation-editor-panel">{labels.noProjectLoaded}</section>;
  }

  // A resource must have at least one frame to pass project validation, so
  // "New animation" opens the file picker directly instead of committing an
  // empty resource: the first imported image both creates and seeds it.
  const createNewAnimation = (): void => {
    newAnimationFileRef.current?.click();
  };

  const loadNewAnimationFromFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const width = selectedBitmap?.width ?? selectedScreen?.width ?? project.display.width;
    const height = selectedBitmap?.height ?? selectedScreen?.height ?? project.display.height;
    try {
      assertImportFileSize(file);
      const prepared = await prepareImageFile(file, width, height);
      const bytes = await binarizeInWorker(prepared.imageData, threshold, dither);
      const id = generateId('animation');
      const animation: AnimationResource = {
        id,
        name: `${labels.newAnimation} ${catalog.order.length + 1}`,
        width,
        height,
        loop: true,
        frames: [{ id: generateId('frame'), bytes, durationMs: 120 }]
      };
      createAnimation(animation);
      setSelectedAnimationId(id);
    } catch {
      // Import failures leave the catalog unchanged; the file input is already reset.
    }
  };

  const loadFrameFromFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !resource) {
      return;
    }
    try {
      assertImportFileSize(file);
      const prepared = await prepareImageFile(file, resource.width, resource.height);
      const bytes = await binarizeInWorker(prepared.imageData, threshold, dither);
      addAnimationFrame(resource.id, {
        id: generateId('frame'),
        bytes,
        durationMs: resource.frames.length ? resource.frames[resource.frames.length - 1]!.durationMs : 120
      });
    } catch {
      // Import failures leave the resource unchanged; the file input is already reset.
    }
  };

  const moveFrame = (frameId: string, direction: -1 | 1): void => {
    if (!resource) return;
    const index = resource.frames.findIndex((frame) => frame.id === frameId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= resource.frames.length) return;
    const ids = resource.frames.map((frame) => frame.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
    reorderAnimationFrames(resource.id, ids);
  };

  const duplicateFrame = (frame: AnimationFrame): void => {
    if (!resource) return;
    addAnimationFrame(resource.id, { id: generateId('frame'), bytes: [...frame.bytes], durationMs: frame.durationMs });
  };

  const screenMismatch = resource && selectedScreen
    ? resource.width !== selectedScreen.width || resource.height !== selectedScreen.height || resource.frames.length === 0
    : true;
  const layerMismatch = resource && selectedBitmap
    ? resource.width !== selectedBitmap.width || resource.height !== selectedBitmap.height || resource.frames.length === 0
    : true;
  const boundToScreen = Boolean(resource && selectedScreen?.animationId === resource.id);
  const boundToLayer = Boolean(resource && selectedBitmap?.animationId === resource.id);

  const activeFrame = resource ? resolvePreviewFrame(resource, elapsedMs) : null;
  const previewCanvasData: CanvasData | null = resource ? {
    stateId: 'animation-preview',
    width: resource.width,
    height: resource.height,
    selectedObjectIds: [],
    updatedAt: new Date().toISOString(),
    objects: [{
      id: 'animation-preview-object',
      type: 'bitmap',
      name: resource.name,
      x: 0,
      y: 0,
      width: resource.width,
      height: resource.height,
      bytes: activeFrame?.bytes ?? [],
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user',
      animationId: resource.id
    }]
  } : null;

  return (
    <section className="animation-editor-panel" aria-label={labels.animationsPanelTitle}>
      <header className="animation-editor-header">
        <h2>{labels.animationsPanelTitle}</h2>
        <button type="button" onClick={createNewAnimation} data-testid="animation-create">
          <Plus size={15} /> {labels.newAnimation}
        </button>
        <input
          ref={newAnimationFileRef}
          type="file"
          accept="image/png,image/jpeg,image/bmp,image/svg+xml"
          hidden
          onChange={(event) => void loadNewAnimationFromFile(event)}
        />
      </header>

      <div className="animation-editor-body">
        <div className="animation-list">
          {catalog.order.length === 0 ? <p>{labels.animationsEmptyState}</p> : catalog.order.map((id) => {
            const item = catalog.resources[id];
            if (!item) return null;
            return (
              <button
                key={id}
                type="button"
                className={id === selectedAnimationId ? 'entity-row active' : 'entity-row'}
                onClick={() => setSelectedAnimationId(id)}
                data-testid={`animation-select-${id}`}
              >
                <strong>{item.name}</strong>
                <small>{item.width}x{item.height} · {item.frames.length}</small>
              </button>
            );
          })}
        </div>

        {resource ? (
          <div className="animation-detail">
            <label className="animation-name-field">
              {labels.animationNamePlaceholder}
              <input
                value={resource.name}
                onChange={(event) => updateAnimation(resource.id, { name: event.target.value })}
              />
            </label>
            <div className="animation-meta-row">
              <span>{labels.animationDimensions}: {resource.width}x{resource.height}</span>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={resource.loop}
                  onChange={(event) => updateAnimation(resource.id, { loop: event.target.checked })}
                />
                {labels.loopAnimation}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(labels.deleteAnimationConfirm)) {
                    deleteAnimation(resource.id);
                  }
                }}
                title={labels.delete}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="animation-preview" data-testid="animation-preview">
              {previewCanvasData ? (
                <LCDCanvas
                  canvasData={previewCanvasData}
                  language={language}
                  scale={5}
                  fontRenderer={defaultFontRenderer}
                  animationCatalog={{ resources: { [resource.id]: resource }, order: [resource.id] }}
                  elapsedMs={elapsedMs}
                  className="lcd-canvas"
                />
              ) : null}
              <div className="animation-transport">
                <button type="button" onClick={() => setPlaying((value) => !value)} disabled={!resource.frames.length} data-testid="animation-play-toggle">
                  {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? labels.pauseAnimation : labels.playAnimation}
                </button>
                <button type="button" onClick={() => { setElapsedMs(0); setPlaying(true); }} disabled={!resource.frames.length}>
                  <RotateCcw size={15} /> {labels.replayAnimation}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, totalDurationMs(resource) - 1)}
                  value={Math.min(elapsedMs, Math.max(0, totalDurationMs(resource) - 1))}
                  onChange={(event) => { setPlaying(false); setElapsedMs(Number(event.target.value)); }}
                  aria-label={labels.animationPreviewTitle}
                  data-testid="animation-scrub"
                />
              </div>
            </div>

            <div className="animation-frame-controls">
              <button type="button" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> {labels.addFrame}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/bmp,image/svg+xml" hidden onChange={(event) => void loadFrameFromFile(event)} />
              <label>
                {labels.threshold}: {threshold}
                <input type="range" min={0} max={255} value={threshold} onChange={(event) => setThreshold(Number.parseInt(event.target.value, 10))} />
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={dither} onChange={(event) => setDither(event.target.checked)} />
                {labels.dithering}
              </label>
            </div>

            <ol className="animation-frame-strip" data-testid="animation-frame-strip">
              {resource.frames.map((frame, index) => (
                <li key={frame.id} className="animation-frame-item">
                  <FrameThumbnail frame={frame} width={resource.width} height={resource.height} language={language} />
                  <input
                    type="number"
                    min={1}
                    max={60000}
                    value={frame.durationMs}
                    onChange={(event) => updateAnimationFrame(resource.id, frame.id, { durationMs: Number(event.target.value) })}
                    aria-label={labels.frameDurationMs}
                  />
                  <div className="animation-frame-actions">
                    <button type="button" onClick={() => moveFrame(frame.id, -1)} disabled={index === 0} title={labels.moveFrameUp}>◀</button>
                    <button type="button" onClick={() => moveFrame(frame.id, 1)} disabled={index === resource.frames.length - 1} title={labels.moveFrameDown}>▶</button>
                    <button type="button" onClick={() => duplicateFrame(frame)} title={labels.duplicateFrame}>⧉</button>
                    <button type="button" onClick={() => removeAnimationFrame(resource.id, frame.id)} title={labels.removeFrame}><Trash2 size={13} /></button>
                  </div>
                </li>
              ))}
            </ol>

            <div className="animation-binding-controls">
              <button
                type="button"
                disabled={!selectedScreen || (screenMismatch && !boundToScreen)}
                title={!selectedScreen ? labels.selectOrCreateScreen : screenMismatch && !boundToScreen ? labels.bindDimensionMismatchScreen : undefined}
                onClick={() => selectedScreen && bindScreenAnimation(selectedScreen.id, boundToScreen ? null : resource.id)}
                data-testid="animation-bind-screen"
              >
                {boundToScreen ? labels.unbindScreen : labels.bindToScreen}
              </button>
              <button
                type="button"
                disabled={!selectedBitmap || !selectedScreen || (layerMismatch && !boundToLayer)}
                title={!selectedBitmap ? labels.noBitmapSelected : layerMismatch && !boundToLayer ? labels.bindDimensionMismatchLayer : undefined}
                onClick={() => selectedScreen && selectedBitmap && bindBitmapAnimation(selectedScreen.id, selectedBitmap.id, boundToLayer ? null : resource.id)}
                data-testid="animation-bind-layer"
              >
                {boundToLayer ? labels.unbindLayer : labels.bindToLayer}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function resolvePreviewFrame(resource: AnimationResource, elapsedMs: number): AnimationFrame | null {
  if (!resource.frames.length) return null;
  const total = totalDurationMs(resource);
  if (total <= 0) return resource.frames[0] ?? null;
  let clock = resource.loop ? ((elapsedMs % total) + total) % total : Math.min(Math.max(0, elapsedMs), total - 1);
  return resource.frames.find((frame) => ((clock -= frame.durationMs) < 0)) ?? resource.frames.at(-1) ?? null;
}

function binarizeInWorker(imageData: ImageData, threshold: number, dither: boolean): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../pixel-importer/pixelWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<PixelWorkerResponse>) => {
      resolve(event.data.bytes);
      worker.terminate();
    };
    worker.onerror = () => {
      reject(new Error('Image worker failed.'));
      worker.terminate();
    };
    worker.postMessage({
      width: imageData.width,
      height: imageData.height,
      rgba: imageData.data,
      threshold,
      dither
    } satisfies PixelWorkerRequest);
  });
}

function FrameThumbnail({ frame, width, height, language }: { frame: AnimationFrame; width: number; height: number; language: LanguageCode }): React.ReactElement {
  const canvasData: CanvasData = useMemo(() => ({
    stateId: `frame-thumb-${frame.id}`,
    width,
    height,
    selectedObjectIds: [],
    updatedAt: new Date().toISOString(),
    objects: [{
      id: 'thumb',
      type: 'bitmap',
      name: 'thumb',
      x: 0,
      y: 0,
      width,
      height,
      bytes: frame.bytes,
      zIndex: 0,
      visible: true,
      locked: false,
      source: 'user'
    }]
  }), [frame.bytes, frame.id, width, height]);

  return <LCDCanvas canvasData={canvasData} language={language} scale={1.5} fontRenderer={defaultFontRenderer} className="lcd-canvas animation-frame-thumb" />;
}

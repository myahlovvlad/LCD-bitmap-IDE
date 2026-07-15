/**
 * @module features/pixel-importer/PixelImporter
 * @description UI for importing PNG/JPG/BMP/SVG artwork, previewing the original
 * next to the LCD result, and applying the binarized bitmap to a screen.
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { defaultFontRenderer } from '../../renderer/core/fonts';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { BitmapCanvasObject, CanvasData, LanguageCode } from '../../renderer/types/domain';
import { assertImportFileSize } from '../../shared/lib/security';
import { prepareImageFile } from './imageProcessor';
import type { PixelWorkerRequest, PixelWorkerResponse } from './pixelWorker';

interface PixelImporterProps {
  readonly labels: {
    readonly pixelImporter: string;
    readonly chooseImage: string;
    readonly threshold: string;
    readonly dithering: string;
    readonly applyNewScreen: string;
    readonly insertCurrentScreen: string;
    readonly applyAndEditBitmap: string;
  };
  readonly language: LanguageCode;
  readonly onOpenEditor?: () => void;
}

export function PixelImporter({ labels, language, onOpenEditor }: PixelImporterProps): React.ReactElement {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { project, selectedScreenId, createScreen, addBitmapLayer, selectScreen } = useProjectStore();
  const [threshold, setThreshold] = useState(128);
  const [dither, setDither] = useState(true);
  const [status, setStatus] = useState('');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [bytes, setBytes] = useState<number[] | null>(null);
  const currentScreen = selectedScreenId && project ? project.screens[selectedScreenId] : null;
  const currentCanvas: CanvasData | null = currentScreen ? {
    stateId: currentScreen.id,
    width: currentScreen.width,
    height: currentScreen.height,
    objects: currentScreen.objects,
    selectedObjectIds: currentScreen.selectedObjectIds,
    updatedAt: currentScreen.updatedAt
  } : null;

  useEffect(() => () => {
    if (originalUrl) {
      URL.revokeObjectURL(originalUrl);
    }
  }, [originalUrl]);

  useEffect(() => {
    if (!imageData) {
      return;
    }
    const worker = new Worker(new URL('./pixelWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<PixelWorkerResponse>) => {
      setBytes(event.data.bytes);
      worker.terminate();
    };
    worker.onerror = () => {
      setStatus('Image worker failed.');
      worker.terminate();
    };
    worker.postMessage({
      width: imageData.width,
      height: imageData.height,
      rgba: imageData.data,
      threshold,
      dither
    } satisfies PixelWorkerRequest);
    return () => worker.terminate();
  }, [dither, imageData, threshold]);

  const previewCanvas: CanvasData | null = useMemo(() => {
    if (!bytes || !currentCanvas) {
      return null;
    }
    return {
      stateId: 'pixel-preview',
      width: currentCanvas.width,
      height: currentCanvas.height,
      selectedObjectIds: [],
      updatedAt: new Date().toISOString(),
      objects: [createBitmapObject('pixel-preview', 'import-preview', bytes, currentCanvas)]
    };
  }, [bytes, currentCanvas]);

  const loadFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      assertImportFileSize(file);
      const prepared = await prepareImageFile(file, currentCanvas?.width, currentCanvas?.height);
      if (originalUrl) {
        URL.revokeObjectURL(originalUrl);
      }
      setOriginalUrl(prepared.originalUrl);
      setImageData(prepared.imageData);
      setStatus(file.name);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Image import failed.');
    }
  };

  const applyToCurrent = (): void => {
    if (!bytes || !selectedScreenId) {
      return;
    }
    addBitmapLayer(selectedScreenId, 'pixel-import', bytes);
  };

  const applyToCurrentAndEdit = (): void => {
    applyToCurrent();
    onOpenEditor?.();
  };

  const applyAsNew = (): void => {
    if (!bytes) {
      return;
    }
    createScreen('Imported bitmap');
    window.setTimeout(() => {
      const state = useProjectStore.getState();
      if (state.selectedScreenId) {
        addBitmapLayer(state.selectedScreenId, 'pixel-import', bytes);
        selectScreen(state.selectedScreenId);
      }
    }, 0);
  };

  return (
    <section className="pixel-importer-panel">
      <header>
        <h2>{labels.pixelImporter}</h2>
        <button type="button" onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
          {labels.chooseImage}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/bmp,image/svg+xml" hidden onChange={(event) => void loadFile(event)} />
      </header>
      <div className="pixel-importer-controls">
        <label>
          {labels.threshold}: {threshold}
          <input type="range" min={0} max={255} value={threshold} onChange={(event) => setThreshold(Number.parseInt(event.target.value, 10))} />
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={dither} onChange={(event) => setDither(event.target.checked)} />
          {labels.dithering}
        </label>
      </div>
      <div className="pixel-importer-preview">
        <div className="original-preview">{originalUrl ? <img src={originalUrl} alt="Imported original" /> : null}</div>
        <div className="lcd-editor-frame">
          {previewCanvas ? (
            <LCDCanvas canvasData={previewCanvas} language={language} scale={5} fontRenderer={defaultFontRenderer} className="lcd-canvas" />
          ) : null}
        </div>
      </div>
      <div className="pixel-importer-actions">
        <button type="button" disabled={!bytes} onClick={applyAsNew}>{labels.applyNewScreen}</button>
        <button type="button" disabled={!bytes || !selectedScreenId} onClick={applyToCurrent}>{labels.insertCurrentScreen}</button>
        <button type="button" disabled={!bytes || !selectedScreenId} onClick={applyToCurrentAndEdit}>{labels.applyAndEditBitmap}</button>
        <span>{status}</span>
      </div>
    </section>
  );
}

function createBitmapObject(id: string, name: string, bytes: number[], canvas: CanvasData): BitmapCanvasObject {
  return {
    id,
    type: 'bitmap',
    name,
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    bytes,
    zIndex: 0,
    visible: true,
    locked: false,
    source: 'user'
  };
}

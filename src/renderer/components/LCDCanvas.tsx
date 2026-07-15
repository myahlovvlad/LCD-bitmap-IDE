import type React from 'react';
import { useEffect, useRef } from 'react';
import { defaultFontRenderer, resolveLocalizedBitmapText } from '../core/fonts';
import type { FontRenderer } from '../core/fonts';
import { renderCanvasObjects } from '../core/rendererEngine';
import type { CanvasData, CanvasObject, LanguageCode } from '../types/domain';
import { DESIGN_TOKENS } from '../../shared/constants/tokens';

export interface MarqueeRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface LCDCanvasProps {
  canvasData: CanvasData;
  language: LanguageCode;
  scale?: number;
  showPixelGrid?: boolean;
  interactive?: boolean;
  className?: string;
  fontRenderer?: FontRenderer;
  marquee?: MarqueeRect | null;
  onSelectObject?: (objectId: string | null) => void;
  onCanvasMouseDown?: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove?: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp?: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

export function LCDCanvas({
  canvasData,
  language,
  scale = 4,
  showPixelGrid = false,
  interactive = false,
  className,
  fontRenderer = defaultFontRenderer,
  marquee = null,
  onSelectObject,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp
}: LCDCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const frameBuffer = renderCanvasObjects(canvasData.objects, {
      language,
      width: canvasData.width,
      height: canvasData.height,
      fontRenderer
    });

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = DESIGN_TOKENS.lcd.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < frameBuffer.length; y += 1) {
      for (let x = 0; x < frameBuffer[y].length; x += 1) {
        ctx.fillStyle = frameBuffer[y][x]
          ? DESIGN_TOKENS.lcd.activePixel
          : DESIGN_TOKENS.lcd.inactivePixel;
        const inset = scale > 1 ? 1 : 0;
        ctx.fillRect(x * scale + inset, y * scale + inset, Math.max(1, scale - inset), Math.max(1, scale - inset));
      }
    }

    void showPixelGrid;

    drawSelectionBounds(
      ctx,
      canvasData.objects,
      canvasData.selectedObjectIds,
      scale,
      language,
      fontRenderer
    );
    if (marquee) {
      drawMarquee(ctx, marquee, scale);
    }
  }, [canvasData, language, scale, showPixelGrid, fontRenderer, marquee]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={canvasData.width * scale}
      height={canvasData.height * scale}
      onClick={(event) => {
        if (!interactive || !onSelectObject) {
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvasData.width);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvasData.height);
        const hitObject = [...canvasData.objects]
          .reverse()
          .find((object) =>
            object.visible && isPointInsideObject(object, x, y, language, fontRenderer)
          );
        onSelectObject(hitObject?.id ?? null);
      }}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      aria-label={`${canvasData.stateId} LCD canvas`}
    />
  );
}

function drawSelectionBounds(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  selectedObjectIds: string[],
  scale: number,
  language: LanguageCode,
  fontRenderer: FontRenderer
): void {
  if (selectedObjectIds.length === 0) {
    return;
  }

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = Math.max(1, scale);
  for (const object of objects) {
    if (!selectedObjectIds.includes(object.id)) {
      continue;
    }

    const bounds = getObjectBounds(object, language, fontRenderer);
    ctx.strokeRect(
      bounds.x * scale + 0.5,
      bounds.y * scale + 0.5,
      bounds.width * scale,
      bounds.height * scale
    );
  }
}

function isPointInsideObject(
  object: CanvasObject,
  x: number,
  y: number,
  language: LanguageCode,
  fontRenderer: FontRenderer
): boolean {
  const bounds = getObjectBounds(object, language, fontRenderer);
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

export function getObjectBounds(
  object: CanvasObject,
  language: LanguageCode,
  fontRenderer: FontRenderer = defaultFontRenderer
): { x: number; y: number; width: number; height: number } {
  if (object.type === 'text') {
    const text = resolveLocalizedBitmapText(object.text, language, fontRenderer, object.fontVariant);
    const bitmask = fontRenderer.renderTextBitmask(text, object.fontVariant);
    return {
      x: object.x,
      y: object.y,
      width: Math.max(1, bitmask[0]?.length ?? 1),
      height: Math.max(1, bitmask.length)
    };
  }

  if (object.type === 'line') {
    return {
      x: Math.min(object.x0, object.x1),
      y: Math.min(object.y0, object.y1),
      width: Math.max(1, Math.abs(object.x1 - object.x0)),
      height: Math.max(1, Math.abs(object.y1 - object.y0))
    };
  }

  if (object.type === 'rect') {
    return { x: object.x, y: object.y, width: object.width, height: object.height };
  }

  if (object.type === 'bitmap') {
    return { x: object.x, y: object.y, width: object.width, height: object.height };
  }

  if (object.type === 'special') {
    return { x: object.x, y: object.y, width: object.width, height: object.height };
  }

  return { x: object.x, y: object.y, width: object.width, height: object.height };
}

function drawMarquee(ctx: CanvasRenderingContext2D, marquee: MarqueeRect, scale: number): void {
  const x = Math.min(marquee.x0, marquee.x1);
  const y = Math.min(marquee.y0, marquee.y1);
  const width = Math.abs(marquee.x1 - marquee.x0);
  const height = Math.abs(marquee.y1 - marquee.y0);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, width * scale, height * scale);
  ctx.setLineDash([]);
}

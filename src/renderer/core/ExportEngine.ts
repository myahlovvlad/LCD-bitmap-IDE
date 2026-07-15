import type { CanvasData, CanvasObject, LanguageCode } from '../types/domain';
import type { FontRenderer } from './fonts';
import {
  generateAllScreensBinary,
  generateAllScreensCHeader,
  generateBytesFromObjects,
  generateScreenBinary,
  generateScreenCArray,
  sanitizeSymbolName,
  type AllScreensExportOptions,
  type ScreenExportOptions
} from '../utils/codegen';
import { packFrameBuffer, type FrameBuffer } from '../utils/render';

export interface CCodeExportOptions extends ScreenExportOptions {}

export class ExportEngine {
  generateBytesFromObjects(
    objects: CanvasObject[],
    language: LanguageCode,
    fontRenderer?: FontRenderer,
    width?: number,
    height?: number
  ): number[] {
    return generateBytesFromObjects(objects, language, fontRenderer, width, height);
  }

  packFrameBuffer(frameBuffer: FrameBuffer): number[] {
    return packFrameBuffer(frameBuffer);
  }

  generateCCode(objects: CanvasObject[], options: CCodeExportOptions): string {
    return generateScreenCArray(objects, options);
  }

  generateBinary(
    objects: CanvasObject[],
    language: LanguageCode,
    fontRenderer?: FontRenderer,
    width?: number,
    height?: number
  ): Uint8Array {
    return generateScreenBinary(objects, language, fontRenderer, width, height);
  }

  generateAllScreensCHeader(canvases: readonly CanvasData[], options: AllScreensExportOptions): string {
    return generateAllScreensCHeader(canvases, options);
  }

  generateAllScreensBinary(
    canvases: readonly CanvasData[],
    language: LanguageCode,
    fontRenderer?: FontRenderer
  ): Uint8Array {
    return generateAllScreensBinary(canvases, language, fontRenderer);
  }
}

export { sanitizeSymbolName };

export const exportEngine = new ExportEngine();

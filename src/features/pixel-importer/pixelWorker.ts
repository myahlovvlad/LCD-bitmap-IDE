/**
 * @module features/pixel-importer/pixelWorker
 * @description Web Worker entrypoint for non-blocking image binarization.
 */

import { binarizeToBytes, rgbaToGrayscale } from './dithering';

export interface PixelWorkerRequest {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
  readonly threshold: number;
  readonly dither: boolean;
}

export interface PixelWorkerResponse {
  readonly bytes: number[];
}

self.onmessage = (event: MessageEvent<PixelWorkerRequest>): void => {
  const grayscale = rgbaToGrayscale(event.data.rgba, event.data.width, event.data.height);
  const bytes = binarizeToBytes(grayscale, event.data.width, event.data.height, {
    threshold: event.data.threshold,
    dither: event.data.dither
  });
  self.postMessage({ bytes } satisfies PixelWorkerResponse);
};

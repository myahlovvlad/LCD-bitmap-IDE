import type { CompilerFrameBuffer } from '../lowering/rendering';
import { packFrameBufferVerticalLsb } from '../lowering/rendering';

export interface DisplayEncodingSpec {
  readonly width: number;
  readonly height: number;
  readonly colorMode: 'monochrome';
  readonly packing: 'vertical-lsb';
}

export function getEncodedDisplayByteLength(display: DisplayEncodingSpec): number {
  assertDisplayEncodingSpec(display);
  switch (display.packing) {
    case 'vertical-lsb':
      return display.width * Math.ceil(display.height / 8);
  }
}

export function encodeDisplayRaster(frameBuffer: CompilerFrameBuffer, display: DisplayEncodingSpec): number[] {
  assertDisplayEncodingSpec(display);
  if (frameBuffer.length !== display.height || frameBuffer.some((row) => row.length !== display.width)) {
    throw new Error(`Canonical raster ${frameBuffer[0]?.length ?? 0}x${frameBuffer.length} does not match display ${display.width}x${display.height}.`);
  }
  switch (display.packing) {
    case 'vertical-lsb':
      return packFrameBufferVerticalLsb(frameBuffer, display.width, display.height);
  }
}

function assertDisplayEncodingSpec(display: DisplayEncodingSpec): void {
  if (!Number.isInteger(display.width) || !Number.isInteger(display.height) || display.width <= 0 || display.height <= 0) {
    throw new Error('Display dimensions must be positive integers.');
  }
  if (display.colorMode !== 'monochrome' || display.packing !== 'vertical-lsb') {
    throw new Error(`Unsupported display encoding: ${display.colorMode}/${display.packing}.`);
  }
}

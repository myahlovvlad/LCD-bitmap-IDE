/**
 * XBM (X BitMap) export backend.
 *
 * Format: horizontal byte order, LSB = leftmost pixel.
 * Used by: u8g2 (u8g2_DrawXBM), LVGL, libX11 (XReadBitmapFile),
 *          ImageMagick, GIMP, many 1bpp bitmap tools.
 *
 * Include in firmware:
 *   #include "screen.xbm"
 *   u8g2_DrawXBM(&u8g2, 0, 0, screen_width, screen_height, screen_bits);
 */

import { createCodegenArtifact, createCodegenArtifactSet } from '../artifacts/codegenArtifacts';
import type { LoweredScreenIr, LoweredTargetIrV1 } from '../target-ir/targetIr';
import type { CodegenBackend, CodegenRequest } from './codegenBackend';
import { sanitizeSymbolName } from './legacyCBackend';

export const XBM_BACKEND_ID = 'xbm-backend';

export const xbmBackend: CodegenBackend = {
  id: XBM_BACKEND_ID,
  targetProfileId: 'legacy-lcd-vertical-lsb',
  generate(targetIr, request) {
    if (request.scope === 'selected-screen') {
      const screen = requireSelectedScreen(targetIr, request.selectedScreenId);
      const sym = sanitizeSymbolName(request.selectedSymbolName ?? `${screen.id}_screen`);
      const xbm = createCodegenArtifact(
        'c-header',
        `${screen.id}_screen.xbm`,
        'image/x-xbitmap',
        generateXbmFile(sym, screen.framebufferBytes, targetIr.targetProfile.display.width, targetIr.targetProfile.display.height)
      );
      return createCodegenArtifactSet(XBM_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, [xbm]);
    }

    const baseName = sanitizeSymbolName(request.projectSymbolName ?? targetIr.project.id);
    const artifacts = targetIr.screens.map((screen) => {
      const sym = sanitizeSymbolName(`${baseName}_${screen.id}_screen`);
      return createCodegenArtifact(
        'c-header',
        `${baseName}_${screen.id}_screen.xbm`,
        'image/x-xbitmap',
        generateXbmFile(sym, screen.framebufferBytes, targetIr.targetProfile.display.width, targetIr.targetProfile.display.height)
      );
    });
    return createCodegenArtifactSet(XBM_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, artifacts);
  }
};

function generateXbmFile(name: string, verticalLsbBytes: readonly number[], width: number, height: number): string {
  // Re-pack from vertical-LSB to horizontal-LSB (XBM native)
  const frameBuffer = verticalLsbToFrameBuffer(verticalLsbBytes, width, height);
  const horizontalBytes = packHorizontalLsb(frameBuffer, width, height);
  const stride = Math.ceil(width / 8);
  const rows: string[] = [];
  for (let i = 0; i < horizontalBytes.length; i += stride) {
    rows.push('  ' + horizontalBytes.slice(i, i + stride).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', '));
  }
  return [
    `#define ${name}_width  ${width}`,
    `#define ${name}_height ${height}`,
    `static const unsigned char ${name}_bits[] = {`,
    rows.join(',\n'),
    '};'
  ].join('\n');
}

function verticalLsbToFrameBuffer(bytes: readonly number[], width: number, height: number): boolean[][] {
  const buf: boolean[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  const pages = Math.ceil(height / 8);
  for (let page = 0; page < pages; page++) {
    for (let x = 0; x < width; x++) {
      const byte = bytes[page * width + x] ?? 0;
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        if (y < height) buf[y][x] = (byte & (1 << bit)) !== 0;
      }
    }
  }
  return buf;
}

function packHorizontalLsb(buf: boolean[][], width: number, height: number): number[] {
  const bytes: number[] = [];
  const stride = Math.ceil(width / 8);
  for (let y = 0; y < height; y++) {
    for (let col = 0; col < stride; col++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = col * 8 + bit;
        if (x < width && buf[y][x]) byte |= 1 << bit;
      }
      bytes.push(byte);
    }
  }
  return bytes;
}

function requireSelectedScreen(targetIr: LoweredTargetIrV1, selectedScreenId: string | undefined): LoweredScreenIr {
  const screen = targetIr.screens.find((s) => s.id === selectedScreenId) ?? targetIr.screens[0];
  if (!screen) throw new Error('No LCD screen available for XBM export');
  return screen;
}

/**
 * Arduino PROGMEM export backend.
 *
 * Produces a C/C++ header with PROGMEM attribute for storing LCD bitmaps
 * in AVR flash memory. Also works on ESP8266/ESP32/STM32duino where
 * PROGMEM is either ignored or mapped to DRAM_ATTR.
 *
 * Generated header usage:
 *   #include "screen.h"
 *   // Direct access (AVR):  pgm_read_byte(&SCREEN_NAME[i])
 *   // ESP32/ARM (no-op):    SCREEN_NAME[i]
 *
 *   // With Adafruit GFX:    display.drawBitmap(x, y, SCREEN_NAME, W, H, WHITE);
 *   // With u8g2 as XBM:     (convert using xbmBackend instead)
 */

import { createCodegenArtifact, createCodegenArtifactSet } from '../artifacts/codegenArtifacts';
import type { LoweredScreenIr, LoweredTargetIrV1 } from '../target-ir/targetIr';
import type { CodegenBackend, CodegenRequest } from './codegenBackend';
import { sanitizeSymbolName } from './legacyCBackend';

export const ARDUINO_BACKEND_ID = 'arduino-progmem-backend';
const BYTES_PER_ROW = 16;

export const arduinoBackend: CodegenBackend = {
  id: ARDUINO_BACKEND_ID,
  targetProfileId: 'legacy-lcd-vertical-lsb',
  generate(targetIr, request) {
    const { width, height } = targetIr.targetProfile.display;

    if (request.scope === 'selected-screen') {
      const screen = requireSelectedScreen(targetIr, request.selectedScreenId);
      const sym = sanitizeSymbolName(request.selectedSymbolName ?? `${screen.id}_screen`);
      const header = createCodegenArtifact(
        'c-header',
        `${screen.id}_screen.h`,
        'text/x-c',
        generateArduinoHeader(sym, screen.framebufferBytes, width, height, false)
      );
      return createCodegenArtifactSet(ARDUINO_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, [header]);
    }

    const baseName = sanitizeSymbolName(request.projectSymbolName ?? targetIr.project.id);
    const guard = `${baseName.toUpperCase()}_LCD_SCREENS_H`;
    const sections: string[] = [
      `#ifndef ${guard}`,
      `#define ${guard}`,
      '',
      '#include <Arduino.h>',
      '#include <avr/pgmspace.h>',
      '',
      `// LCD screens bundle — 1bpp vertical pages, LSB at top`,
      `// Dimensions: ${width}x${height} px  |  ${screen1ByteLength(targetIr)} bytes/screen`,
      ''
    ];

    for (const screen of targetIr.screens) {
      const sym = sanitizeSymbolName(`${baseName}_${screen.id}_screen`);
      sections.push(generateProgmemArray(sym, screen.framebufferBytes));
      sections.push('');
    }

    // Lookup table (AVR: const PROGMEM; ESP32: const)
    const tableRows = targetIr.screens.map((screen) => {
      const sym = sanitizeSymbolName(`${baseName}_${screen.id}_screen`);
      return `  { "${escapeCString(screen.id)}", ${sym} }`;
    });
    sections.push(
      `typedef struct { const char *state_id; const uint8_t *data; } lcd_screen_entry_t;`,
      `static const lcd_screen_entry_t PROGMEM ${baseName}_screens[${targetIr.screens.length}] = {`,
      tableRows.join(',\n'),
      '};',
      '',
      `#define ${baseName.toUpperCase()}_SCREEN_COUNT ${targetIr.screens.length}`,
      `#define ${baseName.toUpperCase()}_SCREEN_WIDTH  ${width}`,
      `#define ${baseName.toUpperCase()}_SCREEN_HEIGHT ${height}`,
      '',
      `#endif /* ${guard} */`
    );

    const header = createCodegenArtifact(
      'c-header',
      `${baseName}_lcd_screens.h`,
      'text/x-c',
      sections.join('\n')
    );
    return createCodegenArtifactSet(ARDUINO_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, [header]);
  }
};

function generateArduinoHeader(
  sym: string,
  bytes: readonly number[],
  width: number,
  height: number,
  isBundle: boolean
): string {
  const guard = `${sym.toUpperCase()}_H`;
  return [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#include <Arduino.h>',
    '#include <avr/pgmspace.h>',
    '',
    `// LCD bitmap — 1bpp vertical pages, LSB at top (SSD1306 native)`,
    `// Dimensions: ${width}x${height} px  |  ${bytes.length} bytes`,
    '',
    generateProgmemArray(sym, bytes),
    '',
    `#define ${sym.toUpperCase()}_WIDTH  ${width}`,
    `#define ${sym.toUpperCase()}_HEIGHT ${height}`,
    `#define ${sym.toUpperCase()}_BYTES  ${bytes.length}`,
    '',
    `// AVR: pgm_read_byte(&${sym}[i])`,
    `// ESP32/ARM: ${sym}[i]`,
    `// Adafruit GFX: display.drawBitmap(x, y, ${sym}, ${width}, ${height}, WHITE);`,
    '',
    `#endif /* ${guard} */`
  ].join('\n');
}

function generateProgmemArray(sym: string, bytes: readonly number[]): string {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
    rows.push(
      '  ' + [...bytes.slice(i, i + BYTES_PER_ROW)]
        .map((b) => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`)
        .join(', ')
    );
  }
  return [
    `static const uint8_t PROGMEM ${sym}[${bytes.length}] = {`,
    rows.join(',\n'),
    '};'
  ].join('\n');
}

function screen1ByteLength(targetIr: LoweredTargetIrV1): number {
  return targetIr.screens[0]?.framebufferBytes.length ?? 0;
}

function requireSelectedScreen(targetIr: LoweredTargetIrV1, selectedScreenId: string | undefined): LoweredScreenIr {
  const screen = targetIr.screens.find((s) => s.id === selectedScreenId) ?? targetIr.screens[0];
  if (!screen) throw new Error('No LCD screen available for Arduino PROGMEM export');
  return screen;
}

function escapeCString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

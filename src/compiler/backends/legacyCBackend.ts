import type { CodegenArtifactSet } from '../artifacts/codegenArtifacts';
import { createCodegenArtifact, createCodegenArtifactSet } from '../artifacts/codegenArtifacts';
import type { LoweredScreenIr, LoweredTargetIrV1 } from '../target-ir/targetIr';
import type { CodegenBackend, CodegenRequest } from './codegenBackend';

export const LEGACY_C_BACKEND_ID = 'legacy-c-backend';
const LEGACY_DOCUMENTATION_HEADER = 'LCD, glyph and FSM interface workbench';

export const legacyCBackend: CodegenBackend = {
  id: LEGACY_C_BACKEND_ID,
  targetProfileId: 'legacy-lcd-vertical-lsb',
  generate(targetIr, request) {
    if (request.scope === 'selected-screen') {
      const screen = requireSelectedScreen(targetIr, request.selectedScreenId);
      const symbolName = request.selectedSymbolName ?? `${screen.id}_screen`;
      const header = createCodegenArtifact(
        'c-header',
        `${screen.id}_screen.h`,
        'text/x-c',
        generateCArray(sanitizeSymbolName(symbolName), screen.framebufferBytes, targetIr.targetProfile.codegen.cArrayBytesPerRow)
      );
      const binary = createCodegenArtifact(
        'binary',
        `${screen.id}_screen.bin`,
        'application/octet-stream',
        Uint8Array.from(screen.framebufferBytes)
      );
      return createCodegenArtifactSet(LEGACY_C_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, [header, binary]);
    }

    const projectSymbolName = request.projectSymbolName ?? targetIr.project.id;
    const header = createCodegenArtifact(
      'c-header',
      `${targetIr.project.id}_lcd_screens.h`,
      'text/x-c',
      generateAllScreensCHeader(targetIr, projectSymbolName)
    );
    const binary = createCodegenArtifact(
      'binary',
      `${targetIr.project.id}_lcd_screens.bin`,
      'application/octet-stream',
      Uint8Array.from(targetIr.screens.flatMap((screen) => [...screen.framebufferBytes]))
    );
    return createCodegenArtifactSet(LEGACY_C_BACKEND_ID, targetIr.targetProfile.id, targetIr.sourceFingerprint, [header, binary]);
  }
};

export function sanitizeSymbolName(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  return sanitized.length > 0 ? sanitized : 'lcd_screen';
}

export function screenSymbolName(baseName: string, stateId: string): string {
  return sanitizeSymbolName(`${baseName}_${stateId}_screen`);
}

export function generateCArray(symbolName: string, bytes: readonly number[], bytesPerRow = 16): string {
  assertByteArray(bytes);
  const rows: string[] = [];

  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    rows.push(
      `  ${bytes
        .slice(i, i + bytesPerRow)
        .map((byte) => `0x${byte.toString(16).padStart(2, '0').toUpperCase()}`)
        .join(', ')}`
    );
  }

  return [
    `static const uint8_t ${sanitizeSymbolName(symbolName)}[${bytes.length}] = {`,
    rows.join(',\n'),
    '};'
  ].join('\n');
}

export function generateAllScreensCHeader(targetIr: LoweredTargetIrV1, projectSymbolName: string): string {
  const baseName = sanitizeSymbolName(projectSymbolName || 'lcd_project');
  const guard = `${baseName.toUpperCase()}_${targetIr.targetProfile.codegen.includeHeaderGuardSuffix}`;
  const arrays = targetIr.screens.map((screen) =>
    generateCArray(
      screenSymbolName(baseName, screen.id),
      screen.framebufferBytes,
      targetIr.targetProfile.codegen.cArrayBytesPerRow
    )
  );
  const tableRows = targetIr.screens.map((screen) => {
    const symbolName = screenSymbolName(baseName, screen.id);
    return `  { "${escapeCString(screen.id)}", ${symbolName}, ${targetIr.targetProfile.codegen.allScreensTableByteLength} }`;
  });

  return [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#include <stdint.h>',
    '#include <stddef.h>',
    '',
    `// ${LEGACY_DOCUMENTATION_HEADER}`,
    `// LCD screens: 1bpp, vertical pages, LSB at top`,
    '',
    'typedef struct {',
    '  const char *state_id;',
    '  const uint8_t *data;',
    '  size_t size;',
    `} ${targetIr.targetProfile.codegen.structName};`,
    '',
    arrays.join('\n\n'),
    '',
    `static const ${targetIr.targetProfile.codegen.structName} ${baseName}_screens[${targetIr.screens.length}] = {`,
    tableRows.join(',\n'),
    '};',
    '',
    `#define ${baseName.toUpperCase()}_SCREEN_COUNT ${targetIr.screens.length}`,
    '',
    `#endif /* ${guard} */`
  ].join('\n');
}

function requireSelectedScreen(targetIr: LoweredTargetIrV1, selectedScreenId: string | undefined): LoweredScreenIr {
  const screen = targetIr.screens.find((item) => item.id === selectedScreenId) ?? targetIr.screens[0];
  if (!screen) {
    throw new Error('No LCD screen is available for code generation');
  }
  return screen;
}

function assertByteArray(bytes: readonly number[]): void {
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error(`Invalid byte value: ${byte}`);
    }
  }
}

function escapeCString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

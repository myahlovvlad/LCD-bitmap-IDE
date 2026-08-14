import { strToU8, zipSync, type Zippable } from 'fflate';
import {
  arduinoBackend
} from '../../compiler/backends/arduinoBackend';
import { legacyCBackend } from '../../compiler/backends/legacyCBackend';
import { rustBackend } from '../../compiler/backends/rustBackend';
import { xbmBackend } from '../../compiler/backends/xbmBackend';
import { sha256Hex } from '../../compiler/artifacts/sha256';
import { lowerToTargetIr } from '../../compiler/lowering/lowerToTargetIr';
import { normalizeProject } from '../../compiler/normalization/normalizeProject';
import { LEGACY_LCD_TARGET_PROFILE } from '../../compiler/profiles/legacyTargetProfile';
import { createCompilerSourceSnapshot } from '../../compiler/source/createCompilerSource';
import { getEncodedDisplayByteLength } from '../../compiler/encoding/displayEncoder';
import type { FontGlyphs, Glyph, LanguageCode, LcdBitmapProject, TextCanvasObject } from '../../domain';
import { glyphs as bundledGlyphs } from '../../domain/fonts';
import { emitPortableFormulaC } from '../../domain/portableFormula';
import {
  ECROS_5300_DYNAMIC_FIELDS,
  ECROS_5300_FORMULAS,
  ECROS_CLI_COMMANDS
} from '../../spectrophotometer';

export interface HandoffPackageManifest {
  schemaVersion: 1;
  generator: 'LCD-bitmap IDE HMI Handoff';
  generatedAt: string;
  project: {
    id: string;
    name: string;
    display: string;
    packing: string;
    screenCount: number;
    languages: readonly LanguageCode[];
  };
  files: Array<{ path: string; byteLength: number; sha256: string }>;
  glyphClosure: {
    requestedCharacters: number;
    exportedGlyphs: number;
    missingCharacters: string[];
  };
  formulaAssumptions: string[];
}

export interface HandoffPackageResult {
  filename: string;
  zip: Uint8Array;
  manifest: HandoffPackageManifest;
}

const LANGUAGES: readonly LanguageCode[] = ['ru', 'en', 'zh'];

export async function buildHandoffPackage(
  project: LcdBitmapProject,
  fontGlyphs?: FontGlyphs,
  now = new Date()
): Promise<HandoffPackageResult> {
  const files = new Map<string, string | Uint8Array>();
  const activeGlyphs = fontGlyphs ?? bundledGlyphs;

  for (const language of LANGUAGES) {
    const source = createCompilerSourceSnapshot({
      project,
      fontGlyphs: activeGlyphs,
      requestedLocales: [language]
    });
    const normalized = normalizeProject(source);
    const targetIr = lowerToTargetIr(normalized.ir, {
      language,
      targetProfile: LEGACY_LCD_TARGET_PROFILE,
      fontGlyphs: activeGlyphs
    });
    const request = {
      scope: 'all-screens' as const,
      language,
      projectSymbolName: `${project.meta.id}_${language}`
    };
    addArtifacts(files, `firmware/${language}/legacy`, legacyCBackend.generate(targetIr, request).artifacts);
    addArtifacts(files, `firmware/${language}/arduino`, arduinoBackend.generate(targetIr, request).artifacts);
    addArtifacts(files, `firmware/${language}/rust`, rustBackend.generate(targetIr, request).artifacts);
    addArtifacts(files, `firmware/${language}/xbm`, xbmBackend.generate(targetIr, request).artifacts);

    for (const screen of targetIr.screens) {
      const png = await createPreviewPng(screen.framebufferBytes, project.display.width, project.display.height);
      if (png) {
        files.set(`previews/${language}/${safePath(screen.id)}.png`, png);
      }
    }
  }

  const textEntries = collectTextEntries(project);
  files.set('handoff/text_registry.csv', strToU8(toTextRegistryCsv(textEntries), true));
  files.set('handoff/dynamic_fields.csv', strToU8(toDynamicFieldsCsv(), true));
  files.set('handoff/dynamic_fields.json', prettyJson(ECROS_5300_DYNAMIC_FIELDS));
  files.set('handoff/screen_map.json', prettyJson(createScreenMap(project)));
  files.set('handoff/cli_contracts.json', prettyJson(ECROS_CLI_COMMANDS));
  files.set('handoff/formulas.json', prettyJson(ECROS_5300_FORMULAS));
  files.set('firmware/common/hmi_formulas.h', generateFormulaHeader());
  files.set('firmware/common/hmi_formulas.c', generateFormulaSource());

  const glyphClosure = createGlyphClosure(textEntries, activeGlyphs);
  files.set('handoff/used_glyphs.json', prettyJson(glyphClosure.payload));
  files.set('firmware/common/used_glyphs.h', glyphClosure.cHeader);
  files.set('README_zh.html', generateChineseReadme(project, glyphClosure.missingCharacters));
  files.set('README_en.md', generateEnglishReadme(project, glyphClosure.missingCharacters));

  const manifest: HandoffPackageManifest = {
    schemaVersion: 1,
    generator: 'LCD-bitmap IDE HMI Handoff',
    generatedAt: now.toISOString(),
    project: {
      id: project.meta.id,
      name: project.meta.name,
      display: `${project.display.width}x${project.display.height} monochrome 1bpp`,
      packing: project.display.packing,
      screenCount: project.screenOrder.length,
      languages: LANGUAGES
    },
    files: [...files].map(([path, content]) => ({
      path,
      byteLength: bytes(content).length,
      sha256: sha256Hex(content)
    })).sort((a, b) => a.path.localeCompare(b.path)),
    glyphClosure: {
      requestedCharacters: glyphClosure.requestedCharacters,
      exportedGlyphs: glyphClosure.exportedGlyphs,
      missingCharacters: glyphClosure.missingCharacters
    },
    formulaAssumptions: ECROS_5300_FORMULAS
      .map((formula) => formula.note)
      .filter((note): note is string => Boolean(note))
  };
  files.set('manifest.json', prettyJson(manifest));

  const zippable: Zippable = {};
  for (const [path, content] of files) {
    zippable[path] = bytes(content);
  }
  return {
    filename: `${safePath(project.meta.id || 'lcd-project')}-hmi-handoff.zip`,
    zip: zipSync(zippable, { level: 6 }),
    manifest
  };
}

function addArtifacts(
  files: Map<string, string | Uint8Array>,
  prefix: string,
  artifacts: readonly { path: string; content: string | Uint8Array }[]
): void {
  for (const artifact of artifacts) {
    files.set(`${prefix}/${artifact.path}`, artifact.content);
  }
}

function collectTextEntries(project: LcdBitmapProject): Array<{
  screenId: string;
  screenName: string;
  object: TextCanvasObject;
}> {
  return project.screenOrder.flatMap((screenId) => {
    const screen = project.screens[screenId];
    if (!screen) return [];
    return screen.objects
      .filter((object): object is TextCanvasObject => object.type === 'text')
      .map((object) => ({ screenId, screenName: screen.name, object }));
  });
}

function createScreenMap(project: LcdBitmapProject): unknown {
  return {
    schemaVersion: 1,
    display: project.display,
    screens: project.screenOrder.reduce<{ entries: unknown[]; offset: number }>(
      (acc, screenId, index) => {
        const screen = project.screens[screenId];
        const w = screen?.width ?? project.display.width;
        const h = screen?.height ?? project.display.height;
        const byteLength = getEncodedDisplayByteLength({
          width: w,
          height: h,
          colorMode: project.display.colorMode,
          packing: project.display.packing
        });
        acc.entries.push({
          index,
          id: screenId,
          name: screen?.name ?? screenId,
          binaryOffset: acc.offset,
          byteLength,
          linkedStateIds: Object.values(project.fsm.states)
            .filter((state) => state.screenId === screenId)
            .map((state) => state.id),
          objects: screen?.objects.map((object) => ({
            ...object,
            firmwareBinding: object.bindings ?? null
          })) ?? []
        });
        acc.offset += byteLength;
        return acc;
      },
      { entries: [], offset: 0 }
    ).entries
  };
}

function toTextRegistryCsv(entries: ReturnType<typeof collectTextEntries>): string {
  const header = ['screen_id', 'screen_name', 'object_id', 'ru', 'en', 'zh', 'tag', 'format', 'unit'];
  const rows = entries.map(({ screenId, screenName, object }) => [
    screenId,
    screenName,
    object.id,
    object.text.ru ?? '',
    object.text.en ?? '',
    object.text.zh ?? '',
    object.bindings?.text?.kind === 'tag' ? object.bindings.text.tagId : '',
    resolveTagFormat(object.bindings?.text?.kind === 'tag' ? object.bindings.text.tagId : ''),
    resolveTagUnit(object.bindings?.text?.kind === 'tag' ? object.bindings.text.tagId : '')
  ]);
  return [header, ...rows].map(csvRow).join('\r\n');
}

function toDynamicFieldsCsv(): string {
  return [
    ['object_id', 'tag_id', 'format', 'unit', 'label_ru', 'label_en', 'label_zh'],
    ...ECROS_5300_DYNAMIC_FIELDS.map((field) => [
      field.objectId,
      field.tagId,
      field.format,
      field.unit,
      field.label.ru,
      field.label.en,
      field.label.zh
    ])
  ].map(csvRow).join('\r\n');
}

function resolveTagFormat(tagId: string): string {
  return ECROS_5300_DYNAMIC_FIELDS.find((field) => field.tagId === tagId)?.format ?? '';
}

function resolveTagUnit(tagId: string): string {
  return ECROS_5300_DYNAMIC_FIELDS.find((field) => field.tagId === tagId)?.unit ?? '';
}

function csvRow(values: readonly unknown[]): string {
  return values.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
}

function generateFormulaHeader(): string {
  const declarations = ECROS_5300_FORMULAS.map((formula) => {
    const args = formula.dependencies.map((dep) => `double ${cSymbol(dep)}`).join(', ');
    return `double ${formula.cFunctionName}(${args}${args ? ', ' : ''}int *valid);`;
  });
  return [
    '#ifndef LCD_HMI_FORMULAS_H',
    '#define LCD_HMI_FORMULAS_H',
    '',
    ...declarations,
    '',
    '#endif /* LCD_HMI_FORMULAS_H */'
  ].join('\n');
}

function generateFormulaSource(): string {
  const implementations = ECROS_5300_FORMULAS.map((formula) => {
    const args = formula.dependencies.map((dep) => `double ${cSymbol(dep)}`).join(', ');
    const expression = emitPortableFormulaC(formula.expression, cSymbol);
    return [
      formula.note ? `/* ${formula.note} */` : null,
      `double ${formula.cFunctionName}(${args}${args ? ', ' : ''}int *valid) {`,
      `  const double result = ${expression};`,
      '  const int result_valid = isfinite(result);',
      '  if (valid != 0) { *valid = result_valid; }',
      '  return result_valid ? result : 0.0;',
      '}'
    ].filter(Boolean).join('\n');
  });
  return [
    '#include "hmi_formulas.h"',
    '#include <math.h>',
    '',
    ...implementations.flatMap((item) => [item, ''])
  ].join('\n');
}

function createGlyphClosure(
  entries: ReturnType<typeof collectTextEntries>,
  fontGlyphs: FontGlyphs
): {
  payload: unknown;
  cHeader: string;
  requestedCharacters: number;
  exportedGlyphs: number;
  missingCharacters: string[];
} {
  const requested = new Set<string>();
  for (const { object } of entries) {
    for (const language of LANGUAGES) {
      for (const char of Array.from(object.text[language] ?? '')) {
        if (!/\s/.test(char)) requested.add(char);
      }
    }
  }
  for (const field of ECROS_5300_DYNAMIC_FIELDS) {
    for (const language of LANGUAGES) {
      for (const char of Array.from(field.label[language])) {
        if (!/\s/.test(char)) requested.add(char);
      }
    }
  }

  const exported: Array<{ char: string; codePoint: number; variant: string; glyph: Glyph }> = [];
  const missing: string[] = [];
  for (const char of [...requested].sort()) {
    let found = false;
    for (const variant of ['1', '2'] as const) {
      const glyph = fontGlyphs[variant]?.[char];
      if (glyph) {
        exported.push({ char, codePoint: char.codePointAt(0) ?? 0, variant, glyph });
        found = true;
      }
    }
    if (!found) missing.push(char);
  }

  const arrays: string[] = [];
  const table: string[] = [];
  exported.forEach((item, index) => {
    const symbol = `lcd_glyph_${item.codePoint.toString(16).toUpperCase()}_v${item.variant}_${index}`;
    const packed = packGlyphRows(item.glyph);
    arrays.push(`static const uint8_t ${symbol}[${packed.length}] = { ${packed.map(hexByte).join(', ')} };`);
    table.push(`  { 0x${item.codePoint.toString(16).toUpperCase()}, ${item.glyph.width}, ${item.glyph.data.length}, ${Math.ceil(item.glyph.width / 8)}, ${symbol} }`);
  });
  const cHeader = [
    '#ifndef LCD_USED_GLYPHS_H',
    '#define LCD_USED_GLYPHS_H',
    '#include <stdint.h>',
    '#include <stddef.h>',
    '',
    'typedef struct { uint32_t codepoint; uint8_t width; uint8_t height; uint8_t row_bytes; const uint8_t *data; } lcd_glyph_t;',
    '',
    ...arrays,
    '',
    `static const lcd_glyph_t lcd_used_glyphs[${exported.length}] = {`,
    table.join(',\n'),
    '};',
    `#define LCD_USED_GLYPH_COUNT ${exported.length}`,
    '',
    '#endif /* LCD_USED_GLYPHS_H */'
  ].join('\n');

  return {
    payload: {
      schemaVersion: 1,
      packing: 'horizontal-msb, rows top-to-bottom',
      glyphs: exported,
      missingCharacters: missing
    },
    cHeader,
    requestedCharacters: requested.size,
    exportedGlyphs: exported.length,
    missingCharacters: missing
  };
}

function packGlyphRows(glyph: Glyph): number[] {
  const rowBytes = Math.ceil(glyph.width / 8);
  return glyph.data.flatMap((row) => {
    const result = Array.from({ length: rowBytes }, () => 0);
    for (let x = 0; x < glyph.width; x += 1) {
      if (row[x] === '#') {
        result[Math.floor(x / 8)] |= 1 << (7 - (x % 8));
      }
    }
    return result;
  });
}

async function createPreviewPng(
  verticalLsbBytes: readonly number[],
  width: number,
  height: number
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') {
    return null;
  }
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#d8e7c4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#14210f';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = verticalLsbBytes[Math.floor(y / 8) * width + x] ?? 0;
      if ((byte & (1 << (y % 8))) !== 0) {
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

function generateChineseReadme(project: LcdBitmapProject, missingCharacters: readonly string[]): string {
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>LCD HMI 交付包</title>
<style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;padding:0 24px}code{background:#eee;padding:2px 5px}</style>
<h1>${escapeHtml(project.meta.name)} — LCD HMI 交付包</h1>
<p>显示器：${project.display.width}×${project.display.height}，单色 1bpp，打包方式 <code>${project.display.packing}</code>。</p>
<ul>
<li><code>firmware/</code>：C/H、BIN、Arduino PROGMEM、Rust、XBM。</li>
<li><code>handoff/</code>：屏幕映射、动态字段、公式、CLI 契约和三语文本。</li>
<li><code>previews/</code>：俄语、英语和中文屏幕 PNG 预览。</li>
<li><code>manifest.json</code>：文件大小、SHA-256 和生成假设。</li>
</ul>
<p>ADC 计算使用单光束公式，并在 <code>hmi_formulas.c</code> 中检查非有限结果。</p>
<p>缺失字形：${missingCharacters.length ? escapeHtml(missingCharacters.join(' ')) : '无'}</p>
</html>`;
}

function generateEnglishReadme(project: LcdBitmapProject, missingCharacters: readonly string[]): string {
  return `# ${project.meta.name} — LCD HMI handoff

- Display: ${project.display.width}x${project.display.height}, monochrome 1bpp.
- Native packing: ${project.display.packing}.
- Languages: Russian, English, Simplified Chinese.
- Firmware variants: legacy C header/BIN, Arduino PROGMEM, Rust, XBM.
- Dynamic text, formulas, screen mapping, CLI contracts and checksums are under \`handoff/\`.
- Missing glyphs: ${missingCharacters.length ? missingCharacters.join(' ') : 'none'}.

The default concentration formula assumes \`A = m*C + k\`; confirm this convention before firmware release.
`;
}

function bytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? strToU8(content) : content;
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function cSymbol(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

function safePath(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'lcd-project';
}

function hexByte(value: number): string {
  return `0x${value.toString(16).padStart(2, '0').toUpperCase()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

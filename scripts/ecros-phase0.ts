/**
 * ECROS-5400UV Phase 0 — Baseline analysis, backup, ID mapping, and atomic migration.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/ecros-phase0.ts [--dry-run]
 *
 * Flags:
 *   --dry-run   Produce reports and mapping without writing the migrated lcdproj.
 */

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ECROS_DIR = resolve(ROOT, 'ECROS-5400UV');
const TARGET = resolve(ECROS_DIR, 'ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj');
const REPORTS_DIR = resolve(ECROS_DIR, 'reports');
const BACKUPS_DIR = resolve(ECROS_DIR, 'backups');
const DRY_RUN = process.argv.includes('--dry-run');

const SVG_FILES = [
  '01_Full_diagram.svg',
  '02_Photometry.svg',
  '03_Quantitative_analysis.svg',
  '04_Multiwavelength_mode.svg',
  '05_Kinetics.svg',
  '06_Settings_and_files.svg',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SvgNode {
  svgId: string;
  labels: string[];
  cluster: string;
  file: string;
}

interface FsmStateRaw {
  id: string;
  runtimeId: string | null;
  legacyIds: string[];
  title: string;
  subsystem: string;
  stateType: string;
  origin: string;
  screenId: string;
  initial: boolean;
  terminal: boolean;
}

interface IdMapping {
  oldStateId: string;
  newStateId: string;
  screenIdOld: string;
  screenIdNew: string;
  title: string;
  svgNodeId: string | null;
  subsystem: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  requiresUserDecision?: boolean;
  conflictNote?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseSvgNodes(svgContent: string, filename: string): SvgNode[] {
  const nodes: SvgNode[] = [];
  // Extract cluster titles for subsystem info
  const clusterLabels: string[] = [];
  const clusterRe = /<g[^>]*class="cluster"[^>]*>[\s\S]*?<title>([\s\S]*?)<\/title>/g;
  let cm: RegExpExecArray | null;
  while ((cm = clusterRe.exec(svgContent)) !== null) {
    clusterLabels.push(cm[1].trim());
  }

  // Extract node blocks — comment-delimited: <!-- NODE_ID --> then <g ... class="node">
  const nodeRe = /<!-- ([\w\d_]+) -->\s*\n<g[^>]*class="node"[^>]*>([\s\S]*?)<\/g>/g;
  let nm: RegExpExecArray | null;
  while ((nm = nodeRe.exec(svgContent)) !== null) {
    const svgId = nm[1];
    if (svgId.includes('->')) continue;
    const block = nm[2];
    const textRe = /<text[^>]*>([\s\S]*?)<\/text>/g;
    const labels: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = textRe.exec(block)) !== null) {
      const t = tm[1]
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (t) labels.push(t);
    }
    nodes.push({ svgId, labels, cluster: clusterLabels[0] ?? '', file: filename });
  }

  // Fallback: title-element approach
  if (nodes.length === 0) {
    const re2 = /<title>([\w\d_]+)<\/title>([\s\S]*?)(?=<title>|$)/g;
    while ((nm = re2.exec(svgContent)) !== null) {
      const svgId = nm[1];
      if (svgId.includes('->') || svgId === 'G') continue;
      const block = nm[2];
      const textRe = /<text[^>]*>([\s\S]*?)<\/text>/g;
      const labels: string[] = [];
      let tm: RegExpExecArray | null;
      while ((tm = textRe.exec(block)) !== null) {
        const t = tm[1].replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10))).trim();
        if (t) labels.push(t);
      }
      nodes.push({ svgId, labels, cluster: '', file: filename });
    }
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Title → UPPER_SNAKE_CASE ID derivation
// Strategy: use ALL title words, preserve mode letters (A/E/T), avoid generic collapses
// ─────────────────────────────────────────────────────────────────────────────

// Phrase-level replacements (applied first, in order, case-insensitive)
const PHRASE_MAP: [RegExp, string][] = [
  [/main[\s_-]*menu/gi, 'MAINMNU'],
  [/main[\s_-]*before[\s_-]*zero/gi, 'MAIN_PREZERO'],
  [/before[\s_-]*zero/gi, 'PREZERO'],
  [/dark[\s_-]*current/gi, 'DARKCURR'],
  [/dark[\s_-]*signal/gi, 'DARKSIG'],
  [/select[\s_-]*photometry/gi, 'SEL_PHOT'],
  [/select[\s_-]*quantitative/gi, 'SEL_QUANT'],
  [/select[\s_-]*multiwavelength/gi, 'SEL_MW'],
  [/select[\s_-]*kinetics/gi, 'SEL_KIN'],
  [/select[\s_-]*setup/gi, 'SEL_SET'],
  [/select[\s_-]*settings/gi, 'SEL_SET'],
  [/storage[\s_-]*location/gi, 'STOR_LOC'],
  [/save[\s_-]*results?/gi, 'SAVE_RES'],
  [/save[\s_-]*to[\s_-]*usb/gi, 'SAVE_USB'],
  [/naming[\s_-]*file/gi, 'NAME_FILE'],
  [/new[\s_-]*standard/gi, 'NEW_STD'],
  [/new[\s_-]*curve/gi, 'NEW_CRV'],
  [/new[\s_-]*method/gi, 'NEW_MTD'],
  [/wavelength[\s_-]*input/gi, 'WL_IN'],
  [/wavelength[\s_-]*done/gi, 'WL_DONE'],
  [/parameter[\s_-]*mode/gi, 'PAR_MODE'],
  [/n[\s_-]*\d+[\s_-]*measurement/gi, (m) => {
    const num = m.match(/\d+/)?.[0] ?? 'N';
    return `MEAS_N${num}`;
  }],
  [/measurement[\s_-]*not[\s_-]*fixed/gi, 'MEAS_UNFIXED'],
  [/measurement[\s_-]*fixed/gi, 'MEAS_FIXED'],
  [/measurement[\s_-]*selected/gi, 'MEAS_SEL'],
  [/delete[\s_-]*all/gi, 'DEL_ALL'],
  [/print[\s_-]*yes/gi, 'PRNT_YES'],
  [/print[\s_-]*no/gi, 'PRNT_NO'],
  [/usb[\s_-]*not[\s_-]*detected/gi, 'USB_NO_DET'],
  [/usb[\s_-]*storage/gi, 'USB_STOR'],
  [/not[\s_-]*detected/gi, 'NO_DET'],
  [/not[\s_-]*connected/gi, 'DISC'],
  [/not[\s_-]*fixed/gi, 'UNFIXED'],
  [/group[\s_-]*select/gi, 'GRP_SEL'],
  [/mn[\s_-]*select/gi, 'MN_SEL'],
  [/mn[\s_-]*renaming/gi, 'MN_REN'],
  [/mn[\s_-]*import/gi, 'MN_IMP'],
  [/calc[\s_-]*graphic/gi, 'CALC_GRAPH'],
  [/calc[\s_-]*coeff/gi, 'CALC_COEF'],
  [/type[\s_-]*regression/gi, 'TYPE_REG'],
  [/modes[\s_-]*linear/gi, 'MODE_LIN'],
  [/coefficients[\s_-]*new/gi, 'COEF_NEW'],
  [/submode[\s_-]*curves/gi, 'SMODE_CRV'],
  [/submode[\s_-]*coefficients/gi, 'SMODE_COEF'],
  [/parall(?:el)?[\s_-]*measurements?/gi, 'PARLL_MEAS'],
  [/inputed|inputing/gi, 'IN'],
  [/connected/gi, 'CONN'],
  [/disconnected/gi, 'DISC'],
];

// Word-level abbreviations (applied after phrase map)
const WORD_MAP: [RegExp, string][] = [
  [/^Diagnostic[s]?$/i, 'DIAG'],
  [/^Photometry$/i, 'PHOT'],
  [/^Quantitative$/i, 'QUANT'],
  [/^Kinetics?$/i, 'KIN'],
  [/^Multiwavelength$/i, 'MW'],
  [/^Multiwave$/i, 'MW'],
  [/^Settings?$/i, 'SET'],
  [/^Configuration$/i, 'CFG'],
  [/^Files?$/i, 'FILE'],
  [/^Printer$/i, 'PRNT'],
  [/^Printing$/i, 'PRNT'],
  [/^Warmup$/i, 'WARM'],
  [/^Warming$/i, 'WARM'],
  [/^System$/i, 'SYS'],
  [/^Menu$/i, 'MNU'],
  [/^Main$/i, 'MAIN'],
  [/^Signal$/i, 'SIG'],
  [/^Process$/i, 'PROC'],
  [/^proccess$/i, 'PROC'],   // typo in source
  [/^Processing$/i, 'PROC'],
  [/^Success$/i, 'OK'],
  [/^Fail(?:ure)?$/i, 'FAIL'],
  [/^Error$/i, 'ERR'],
  [/^Filter$/i, 'FILTER'],
  [/^Lamps?$/i, 'LAMP'],
  [/^Detector$/i, 'DET'],
  [/^Dark$/i, 'DARK'],
  [/^Zeroing$/i, 'ZERO'],
  [/^Zero$/i, 'ZERO'],
  [/^Measure(?:ment)?s?$/i, 'MEAS'],
  [/^Parameter[s]?$/i, 'PAR'],
  [/^Submode$/i, 'SMODE'],
  [/^Curves?$/i, 'CRV'],
  [/^Coefficients?$/i, 'COEF'],
  [/^Calibration$/i, 'CAL'],
  [/^Wavelength$/i, 'WL'],
  [/^Input(?:ing|ed)?$/i, 'IN'],
  [/^Select(?:ing|ed|ion)?$/i, 'SEL'],
  [/^Standard$/i, 'STD'],
  [/^Graphic$/i, 'GRAPH'],
  [/^Dilution$/i, 'DIL'],
  [/^Save$/i, 'SAVE'],
  [/^Storage$/i, 'STOR'],
  [/^Naming$/i, 'NAME'],
  [/^Print$/i, 'PRNT'],
  [/^Result[s]?$/i, 'RES'],
  [/^Report[s]?$/i, 'RPT'],
  [/^Export$/i, 'EXP'],
  [/^Import$/i, 'IMP'],
  [/^Delete$/i, 'DEL'],
  [/^Rename$/i, 'REN'],
  [/^Renaming$/i, 'REN'],
  [/^USB$/i, 'USB'],
  [/^PC$/i, 'PC'],
  [/^Connect(?:ed)?$/i, 'CONN'],
  [/^Disconnect(?:ed)?$/i, 'DISC'],
  [/^Detect(?:ed|ion)?$/i, 'DET'],
  [/^Mode[s]?$/i, 'MODE'],
  [/^Before$/i, 'PRE'],
  [/^After$/i, 'POST'],
  [/^New$/i, 'NEW'],
  [/^Group$/i, 'GRP'],
  [/^Regression$/i, 'REG'],
  [/^Linear$/i, 'LIN'],
  [/^Not$/i, 'NO'],
  [/^Fixed$/i, 'FXD'],
  [/^Selected$/i, 'SEL'],
  [/^Location$/i, 'LOC'],
  [/^Parallel$/i, 'PARLL'],
  [/^Gain$/i, 'GAIN'],
  [/^Switch$/i, 'SW'],
  [/^Lamp$/i, 'LAMP'],
  [/^W$/, 'W'],
  [/^D2$/, 'D2'],
  [/^A$/, 'A'],
  [/^E$/, 'E'],
  [/^T$/, 'T'],
  [/^Number$/, 'N'],
  [/^Parallel$/, 'PARLL'],
  [/^and$/, ''],
  [/^the$/, ''],
  [/^of$/, ''],
  [/^to$/, ''],
  [/^in$/, ''],
  [/^for$/, ''],
  [/^with$/, ''],
  [/^from$/, ''],
  [/^yes$/, 'YES'],
  [/^no$/, 'NO'],
  [/^ok$/, 'OK'],
];

function deriveIdFromTitle(title: string, subsystem: string, stateType: string): string {
  // Strip leading numeric prefix like "1-1-2 " or "3-3-1 "
  const withoutNum = title.replace(/^[\d]+([\-\.][\d]+)* /, '');

  // Apply phrase-level map first
  let result = withoutNum;
  for (const [re, rep] of PHRASE_MAP) {
    if (typeof rep === 'string') {
      result = result.replace(re, rep);
    } else {
      result = result.replace(re, rep as (m: string) => string);
    }
  }

  // Split into tokens: by spaces, hyphens, underscores, dots, parens, commas
  // Keep single uppercase letters (A, E, T, W, D2) as mode indicators
  const rawTokens = result.split(/[\s\-_.,()\/\\]+/);

  const parts: string[] = [];
  for (const tok of rawTokens) {
    if (!tok) continue;
    // Already-replaced phrase tokens (contain underscores) → split and keep
    if (tok.includes('_')) {
      for (const p of tok.split('_')) {
        if (p) parts.push(p.toUpperCase());
      }
      continue;
    }
    // Apply word map
    let found = false;
    for (const [re, abbr] of WORD_MAP) {
      if (re.test(tok)) {
        if (abbr) parts.push(abbr);
        found = true;
        break;
      }
    }
    if (!found) {
      const upper = tok.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (upper && upper !== 'COPY') parts.push(upper);
    }
  }

  // Deduplicate consecutive identical parts
  const deduped: string[] = [];
  for (const p of parts) {
    if (p && deduped[deduped.length - 1] !== p) deduped.push(p);
  }

  if (deduped.length === 0) return subsystem.toUpperCase() + '_' + stateType.toUpperCase();

  const joined = deduped.join('_');
  // Hard limit: if > 60 chars, take first 4 + last 2 meaningful tokens
  if (joined.length <= 60) return joined;
  const head = deduped.slice(0, 4);
  const tail = deduped.length > 6 ? deduped.slice(-2) : [];
  return [...head, ...tail].join('_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Known manual mappings for the 9 original proper states
// (These have origin=official-pdf or derived-normalization and stable existing IDs)
// ─────────────────────────────────────────────────────────────────────────────

const MANUAL_MAP: Record<string, { newId: string; svgNodeId: string | null; confidence: 'high' | 'medium' }> = {
  'SYS-DIAGNOSTIC':             { newId: 'DIAG_FILTER_PROC',    svgNodeId: 'DIAG_FILTER',  confidence: 'high' },
  'PHOT-MAIN-A':                { newId: 'PHOT_A_MAIN_PREZERO', svgNodeId: 'P_MAIN',       confidence: 'high' },
  'PHOT-SIGNAL':                { newId: 'QUANT_CRV_MAIN',      svgNodeId: 'Q_MENU',       confidence: 'medium' },
  'SET-MAIN':                   { newId: 'SET_DARK_MAIN',        svgNodeId: 'S_MENU',       confidence: 'high' },
  'SHARED-PRINTER-CONNECTED':   { newId: 'SHARED_PRNT_CONN',    svgNodeId: null,           confidence: 'high' },
  'SHARED-PRINTER-DISCONNECTED':{ newId: 'SHARED_PRNT_DISC',    svgNodeId: null,           confidence: 'high' },
  'SHARED-PC-CONNECTED':        { newId: 'SHARED_PC_CONN',      svgNodeId: null,           confidence: 'high' },
  'SHARED-USB-NOT-DETECTED':    { newId: 'SHARED_USB_NO_DET',   svgNodeId: null,           confidence: 'high' },
  'SHARED-PRINTER-NOT-DETECTED':{ newId: 'SHARED_PRNT_NO_DET', svgNodeId: null,           confidence: 'high' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Build mapping
// ─────────────────────────────────────────────────────────────────────────────

function buildMapping(states: FsmStateRaw[], _svgNodes: SvgNode[]): IdMapping[] {
  const mappings: IdMapping[] = [];
  const usedNewIds = new Map<string, string>(); // newId → first oldId that claimed it

  for (const state of states) {
    const oldId = state.id;
    const title = state.title;
    const evidence: string[] = [`origin:${state.origin}`];
    let svgNodeId: string | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let requiresUserDecision = false;
    let conflictNote: string | undefined;
    let newId: string;

    // 1. Check manual map
    if (MANUAL_MAP[oldId]) {
      const m = MANUAL_MAP[oldId];
      newId = m.newId;
      svgNodeId = m.svgNodeId;
      confidence = m.confidence;
      evidence.push(`manual-mapping`);
    } else {
      // 2. Derive from title
      newId = deriveIdFromTitle(title, state.subsystem, state.stateType);
      confidence = 'low';
      evidence.push('title-derived');
    }

    // 3. Collision detection
    if (usedNewIds.has(newId)) {
      const firstOwner = usedNewIds.get(newId)!;
      // Disambiguation strategy 1: append stateType suffix
      const typeSuffix = state.stateType === 'success' ? '_OK'
        : state.stateType === 'failure' ? '_FAIL'
        : state.stateType === 'initial' ? '_INIT'
        : '';
      const withType = typeSuffix ? newId + typeSuffix : '';
      if (withType && !usedNewIds.has(withType)) {
        newId = withType;
        evidence.push(`collision-resolved-by-type-suffix`);
      } else {
        // Disambiguation strategy 2: use title number prefix as suffix (deterministic)
        // e.g. "4-1-1-4-3-1 ..." → use last 3 numeric segments → N431
        const numParts = (title.match(/^([\d]+([\-\.][\d]+)*)/) ?? [''])[0].split(/[\-\.]/);
        const numSuffix = numParts.length >= 2
          ? 'N' + numParts.slice(-Math.min(3, numParts.length)).join('')
          : '';
        const withNum = numSuffix ? `${newId}_${numSuffix}` : '';
        if (withNum && !usedNewIds.has(withNum)) {
          newId = withNum;
          evidence.push(`collision-resolved-by-num-prefix-suffix:${numSuffix}`);
        } else {
          // Last resort: numeric suffix (marks as ambiguous)
          let suffix = 2;
          const base = newId;
          while (usedNewIds.has(`${base}_${suffix}`)) suffix++;
          const originalNewId = newId;
          newId = `${base}_${suffix}`;
          requiresUserDecision = true;
          conflictNote = `ID collision: "${originalNewId}" already claimed by "${firstOwner}". Auto-suffixed to "${newId}". Both num-prefix and type-suffix strategies exhausted.`;
          confidence = 'low';
          evidence.push(`collision-numeric-suffix-from:${originalNewId}`);
        }
      }
    }

    usedNewIds.set(newId, oldId);

    mappings.push({
      oldStateId: oldId,
      newStateId: newId,
      screenIdOld: state.screenId,
      screenIdNew: state.screenId === oldId ? newId : state.screenId,
      title,
      svgNodeId,
      subsystem: state.subsystem,
      confidence,
      evidence,
      ...(requiresUserDecision ? { requiresUserDecision, conflictNote } : {}),
    });
  }

  return mappings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic migration — replace all ID references throughout the JSON tree
// ─────────────────────────────────────────────────────────────────────────────

function migrateProject(raw: unknown, mapping: IdMapping[]): unknown {
  const idMap = new Map<string, string>();
  for (const m of mapping) {
    if (!m.requiresUserDecision && m.oldStateId !== m.newStateId) {
      idMap.set(m.oldStateId, m.newStateId);
    }
    if (!m.requiresUserDecision && m.screenIdOld !== m.screenIdNew) {
      idMap.set(m.screenIdOld, m.screenIdNew);
    }
  }

  function walk(value: unknown): unknown {
    if (typeof value === 'string') return idMap.get(value) ?? value;
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        const newKey = idMap.get(k) ?? k;
        result[newKey] = walk(v);
      }
      return result;
    }
    return value;
  }

  const migrated = walk(raw) as Record<string, unknown>;

  // Inject legacyIds for renamed states
  const project = migrated['project'] as Record<string, unknown>;
  const fsm = project?.['fsm'] as Record<string, unknown>;
  const states = fsm?.['states'] as Record<string, Record<string, unknown>>;
  if (states) {
    for (const m of mapping) {
      if (!m.requiresUserDecision && m.oldStateId !== m.newStateId) {
        const ns = states[m.newStateId];
        if (ns) {
          const existing = (ns['legacyIds'] as string[]) ?? [];
          if (!existing.includes(m.oldStateId)) ns['legacyIds'] = [m.oldStateId, ...existing];
        }
      }
    }
  }
  // Inject legacyScreenId for renamed screens
  const screens = project?.['screens'] as Record<string, Record<string, unknown>>;
  if (screens) {
    for (const m of mapping) {
      if (!m.requiresUserDecision && m.screenIdOld !== m.screenIdNew) {
        const ns = screens[m.screenIdNew];
        if (ns && !ns['legacyScreenId']) ns['legacyScreenId'] = m.screenIdOld;
      }
    }
  }

  return migrated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report generators
// ─────────────────────────────────────────────────────────────────────────────

function generateMappingMd(mappings: IdMapping[]): string {
  const auto = mappings.filter(m => !m.requiresUserDecision);
  const ambiguous = mappings.filter(m => m.requiresUserDecision);
  const byConf = { high: 0, medium: 0, low: 0 };
  for (const m of auto) byConf[m.confidence]++;

  const rows = auto.map(m => {
    const o = m.oldStateId.length > 45 ? m.oldStateId.slice(0, 42) + '...' : m.oldStateId;
    const n = m.newStateId;
    const t = m.title.length > 40 ? m.title.slice(0, 37) + '...' : m.title;
    return `| \`${o}\` | \`${n}\` | ${t} | ${m.svgNodeId ?? '—'} | ${m.confidence} |`;
  });

  return [
    '# ECROS-5400UV — ID Mapping (before migration)',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `| Auto-renames | ${auto.length} | Ambiguous | ${ambiguous.length} | High | ${byConf.high} | Medium | ${byConf.medium} | Low | ${byConf.low} |`,
    '',
    '## Auto-renames',
    '| Old ID | New ID | Title | SVG Node | Confidence |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    ...(ambiguous.length > 0 ? [
      '## Ambiguous (User Decision Required)',
      ...ambiguous.flatMap(m => [
        `### ${m.oldStateId}`,
        `- Title: ${m.title}`,
        `- Proposed: \`${m.newStateId}\``,
        `- Conflict: ${m.conflictNote ?? ''}`,
        `- Evidence: ${m.evidence.join(', ')}`,
        '',
      ]),
    ] : []),
  ].join('\n');
}

function generateBaselineDiff(
  states: FsmStateRaw[],
  svgNodes: SvgNode[],
  mapping: IdMapping[],
  projectData: Record<string, unknown>
): { md: string; json: unknown } {
  const project = projectData['project'] as Record<string, unknown>;
  const fsm = project?.['fsm'] as Record<string, unknown>;
  const transitions = fsm?.['transitions'] as Record<string, unknown> ?? {};
  const transitionOrder = (fsm?.['transitionOrder'] as string[]) ?? [];
  const events = fsm?.['events'] as Record<string, unknown> ?? {};
  const tags = project?.['tags'] as Record<string, unknown> ?? {};
  const procedures = project?.['procedures'] as Record<string, unknown> ?? {};
  const alarms = project?.['alarms'] as Record<string, unknown> ?? {};
  const screens = project?.['screens'] as Record<string, unknown> ?? {};
  const controlPanel = project?.['controlPanel'] as Record<string, unknown> ?? {};
  const elements = (controlPanel['elements'] as Record<string, unknown>) ?? {};
  const cliCatalog = project?.['cliCatalog'] as Record<string, unknown> ?? {};
  const layersObj = (fsm?.['layers'] as Record<string, unknown>) ?? {};
  const visibilityPresets = (fsm?.['visibilityPresets'] as Record<string, unknown>) ?? {};

  const auto = mapping.filter(m => !m.requiresUserDecision);
  const ambig = mapping.filter(m => m.requiresUserDecision);
  const subsystems = new Set(states.map(s => s.subsystem)).size;
  const properStates = states.filter(s => MANUAL_MAP[s.id] !== undefined);

  const json = {
    generatedAt: new Date().toISOString(),
    lcdproj: {
      screens: Object.keys(screens).length,
      fsmStates: states.length,
      transitions: Object.keys(transitions).length,
      transitionOrder: transitionOrder.length,
      events: Object.keys(events).length,
      panelElements: Object.keys(elements).length,
      tags: Object.keys(tags).length,
      procedures: Object.keys(procedures).length,
      cliCommands: Object.keys(cliCatalog).length,
      alarms: Object.keys(alarms).length,
      layers: Object.keys(layersObj).length,
      visibilityPresets: Object.keys(visibilityPresets).length,
      subsystems,
    },
    svg: {
      totalNodes: svgNodes.length,
      byFile: SVG_FILES.reduce((acc, f) => { acc[f] = svgNodes.filter(n => n.file === f).length; return acc; }, {} as Record<string, number>),
    },
    idMigration: {
      total: states.length,
      properOriginalStates: properStates.length,
      copyGeneratedStates: states.length - properStates.length,
      autoRenames: auto.length,
      ambiguous: ambig.length,
      highConfidence: auto.filter(m => m.confidence === 'high').length,
      mediumConfidence: auto.filter(m => m.confidence === 'medium').length,
      lowConfidence: auto.filter(m => m.confidence === 'low').length,
    },
  };

  const md = [
    '# ECROS-5400UV — Baseline Diff',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Entity Counts',
    '| Entity | Count |', '|---|---|',
    `| Screens | ${json.lcdproj.screens} |`,
    `| FSM States | ${json.lcdproj.fsmStates} |`,
    `| Transitions | ${json.lcdproj.transitions} |`,
    `| transitionOrder entries | ${json.lcdproj.transitionOrder} |`,
    `| HMI Events | ${json.lcdproj.events} |`,
    `| Panel Elements | ${json.lcdproj.panelElements} |`,
    `| Tags | ${json.lcdproj.tags} |`,
    `| Procedures | ${json.lcdproj.procedures} |`,
    `| CLI Commands | ${json.lcdproj.cliCommands} |`,
    `| Alarms | ${json.lcdproj.alarms} |`,
    `| Layers (objects) | ${json.lcdproj.layers} |`,
    `| Visibility Presets | ${json.lcdproj.visibilityPresets} |`,
    `| Subsystems (string) | ${json.lcdproj.subsystems} |`,
    '',
    '## SVG Authoritative Source',
    '| File | Nodes |', '|---|---|',
    ...SVG_FILES.map(f => `| ${f} | ${json.svg.byFile[f]} |`),
    `| **Total** | **${json.svg.totalNodes}** |`,
    '',
    '## ID Migration',
    '| Metric | Count |', '|---|---|',
    `| Auto-renames | ${json.idMigration.autoRenames} |`,
    `| Ambiguous (skipped) | ${json.idMigration.ambiguous} |`,
    `| High confidence | ${json.idMigration.highConfidence} |`,
    `| Medium confidence | ${json.idMigration.mediumConfidence} |`,
    `| Low confidence | ${json.idMigration.lowConfidence} |`,
  ].join('\n');

  return { md, json };
}

function generateAmbiguousDecisions(mappings: IdMapping[]): string {
  const ambiguous = mappings.filter(m => m.requiresUserDecision);
  if (ambiguous.length === 0) return '# Ambiguous Decisions\n\nNone. All states mapped unambiguously.\n';

  return [
    '# Ambiguous Decisions — ECROS-5400UV Phase 0',
    `Generated: ${new Date().toISOString()}`,
    `${ambiguous.length} state(s) could not be automatically renamed. Each requires user confirmation.`,
    '',
    ...ambiguous.flatMap((m, i) => [
      `## Decision ${i + 1}: \`${m.oldStateId}\``,
      `- **Title:** ${m.title}`,
      `- **Subsystem:** ${m.subsystem}`,
      `- **Proposed new ID:** \`${m.newStateId}\` *(auto-suffixed)*`,
      `- **Conflict:** ${m.conflictNote ?? ''}`,
      `- **Evidence:** ${m.evidence.join(', ')}`,
      `**Action required:** Confirm \`${m.newStateId}\` or provide preferred ID.`,
      '',
      '---', '',
    ]),
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('ECROS-5400UV Phase 0 — Analysis & Migration');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  await mkdir(REPORTS_DIR, { recursive: true });
  await mkdir(BACKUPS_DIR, { recursive: true });
  console.log('✓ Directories ready');

  // Read project
  if (!existsSync(TARGET)) throw new Error(`Target not found: ${TARGET}`);
  const rawContent = await readFile(TARGET, 'utf8');
  const rawData = JSON.parse(rawContent) as Record<string, unknown>;
  const sha256 = createHash('sha256').update(rawContent).digest('hex');
  const project = rawData['project'] as Record<string, unknown>;
  const fsm = project['fsm'] as Record<string, unknown>;
  const fsmStates = fsm['states'] as Record<string, FsmStateRaw>;
  const states = Object.values(fsmStates);
  console.log(`✓ Loaded lcdproj: ${states.length} states, ${(rawContent.length / 1024 / 1024).toFixed(2)} MB`);

  // Read SVGs
  const allSvgNodes: SvgNode[] = [];
  for (const f of SVG_FILES) {
    const p = resolve(ECROS_DIR, f);
    if (!existsSync(p)) { console.warn(`  ⚠ Missing: ${f}`); continue; }
    const c = await readFile(p, 'utf8');
    const nodes = parseSvgNodes(c, f);
    allSvgNodes.push(...nodes);
    console.log(`  ✓ ${f}: ${nodes.length} nodes`);
  }

  // Build mapping
  const mapping = buildMapping(states, allSvgNodes);
  const auto = mapping.filter(m => !m.requiresUserDecision);
  const ambig = mapping.filter(m => m.requiresUserDecision);
  console.log(`\n✓ Mapping: ${auto.length} auto / ${ambig.length} ambiguous`);

  // Subsystem breakdown
  const bySub = new Map<string, number>();
  for (const m of mapping) bySub.set(m.subsystem, (bySub.get(m.subsystem) ?? 0) + 1);
  for (const [s, n] of [...bySub.entries()].sort()) console.log(`  ${s}: ${n}`);

  // Write reports
  await writeFile(resolve(REPORTS_DIR, 'id-mapping.before.json'), JSON.stringify(mapping, null, 2), 'utf8');
  await writeFile(resolve(REPORTS_DIR, 'id-mapping.before.md'), generateMappingMd(mapping), 'utf8');
  const { md: diffMd, json: diffJson } = generateBaselineDiff(states, allSvgNodes, mapping, rawData);
  await writeFile(resolve(REPORTS_DIR, 'baseline-diff.json'), JSON.stringify(diffJson, null, 2), 'utf8');
  await writeFile(resolve(REPORTS_DIR, 'baseline-diff.md'), diffMd, 'utf8');
  await writeFile(resolve(REPORTS_DIR, 'ambiguous-decisions.md'), generateAmbiguousDecisions(mapping), 'utf8');
  console.log('\n✓ Reports written');

  // Print sample of ID renames
  console.log('\nSample renames:');
  for (const m of mapping.slice(0, 15)) {
    const status = m.requiresUserDecision ? '⚠ AMBIG' : '✓';
    const old = m.oldStateId.length > 35 ? m.oldStateId.slice(0, 32) + '...' : m.oldStateId;
    console.log(`  ${status} ${old.padEnd(35)} → ${m.newStateId}`);
  }

  if (DRY_RUN) {
    console.log('\n⚠ DRY RUN complete — no lcdproj changes made.');
    console.log(`Original SHA-256: ${sha256}`);
    console.log(`Auto-renames: ${auto.length} / Ambiguous: ${ambig.length}`);
    return;
  }

  // Backup
  const ts = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupName = `ECROS-5400UV_FSM_BACKUP_${ts}.lcdproj`;
  const backupPath = resolve(BACKUPS_DIR, backupName);
  await copyFile(TARGET, backupPath);
  const backupContent = await readFile(backupPath, 'utf8');
  if (backupContent.length === 0) throw new Error('Backup empty!');
  JSON.parse(backupContent); // throws if invalid
  const backupSha = createHash('sha256').update(backupContent).digest('hex');
  if (sha256 !== backupSha) throw new Error('Backup SHA-256 mismatch!');
  console.log(`\n✓ Backup: backups/${backupName}`);
  console.log(`  SHA-256: ${sha256}`);

  // Change log
  const changeLogPath = resolve(REPORTS_DIR, 'change-log.md');
  const changeLog = [
    '# ECROS-5400UV Change Log',
    '',
    `## Phase 0 — ID Migration (${new Date().toISOString()})`,
    '',
    `- Source: ${TARGET}`,
    `- Backup: ${backupPath}`,
    `- SHA-256 original: ${sha256}`,
    `- States auto-renamed: ${auto.length}`,
    `- Ambiguous (skipped): ${ambig.length}`,
    '',
    '### Files changed',
    '- ECROS-5400UV/ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj',
    '- ECROS-5400UV/reports/ (all report files)',
    `- ECROS-5400UV/backups/${backupName}`,
    '',
  ].join('\n');
  await writeFile(changeLogPath, changeLog, 'utf8');

  // Migrate
  console.log('\nRunning atomic migration...');
  const migrated = migrateProject(rawData, mapping);
  const migratedStr = JSON.stringify(migrated, null, 2) + '\n';
  const tempPath = `${TARGET}.migrating`;
  await writeFile(tempPath, migratedStr, 'utf8');

  // Verify
  const ver = JSON.parse(await readFile(tempPath, 'utf8')) as Record<string, unknown>;
  const vp = ver['project'] as Record<string, unknown>;
  const vf = vp?.['fsm'] as Record<string, unknown>;
  const vs = vf?.['states'] as Record<string, unknown>;
  const vscr = vp?.['screens'] as Record<string, unknown>;
  const vtr = vf?.['transitions'] as Record<string, unknown>;
  const origS = Object.keys(fsmStates).length;
  const origScr = Object.keys((project['screens'] as Record<string, unknown>) ?? {}).length;
  const origTr = Object.keys((fsm['transitions'] as Record<string, unknown>) ?? {}).length;
  if (Object.keys(vs ?? {}).length !== origS) throw new Error('State count changed!');
  if (Object.keys(vscr ?? {}).length !== origScr) throw new Error('Screen count changed!');
  if (Object.keys(vtr ?? {}).length !== origTr) throw new Error('Transition count changed!');
  // Verify auto-renamed new IDs exist
  let missing = 0;
  for (const m of auto) { if (m.oldStateId !== m.newStateId && !vs?.[m.newStateId]) missing++; }
  if (missing > 0) throw new Error(`${missing} new state IDs not found after migration`);
  console.log(`  ✓ States: ${origS}, Screens: ${origScr}, Transitions: ${origTr}`);
  console.log(`  ✓ All ${auto.length} renamed states verified`);

  // Commit
  await writeFile(TARGET, migratedStr, 'utf8');
  try { const { unlink } = await import('node:fs/promises'); await unlink(tempPath); } catch {}

  // Post-migration backup
  const postTs = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const postBkp = resolve(BACKUPS_DIR, `ECROS-5400UV_FSM_POST-MIGRATION_${postTs}.lcdproj`);
  await copyFile(TARGET, postBkp);
  const postSha = createHash('sha256').update(migratedStr).digest('hex');
  console.log(`✓ Migration committed`);
  console.log(`✓ Post-migration backup: ${postBkp}`);

  // Update change log
  await writeFile(changeLogPath, changeLog + [
    `## Post-migration validation (${new Date().toISOString()})`,
    `- SHA-256 migrated: ${postSha}`,
    `- States: ${Object.keys(vs ?? {}).length}`,
    `- Screens: ${Object.keys(vscr ?? {}).length}`,
    `- Transitions: ${Object.keys(vtr ?? {}).length}`,
    `- Post-migration backup: ${postBkp}`,
    '',
  ].join('\n'), 'utf8');

  console.log(`\n${'='.repeat(60)}`);
  console.log('PHASE 0 COMPLETE');
  console.log(`SHA-256 original:  ${sha256}`);
  console.log(`SHA-256 migrated:  ${postSha}`);
  console.log(`Auto-renamed:      ${auto.length}`);
  console.log(`Ambiguous skipped: ${ambig.length}`);
  if (ambig.length > 0) console.log(`\n⚠ See: ECROS-5400UV/reports/ambiguous-decisions.md`);
}

main().catch(err => { console.error('\nFATAL:', err.message ?? err); process.exit(1); });

/**
 * Builds a coherent ECROS-5400UV FSM revision from the supplied LCD-bitmap
 * mock-up.  The input file is never overwritten; the completed project is a
 * new importable .lcdproj file.
 *
 * Usage:
 *   npx tsx scripts/complete-ecros-5400uv.ts input.lcdproj output.lcdproj
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ELK from 'elkjs/lib/elk.bundled.js';
import { createProjectFileV5, migrateProject } from '../src/services/projectMigrationService';
import { rebuildProjectBindings, type FsmEvent, type FsmState, type FsmTransition, type LcdBitmapProject } from '../src/domain/project';
import { validateProject } from '../src/services/projectValidationService';
import type { HmiTag } from '../src/domain/tag';
import type { BackendProcedure, CliCommandDefinition } from '../src/domain/procedure';
import type { AlarmDefinition } from '../src/domain/alarm';

type ButtonEvent = [id: string, name: string, buttonId: string | null];
const BUTTON_EVENTS: ButtonEvent[] = [
  ['UI.PAR', 'ПАРАМЕТР', 'button-EVENT'], ['UI.PRN', 'ПЕЧАТЬ', 'button'], ['UI.CLR', 'ОЧИСТИТЬ', 'button-2'],
  ['UI.K1', '1', 'button-3'], ['UI.FILE', 'ФАЙЛ', 'button-4'], ['UI.K2', '2 ABC', 'button-5'],
  ['UI.K3', '3 DEF', 'button-6'], ['UI.K7', '7 PQRS', 'button-7'], ['UI.K4', '4 GHI', 'button-8'],
  ['UI.K5', '5 JKL', 'button-9'], ['UI.K9A', '9 WXYZ', 'button-10'], ['UI.K6', '6 MNO', 'button-11'],
  ['UI.K9B', '9 WXYZ', 'button-12'], ['UI.DOWN', '↓', 'button-13'], ['UI.UP', '↑', 'button-14'],
  ['UI.ZERO', 'НОЛЬ', 'button-15'], ['UI.MINUS', '-', 'button-16'], ['UI.DOT', '.', 'button-17'],
  ['UI.K0', '0', 'button-18'], ['UI.WL', 'λ', 'button-19'], ['UI.RUN', 'СТАРТ/СТОП', 'button-20'],
  ['UI.OK', 'ВВОД', 'button-21'], ['UI.ESC', 'Выход', 'button-22'], ['SYS.AUTO', 'Auto', null], ['SYS.ERR', 'Auto', null]
];
const eventFor = (name: string): string => ({ PAR: 'UI.PAR', PRN: 'UI.PRN', CLR: 'UI.CLR', K1: 'UI.K1', FILE: 'UI.FILE', K2: 'UI.K2', K3: 'UI.K3', K7: 'UI.K7', K4: 'UI.K4', K5: 'UI.K5', K9A: 'UI.K9A', K6: 'UI.K6', K9B: 'UI.K9B', DOWN: 'UI.DOWN', UP: 'UI.UP', ZERO: 'UI.ZERO', MINUS: 'UI.MINUS', DOT: 'UI.DOT', K0: 'UI.K0', WL: 'UI.WL', RUN: 'UI.RUN', OK: 'UI.OK', ESC: 'UI.ESC', A: 'SYS.AUTO', ERR: 'SYS.ERR' }[name] ?? 'UI.OK');
const buttonFor = (eventId: string): string | null => BUTTON_EVENTS.find((entry) => entry[0] === eventId)?.[2] ?? null;

async function completeProject(input: LcdBitmapProject): Promise<LcdBitmapProject> {
  const states: Record<string, FsmState> = {};
  for (const [id, original] of Object.entries(input.fsm.states)) {
    const subsystem = subsystemFor(id, original.title);
    const stateType = id === 'SYS-DIAGNOSTIC'
      ? 'initial'
      : isFailure(original.title) ? 'failure'
        : isSuccess(original.title) ? 'success' : 'process';
    states[id] = { ...original, subsystem, stateType, initial: id === 'SYS-DIAGNOSTIC', terminal: false };
  }

  const events: Record<string, FsmEvent> = Object.fromEntries(BUTTON_EVENTS.map(([id, name]) => [id, {
    id, name, description: name, scope: 'global', sourceStateId: null
  }]));
  let controlElements = Object.fromEntries(Object.entries(input.controlPanel.elements).map(([id, element]) => {
    if (element.type !== 'button') return [id, element];
    const event = BUTTON_EVENTS.find((entry) => entry[2] === id);
    return [id, { ...element, fsmEventId: event?.[0] }];
  }));

  const transitions: Record<string, FsmTransition> = {};
  const order: string[] = [];
  const add = (from: string, to: string, eventName = 'OK', opts: Partial<FsmTransition> = {}): void => {
    if (!states[from] || !states[to]) return;
    const base = `tr-${from}-${to}-${eventName.toLowerCase()}`.replace(/[^a-z0-9_-]/gi, '-').slice(0, 120);
    let id = base;
    let suffix = 2;
    while (transitions[id]) id = `${base}-${suffix++}`;
    const eventId = eventFor(eventName);
    transitions[id] = {
      id, from, to, kind: opts.kind ?? 'navigation', condition: opts.condition ?? null,
      source: opts.source ?? 'ecros-5400uv-reconstruction', backendProcessId: opts.backendProcessId ?? null,
      // The primary route reads from top to bottom.  Return and alarm branches
      // occupy their own side lanes so they do not cut through that route.
      sourceHandle: opts.sourceHandle ?? (eventName === 'ESC' ? 's-left' : eventName === 'ERR' ? 's-right' : eventName === 'UP' ? 's-top' : 's-bottom'),
      targetHandle: opts.targetHandle ?? (eventName === 'ESC' ? 't-right' : eventName === 'ERR' ? 't-left' : 't-top'),
      trigger: {
        eventId, mechanism: opts.trigger?.mechanism ?? (eventName === 'A' ? 'timer' : eventName === 'ERR' ? 'fact' : 'button'),
        buttonId: opts.trigger?.buttonId ?? buttonFor(eventId), timerMs: opts.trigger?.timerMs ?? (eventName === 'A' ? 500 : null),
        fact: opts.trigger?.fact ?? (eventName === 'ERR' ? 'device.error == true' : null)
      }
    };
    order.push(id);
  };
  const addChain = (ids: string[], eventName: string): void => {
    for (let index = 0; index + 1 < ids.length; index++) add(ids[index], ids[index + 1], eventName);
  };
  const setAutoDelay = (from: string | undefined, to: string | undefined, timerMs: number): void => {
    const transition = Object.values(transitions).find((candidate) => candidate.from === from && candidate.to === to && candidate.trigger.eventId === 'SYS.AUTO');
    if (transition) transition.trigger = { ...transition.trigger, mechanism: 'timer', timerMs };
  };

  const grouped = groupStateIds(states);
  const root = rootsFor(grouped);
  const mainRoot = root['main-menu'];

  // Deterministic self-test: a normal sequence progresses automatically.
  const diagnostic = orderedNormal(grouped.diagnostic ?? [], states, root.diagnostic);
  addChain(diagnostic, 'A');
  if (diagnostic.at(-1) && mainRoot && diagnostic.at(-1) !== mainRoot) add(diagnostic.at(-1), mainRoot, 'A');
  // The source mock-up contains two dedicated post-diagnostic screens.  Keep
  // both visible in sequence: successful dark-current test → warm-up →
  // waiting/ready → main menu.  The ECROS CLI has no “lamp warmed” response,
  // so 15 minutes is represented as an explicit, reviewable procedure delay.
  const diagnosticSuccess = findByTitle(states, '1-8-2 Diagnostic-dark_current-success');
  const warmup = findByTitle(states, '1-9-1 Diagnostic-warming');
  const waiting = findByTitle(states, '1-9-2 Waiting');
  setAutoDelay(diagnosticSuccess, warmup, 500);
  setAutoDelay(warmup, waiting, 900_000);
  setAutoDelay(waiting, mainRoot, 500);

  // The five visible main-menu selection screens form a compact UP/DOWN ring.
  const menu = orderedNormal(grouped['main-menu'] ?? [], states, mainRoot).slice(0, 5);
  for (let i = 0; i < menu.length; i++) {
    add(menu[i], menu[(i + 1) % menu.length], 'DOWN');
    add(menu[i], menu[(i - 1 + menu.length) % menu.length], 'UP');
  }
  const destinations: Array<[number, keyof typeof root]> = [[0, 'photometry'], [1, 'quantitative'], [2, 'multiwave'], [3, 'kinetics'], [4, 'settings']];
  for (const [index, subsystem] of destinations) if (menu[index] && root[subsystem]) add(menu[index], root[subsystem]!, 'OK');

  // Each measurement/configuration module is a left-to-right primary route.
  for (const subsystem of ['photometry', 'quantitative', 'kinetics', 'multiwave', 'settings', 'files'] as const) {
    const route = orderedNormal(grouped[subsystem] ?? [], states, root[subsystem]);
    addChain(route, 'OK');
    // Every operator step has an explicit reverse route.  This is intentionally
    // modelled as a separate transition: the panel can therefore disable
    // "Выход" where no return is valid, while the FSM keeps both directions
    // visible and exportable.
    for (let index = 1; index < route.length; index++) {
      add(route[index], route[index - 1], 'ESC', {
        sourceHandle: 's-left',
        targetHandle: 't-right'
      });
    }
    if (route.at(-1) && mainRoot) add(route.at(-1), mainRoot, 'ESC');
    if (root[subsystem] && mainRoot && subsystem === 'files') add(mainRoot, root[subsystem], 'FILE');
  }

  // Error, lamp, USB and printer states are not part of the forward path.
  for (const [subsystem, ids] of Object.entries(grouped)) {
    const normal = orderedNormal(ids, states, root[subsystem]);
    for (const failure of ids.filter((id) => isFailure(states[id].title))) {
      const parent = nearestParent(failure, normal, states) ?? root[subsystem] ?? mainRoot;
      if (parent) add(parent, failure, 'ERR', { kind: 'guarded', condition: `alarm.${failure} == true` });
      if (parent) add(failure, parent, 'ESC');
    }
  }

  // Status overlays are explicitly reachable as fault/status branches.
  for (const id of grouped.shared ?? []) {
    if (!mainRoot) continue;
    add(mainRoot, id, 'ERR', { kind: 'guarded', condition: `status.${id} == true` });
    add(id, mainRoot, 'ESC');
  }

  // The virtual panel is a live part of the model: a key is available only
  // where the reconstructed FSM actually has an outgoing button transition.
  // This makes the runtime distinguish actionable keys from unavailable keys
  // instead of rendering the whole keypad as permanently active.
  controlElements = Object.fromEntries(Object.entries(controlElements).map(([id, element]) => {
    if (element.type !== 'button' || !element.fsmEventId) return [id, element];
    const allowedStates = [...new Set(Object.values(transitions)
      .filter((transition) => transition.trigger.mechanism === 'button' && transition.trigger.buttonId === id)
      .map((transition) => transition.from))];
    return [id, { ...element, allowedStates }];
  }));

  const catalog = cliCatalog();
  const procedures = hmiProcedures();
  const backendProcesses = legacyProcesses();
  for (const transition of Object.values(transitions)) {
    const target = states[transition.to].title.toLowerCase();
    transition.backendProcessId = processForTarget(target);
  }
  const procedureByScreenId = new Map<string, string>();
  for (const state of Object.values(states)) {
    if (!state.screenId) continue;
    const procedureId = processForTarget(state.title.toLowerCase());
    if (procedureId) procedureByScreenId.set(state.screenId, procedureId);
  }
  const screens = Object.fromEntries(Object.entries(input.screens).map(([screenId, screen]) => {
    const procedureId = procedureByScreenId.get(screenId);
    if (!procedureId) return [screenId, screen];
    return [screenId, {
      ...screen,
      objects: screen.objects.map((object, index) => object.type === 'text' && index === 0 ? {
        ...object,
        bindings: {
          ...object.bindings,
          procedureId,
          algorithmId: algorithmFor(procedureId)
        }
      } : object)
    }];
  }));

  const draft: LcdBitmapProject = {
    ...input,
    meta: { ...input.meta, modelId: 'ECROS-5400UV', updatedAt: new Date().toISOString() },
    fsm: { ...input.fsm, states, transitions, transitionOrder: order, events, eventOrder: Object.keys(events), graphLayout: await layout(states, transitions) },
    screens,
    controlPanel: { ...input.controlPanel, elements: controlElements },
    backendProcesses,
    tags: tags(),
    dataSources: {
      ...(input.dataSources ?? {}),
      'ecros.cli': { id: 'ecros.cli', kind: 'cli', config: { transport: 'serial', baudRate: 115200, terminator: '\r' } },
      'ecros.algorithms': { id: 'ecros.algorithms', kind: 'formula', config: { absorbance: 'log10((E100-E0)/(Esam-E0))', transmittance: '100*(Esam-E0)/(E100-E0)' } }
    },
    cliCatalog: catalog,
    procedures,
    alarms: alarms(),
  };
  const bound = { ...draft, bindings: rebuildProjectBindings(draft) };
  return { ...bound, validation: { issues: validateProject(bound), validatedAt: new Date().toISOString() } };
}

function subsystemFor(id: string, title: string): string {
  const value = `${id} ${title}`.toLowerCase();
  const number = title.trim();
  if (id === 'SYS-DIAGNOSTIC') return 'diagnostic';
  if (value.includes('main menu')) return 'main-menu';
  // A few copied screens retain a 2-x identifier although their visible title
  // is a kinetics/multiwave result.  The text therefore wins over the prefix.
  if (value.includes('kinetic')) return 'kinetics';
  if (value.includes('mutliwavelength') || value.includes('multiwavelength')) return 'multiwave';
  if (value.includes('quantitative')) return 'quantitative';
  if (value.includes('photometry')) return 'photometry';
  if (value.includes('settings')) return 'settings';
  if (number.startsWith('1-') || (value.includes('diagnostic') && !number.startsWith('2-'))) return 'diagnostic';
  if (number.startsWith('2-')) return 'main-menu';
  if (number.startsWith('3-') || id === 'PHOT-MAIN-A') return 'photometry';
  if (number.startsWith('4-') || id === 'PHOT-SIGNAL') return 'quantitative';
  if (number.startsWith('5-')) return 'kinetics';
  if (number.startsWith('6-')) return 'multiwave';
  if (number.startsWith('7-') || id === 'SET-MAIN') return 'settings';
  if (number.startsWith('8-') || value.includes('file_') || value.includes('storage')) return 'files';
  return value.includes('printer') || value.includes('usb') || value.includes('pc ') ? 'shared' : 'user';
}

function isFailure(title: string): boolean { return /fail|mistake|error|disconnected|not detected|warning/i.test(title); }
function isSuccess(title: string): boolean { return /success|done|measured|inputed|named|result/i.test(title); }
function numericKey(title: string): string {
  const match = title.trim().match(/^(\d+(?:-\d+)*)/);
  return match ? match[1].split('-').map((part) => part.padStart(4, '0')).join('.') : `9999.${title}`;
}
function groupStateIds(states: Record<string, FsmState>): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const state of Object.values(states)) (groups[state.subsystem] ??= []).push(state.id);
  for (const ids of Object.values(groups)) ids.sort((a, b) => numericKey(states[a].title).localeCompare(numericKey(states[b].title)) || a.localeCompare(b));
  return groups;
}
function rootsFor(groups: Record<string, string[]>): Record<string, string | undefined> {
  const first = (subsystem: string, predicate: (id: string) => boolean): string | undefined => groups[subsystem]?.find(predicate) ?? groups[subsystem]?.[0];
  return {
    diagnostic: 'SYS-DIAGNOSTIC',
    'main-menu': first('main-menu', (id) => id === 'diagnostic-warming-copy'),
    photometry: first('photometry', (id) => id === 'PHOT-MAIN-A'),
    quantitative: first('quantitative', (id) => id === 'PHOT-SIGNAL'),
    kinetics: first('kinetics', (id) => id === 'screen-255'),
    multiwave: first('multiwave', (id) => /parameter-mode/.test(id)),
    settings: first('settings', (id) => id === 'SET-MAIN'),
    files: first('files', () => true),
    shared: first('shared', () => true), user: first('user', () => true)
  };
}
function orderedNormal(ids: string[], states: Record<string, FsmState>, root?: string): string[] {
  const list = ids.filter((id) => !isFailure(states[id].title));
  return root && list.includes(root) ? [root, ...list.filter((id) => id !== root)] : list;
}
function nearestParent(failure: string, normal: string[], states: Record<string, FsmState>): string | undefined {
  const key = numericKey(states[failure].title);
  return [...normal].reverse().find((id) => numericKey(states[id].title) <= key) ?? normal[0];
}
function findByTitle(states: Record<string, FsmState>, title: string): string | undefined {
  return Object.values(states).find((state) => state.title === title)?.id;
}

async function layout(states: Record<string, FsmState>, transitions: Record<string, FsmTransition>): Promise<Record<string, { x: number; y: number; z: number }>> {
  const result = await new ELK().layout({ id: 'ecros-5400uv', layoutOptions: {
    'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', 'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES', 'elk.spacing.nodeNode': '56',
    'elk.layered.spacing.nodeNodeBetweenLayers': '120', 'elk.padding': '[top=60,left=60,bottom=60,right=60]'
  }, children: Object.keys(states).map((id) => ({ id, width: 220, height: 72 })), edges: Object.values(transitions).map((t) => ({ id: t.id, sources: [t.from], targets: [t.to] })) });
  const subsystems = [...new Set(Object.values(states).map((state) => state.subsystem))].sort();
  const depth = new Map(subsystems.map((subsystem, index) => [subsystem, (index - (subsystems.length - 1) / 2) * 54]));
  return Object.fromEntries((result.children ?? []).map((node, index) => {
    const state = states[node.id];
    const typeOffset = state?.stateType === 'failure' ? 26 : state?.stateType === 'success' ? -18 : 0;
    return [node.id, { x: node.x ?? 0, y: node.y ?? 0, z: Math.round((depth.get(state?.subsystem ?? 'user') ?? 0) + typeOffset + ((index % 3) - 1) * 7) }];
  }));
}

const local = (ru: string, en = ru, zh = ru) => ({ en, ru, zh });
function tags(): Record<string, HmiTag> {
  const tag = (id: string, ru: string, dataType: HmiTag['dataType'], extra: Partial<HmiTag> = {}): HmiTag => ({ id, name: local(ru), dataType, sourceId: 'ecros-cli', ...extra });
  return {
    'instr.connected': tag('instr.connected', 'Прибор подключён', 'bool'), 'opt.wavelength_nm': tag('opt.wavelength_nm', 'Длина волны', 'float', { unit: 'nm', minValue: 190, maxValue: 1100, precision: 1 }),
    'opt.lamp_switch_nm': tag('opt.lamp_switch_nm', 'Порог переключения ламп', 'float', { unit: 'nm', minValue: 300, maxValue: 400, precision: 1 }), 'opt.d2_on': tag('opt.d2_on', 'Дейтериевая лампа', 'bool'), 'opt.wu_on': tag('opt.wu_on', 'Галогенная лампа', 'bool'),
    'measure.gain': tag('measure.gain', 'Усиление', 'int', { minValue: 1, maxValue: 8 }), 'measure.dark_valid': tag('measure.dark_valid', 'Тёмный сигнал актуален', 'bool'), 'measure.zero_valid': tag('measure.zero_valid', 'Нулевание актуально', 'bool'),
    'measure.zero_required': tag('measure.zero_required', 'Требуется новое нулевание', 'bool'), 'measure.energy_sam': tag('measure.energy_sam', 'Сигнал образца', 'int'), 'measure.transmittance': tag('measure.transmittance', 'Пропускание', 'float', { unit: '%T', precision: 2 }),
    'measure.absorbance': tag('measure.absorbance', 'Оптическая плотность', 'float', { unit: 'A', precision: 3 }), 'measure.result_valid': tag('measure.result_valid', 'Результат валиден', 'bool'),
    'diag.filter_ok': tag('diag.filter_ok', 'Фильтр исправен', 'bool'), 'diag.detector_ok': tag('diag.detector_ok', 'Детектор исправен', 'bool'), 'diag.system_ok': tag('diag.system_ok', 'Самодиагностика пройдена', 'bool'),
    'diag.warmup_seconds': tag('diag.warmup_seconds', 'Длительность прогрева', 'int', { unit: 's', minValue: 60, maxValue: 3600 }), 'diag.warmup_complete': tag('diag.warmup_complete', 'Прогрев завершён', 'bool'),
    'fault.cli': tag('fault.cli', 'Ошибка CLI', 'bool'), 'fault.saturation': tag('fault.saturation', 'Насыщение АЦП', 'bool'), 'fault.signal_low': tag('fault.signal_low', 'Сигнал ниже темнового', 'bool'), 'io.usb_present': tag('io.usb_present', 'USB-носитель подключён', 'bool'), 'io.printer_present': tag('io.printer_present', 'Принтер подключён', 'bool')
  };
}

function cliCatalog(): Record<string, CliCommandDefinition> {
  const command = (id: string, text: string, ru: string, duration = 1200): CliCommandDefinition => ({ id, command: text, description: local(ru), expectedDurationMs: duration, retryPolicy: { maxAttempts: 1, backoffMs: 0 } });
  return {
    'CLI.CONNECT': command('CLI.CONNECT', 'connect', 'Открыть сеанс'), 'CLI.GET_SN': command('CLI.GET_SN', 'getsn', 'Прочитать серийный номер'),
    'CLI.SET_WL': command('CLI.SET_WL', 'swl {opt.wavelength_nm}', 'Установить длину волны', 5000), 'CLI.RESET_DARK': command('CLI.RESET_DARK', 'resetdark', 'Измерить тёмный сигнал', 12000),
    'CLI.REZERO': command('CLI.REZERO', 'rezero', 'Установить 100.0 %T', 5000), 'CLI.GET_ENERGY': command('CLI.GET_ENERGY', 'ge 3', 'Получить три отсчёта энергии'),
    'CLI.SET_GAIN': command('CLI.SET_GAIN', 'sa {measure.gain}', 'Установить gain'), 'CLI.SET_SWITCH': command('CLI.SET_SWITCH', 'setlampwl {opt.lamp_switch_nm}', 'Установить порог автопереключения'),
    'CLI.WU_ON': command('CLI.WU_ON', 'wuon', 'Включить галогенную лампу'), 'CLI.WU_OFF': command('CLI.WU_OFF', 'wuoff', 'Выключить галогенную лампу'),
    'CLI.D2_ON': command('CLI.D2_ON', 'd2on', 'Включить дейтериевую лампу'), 'CLI.D2_OFF': command('CLI.D2_OFF', 'd2off', 'Выключить дейтериевую лампу'),
    'CLI.SET_LAMP': command('CLI.SET_LAMP', 'setlamp {lamp_id}', 'Переключить оптический тракт', 5000), 'CLI.ADJUST_WL': command('CLI.ADJUST_WL', 'adjustwl', 'Калибровка длины волны', 20000),
    'CLI.GET_D2': command('CLI.GET_D2', 'getd2', 'Состояние дейтериевой лампы'), 'CLI.GET_WU': command('CLI.GET_WU', 'getwu', 'Состояние галогенной лампы'), 'CLI.QUIT': command('CLI.QUIT', 'quit', 'Закрыть сеанс')
  };
}

function hmiProcedures(): Record<string, BackendProcedure> {
  const proc = (id: string, ru: string, steps: string[], precondition?: BackendProcedure['precondition']): BackendProcedure => ({ id, name: local(ru), category: 'ECROS-5400UV', services: ['serial-cli'], precondition, steps: steps.map((cliCommandId) => ({ type: 'cli', cliCommandId })), failureTargetStateId: null });
  const connected = { kind: 'tag' as const, tagId: 'instr.connected' };
  return {
    'PROC.STARTUP': proc('PROC.STARTUP', 'Открыть сеанс и идентифицировать прибор', ['CLI.CONNECT', 'CLI.GET_SN']),
    'PROC.SET_WL': proc('PROC.SET_WL', 'Установить длину волны; затем требуется новое нулевание', ['CLI.SET_WL'], connected),
    'PROC.DARK': proc('PROC.DARK', 'Измерить тёмный сигнал для gain 1…8', ['CLI.RESET_DARK'], connected),
    'PROC.ZERO': proc('PROC.ZERO', 'Нулевание по пустой кювете / эталону', ['CLI.REZERO'], connected),
    'PROC.MEASURE': proc('PROC.MEASURE', 'Измерить сигнал и рассчитать %T/A', ['CLI.GET_ENERGY'], { kind: 'formula', expression: 'measure.zero_valid == true', deps: ['measure.zero_valid'] }),
    'PROC.SET_GAIN': proc('PROC.SET_GAIN', 'Установить gain; затем выполнить rezero', ['CLI.SET_GAIN'], connected),
    'PROC.SET_SWITCH': proc('PROC.SET_SWITCH', 'Задать автоматическое переключение ламп', ['CLI.SET_SWITCH'], connected),
    'PROC.W_LAMP': proc('PROC.W_LAMP', 'Управление галогенной лампой', ['CLI.WU_ON', 'CLI.WU_OFF'], connected),
    'PROC.D2_LAMP': proc('PROC.D2_LAMP', 'Управление дейтериевой лампой', ['CLI.D2_ON', 'CLI.D2_OFF'], connected),
    'PROC.WARMUP': { id: 'PROC.WARMUP', name: local('Прогрев оптической системы'), category: 'ECROS-5400UV', services: ['serial-cli'], precondition: connected, steps: [{ type: 'cli', cliCommandId: 'CLI.GET_D2' }, { type: 'cli', cliCommandId: 'CLI.GET_WU' }, { type: 'delay', delayMs: 900_000 }], postcondition: { kind: 'tag', tagId: 'diag.warmup_complete' }, failureTargetStateId: null },
    'PROC.CAL_WL': proc('PROC.CAL_WL', 'Сервисная калибровка длины волны', ['CLI.ADJUST_WL'], connected)
  };
}
function legacyProcesses(): LcdBitmapProject['backendProcesses'] {
  const entries: Array<[string, string, string[]]> = [
    ['PROC.STARTUP', 'Открыть сеанс', ['connect', 'getsn']], ['PROC.SET_WL', 'Установить длину волны', ['swl {opt.wavelength_nm}', 'set measure.zero_required=true']],
    ['PROC.DARK', 'Тёмный сигнал', ['resetdark']], ['PROC.ZERO', 'Нулевание', ['rezero']], ['PROC.MEASURE', 'Измерение', ['ge 3']], ['PROC.SET_GAIN', 'Усиление', ['sa {measure.gain}', 'set measure.zero_required=true']],
    ['PROC.SET_SWITCH', 'Порог ламп', ['setlampwl {opt.lamp_switch_nm}']], ['PROC.W_LAMP', 'Галогенная лампа', ['wuon / wuoff']], ['PROC.D2_LAMP', 'Дейтериевая лампа', ['d2on / d2off']], ['PROC.WARMUP', 'Прогрев', ['getd2', 'getwu', 'delay 900000']], ['PROC.CAL_WL', 'Калибровка λ', ['adjustwl']]
  ];
  return Object.fromEntries(entries.map(([id, name, commands]) => [id, { id, name, commands, description: name }]));
}
function processForTarget(title: string): string | null {
  if (/diagnostic-warming|waiting/.test(title)) return 'PROC.WARMUP'; if (/dark.current/.test(title)) return 'PROC.DARK'; if (/zero/.test(title)) return 'PROC.ZERO'; if (/calibration/.test(title)) return 'PROC.CAL_WL';
  if (/w_lamp/.test(title)) return 'PROC.W_LAMP'; if (/d2_lamp/.test(title)) return 'PROC.D2_LAMP'; if (/change_lamp/.test(title)) return 'PROC.SET_SWITCH';
  if (/input.*wl|input_wl|new-wl/.test(title)) return 'PROC.SET_WL'; if (/gain/.test(title)) return 'PROC.SET_GAIN'; if (/meas|measurement|result/.test(title)) return 'PROC.MEASURE';
  return null;
}
function algorithmFor(procedureId: string): string {
  if (procedureId === 'PROC.MEASURE') return 'ECROS.RESULT.%T_A';
  if (procedureId === 'PROC.ZERO') return 'ECROS.BASELINE.REZERO';
  if (procedureId === 'PROC.DARK') return 'ECROS.DARK.RESET';
  if (procedureId === 'PROC.SET_WL') return 'ECROS.OPTICS.WAVELENGTH';
  if (procedureId === 'PROC.SET_GAIN') return 'ECROS.OPTICS.GAIN';
  return 'ECROS.SYSTEM.ACTION';
}
function alarms(): Record<string, AlarmDefinition> {
  const alarm = (id: string, ru: string, en: string, zh: string, severity: AlarmDefinition['severity'], expression: string, deps: string[]): AlarmDefinition => ({ id, name: local(ru, en, zh), severity, condition: { kind: 'formula', expression, deps }, message: local(ru, en, zh), autoAcknowledge: false });
  return {
    'ALARM.CLI': alarm('ALARM.CLI', 'Ошибка обмена с прибором', 'Instrument communication error', '仪器通信错误', 'critical', 'fault.cli == true', ['fault.cli']),
    'ALARM.D2': alarm('ALARM.D2', 'Отказ дейтериевой лампы', 'Deuterium lamp failure', '氘灯故障', 'critical', 'opt.d2_on == false', ['opt.d2_on']),
    'ALARM.WU': alarm('ALARM.WU', 'Отказ галогенной лампы', 'Halogen lamp failure', '卤钨灯故障', 'critical', 'opt.wu_on == false', ['opt.wu_on']),
    'ALARM.FILTER': alarm('ALARM.FILTER', 'Ошибка фильтра', 'Filter error', '滤光片故障', 'critical', 'diag.filter_ok == false', ['diag.filter_ok']),
    'ALARM.DETECTOR': alarm('ALARM.DETECTOR', 'Ошибка детектора', 'Detector error', '检测器故障', 'critical', 'diag.detector_ok == false', ['diag.detector_ok']),
    'ALARM.ZERO': alarm('ALARM.ZERO', 'Требуется новое нулевание', 'New zeroing is required', '需要重新调零', 'warning', 'measure.zero_required == true', ['measure.zero_required']),
    'ALARM.SATURATION': alarm('ALARM.SATURATION', 'Насыщение АЦП: уменьшите gain и выполните нулевание', 'ADC saturation: reduce gain and zero again', 'ADC 饱和：降低增益并重新调零', 'critical', 'fault.saturation == true', ['fault.saturation']),
    'ALARM.LOW_SIGNAL': alarm('ALARM.LOW_SIGNAL', 'Сигнал ниже тёмного: результат недействителен', 'Signal below dark current: result invalid', '信号低于暗电流：结果无效', 'critical', 'fault.signal_low == true', ['fault.signal_low']),
    'ALARM.USB': alarm('ALARM.USB', 'USB-носитель не обнаружен', 'USB storage not detected', '未检测到 USB 存储设备', 'warning', 'io.usb_present == false', ['io.usb_present']),
    'ALARM.PRINTER': alarm('ALARM.PRINTER', 'Принтер не подключён', 'Printer is not connected', '打印机未连接', 'warning', 'io.printer_present == false', ['io.printer_present'])
  };
}

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('Usage: complete-ecros-5400uv <input.lcdproj> <output.lcdproj>');
const source = JSON.parse(await readFile(resolve(inputArg), 'utf8')) as unknown;
const snapshot = migrateProject(source);
const completed = await completeProject(snapshot.project);
const file = createProjectFileV5({ ...snapshot, project: completed }, 'ru');
await writeFile(resolve(outputArg), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output: resolve(outputArg), states: file.project.fsm.stateOrder.length,
  transitions: file.project.fsm.transitionOrder.length, events: file.project.fsm.eventOrder.length,
  tags: Object.keys(file.project.tags ?? {}).length, procedures: Object.keys(file.project.procedures ?? {}).length,
  alarms: Object.keys(file.project.alarms ?? {}).length, validation: file.project.validation.issues
}, null, 2));

import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2] ?? 'C:/Users/Vlad Myahlov/Downloads/ECROS-5400UV_FSM_11-08-2026-process-myahlov.lcdproj';
const output = process.argv[3] ?? 'ECROS-5400UV/ECROS-5400UV_FSM_11-08-2026-tree-keyboard.lcdproj';
const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
const project = snapshot.project;
const fsm = project.fsm;

const keyboard = [
  ['UI.K0', '0', 'Цифровой ввод / имя файла'], ['UI.K1', '1', 'Цифровой ввод / имя файла'],
  ['UI.K2', '2 ABC', 'Цифровой ввод / имя файла'], ['UI.K3', '3 DEF', 'Цифровой ввод / имя файла'],
  ['UI.K4', '4 GHI', 'Цифровой ввод / имя файла'], ['UI.K5', '5 JKL', 'Цифровой ввод / имя файла'],
  ['UI.K6', '6 MNO', 'Цифровой ввод / имя файла'], ['UI.K7', '7 PQRS', 'Цифровой ввод / имя файла'],
  ['UI.K8', '8 TUV', 'Цифровой ввод / имя файла'], ['UI.K9', '9 WXYZ', 'Цифровой ввод / имя файла'],
  ['UI.DOT', '.', 'Десятичная точка'], ['UI.MINUS', '-', 'Отрицательное значение'],
  ['UI.UP', '↑', 'Предыдущий пункт меню'], ['UI.DOWN', '↓', 'Следующий пункт меню'],
  ['UI.FILE', 'ФАЙЛ', 'Сохранение и удаление файлов измерений'], ['UI.CLR', 'ОЧИСТИТЬ', 'Очистка ошибочного ввода и данных'],
  ['UI.PRN', 'ПЕЧАТЬ', 'Печать результата'], ['UI.PAR', 'ПАРАМЕТР', 'Параметры и режим измерения'],
  ['UI.WL', 'λ', 'Настройка длины волны'], ['UI.ZERO', 'НОЛЬ', 'Обнуление и базовая линия'],
  ['UI.RUN', 'СТАРТ/СТОП', 'Запуск или остановка измерения'], ['UI.OK', 'ВВОД', 'Подтверждение и сохранение'],
  ['UI.ESC', 'ВЫХОД', 'Возврат к предыдущему экрану / отмена операции'],
];

for (const [id, name, description] of keyboard) {
  fsm.events[id] = { id, name, description, scope: 'global', sourceStateId: null };
  if (!fsm.eventOrder.includes(id)) fsm.eventOrder.push(id);
}
fsm.events['SYS.AUTO'] ??= { id: 'SYS.AUTO', name: 'Автопереход', description: 'Системный автопереход', scope: 'global', sourceStateId: null };
fsm.events['SYS.ERR'] = { id: 'SYS.ERR', name: 'Ошибка', description: 'Системная ошибка', scope: 'global', sourceStateId: null };

// Build a directed tree from real transitions. Back/retry paths are retained,
// but do not decide a node's primary level, which keeps the drawing readable.
const states = fsm.stateOrder.filter((id) => fsm.states[id]);
const incoming = new Map(states.map((id) => [id, 0]));
const children = new Map(states.map((id) => [id, []]));
for (const id of fsm.transitionOrder) {
  const t = fsm.transitions[id];
  if (!t || !incoming.has(t.from) || !incoming.has(t.to) || t.from === t.to) continue;
  children.get(t.from).push({ id: t.to, transition: t });
  incoming.set(t.to, (incoming.get(t.to) ?? 0) + 1);
}
const roots = states.filter((id) => fsm.states[id].initial || incoming.get(id) === 0);
if (!roots.length && states.length) roots.push(states[0]);
const level = new Map();
const queue = roots.map((id) => ({ id, level: 0 }));
for (let index = 0; index < queue.length; index += 1) {
  const current = queue[index];
  if (level.has(current.id)) continue;
  level.set(current.id, current.level);
  const next = [...(children.get(current.id) ?? [])]
    .sort((a, b) => a.transition.trigger.eventId.localeCompare(b.transition.trigger.eventId) || a.id.localeCompare(b.id));
  for (const child of next) if (!level.has(child.id)) queue.push({ id: child.id, level: current.level + 1 });
}
for (const id of states) if (!level.has(id)) level.set(id, (Math.max(...level.values(), 0) + 1));

const levels = new Map();
for (const id of states) {
  const depth = level.get(id) ?? 0;
  const row = levels.get(depth) ?? [];
  row.push(id); levels.set(depth, row);
}
// A stable barycentric order reduces crossings without deleting a single arrow.
for (const [depth, row] of levels) {
  if (!depth) continue;
  const prev = levels.get(depth - 1) ?? [];
  const index = new Map(prev.map((id, i) => [id, i]));
  row.sort((a, b) => {
    const parents = fsm.transitionOrder.map((id) => fsm.transitions[id]).filter((t) => t?.to === a).map((t) => index.get(t.from)).filter(Number.isFinite);
    const other = fsm.transitionOrder.map((id) => fsm.transitions[id]).filter((t) => t?.to === b).map((t) => index.get(t.from)).filter(Number.isFinite);
    const mean = (v) => v.length ? v.reduce((x, y) => x + y, 0) / v.length : Number.MAX_SAFE_INTEGER;
    return mean(parents) - mean(other) || a.localeCompare(b);
  });
}

fsm.graphLayout = {};
for (const [depth, row] of levels) {
  row.forEach((id, index) => { fsm.graphLayout[id] = { x: index * 250, y: depth * 160 }; });
}
for (const id of fsm.transitionOrder) {
  const t = fsm.transitions[id];
  if (!t) continue;
  const forward = (level.get(t.to) ?? 0) > (level.get(t.from) ?? 0);
  t.sourceHandle = forward ? 's-bottom' : 's-right';
  t.targetHandle = forward ? 't-top' : 't-right';
}
// Runtime must always be able to leave diagnostics and a leaf screen.  These
// are explicit button/auto transitions, not UI-only allowedStates metadata.
const menuId = states.find((id) => /main-menu-select-photometry/i.test(id)) ?? states.find((id) => /main-menu/i.test(id));
const addTransition = (from, to, eventId, mechanism) => {
  if (!from || !to || fsm.transitionOrder.some((id) => {
    const t = fsm.transitions[id]; return t?.from === from && t?.to === to && t?.trigger?.eventId === eventId;
  })) return;
  const id = `tr-runtime-${from}-${to}-${eventId}`.replace(/[^A-Za-z0-9_.-]/g, '-');
  fsm.transitions[id] = { id, from, to, kind: 'navigation', condition: null, source: 'runtime-navigation-repair', backendProcessId: null, sourceHandle: 's-right', targetHandle: 't-left', trigger: { mechanism, buttonId: null, timerMs: mechanism === 'timer' ? 500 : null, fact: null, eventId } };
  fsm.transitionOrder.push(id);
};
if (menuId) {
  addTransition('SYS-DIAGNOSTIC', menuId, 'UI.ESC', 'button');
  for (const id of states) {
    const hasOutgoing = fsm.transitionOrder.some((transitionId) => fsm.transitions[transitionId]?.from === id);
    if (!hasOutgoing && id !== menuId) addTransition(id, menuId, 'UI.ESC', 'button');
  }
}
const addArrowChain = (ids) => {
  const present = ids.filter((id) => fsm.states[id]);
  for (let index = 0; index < present.length; index += 1) {
    if (index > 0) addTransition(present[index], present[index - 1], 'UI.UP', 'button');
    if (index < present.length - 1) addTransition(present[index], present[index + 1], 'UI.DOWN', 'button');
  }
};
// Confirmed by 01_Full_diagram.svg / 06_Settings_and_files.svg.
addArrowChain([
  'diagnostic-warming-copy', 'main-menu-select-photometry-copy', 'main-menu-select-quantitative-copy',
  'main-menu-select-multiwavelength-copy', 'main-menu-select-kinetics-copy',
]);
addArrowChain([
  'SET-MAIN', '7-1-1-settings-dark-current-copy', '7-1-1-copy', '7-1-3-settings-d2-lamp-copy',
  '7-1-4-settings-d2-lamp-peripheriae-copy', '7-1-4-settings-d2-lamp-peripheriae-copy-copy',
  '7-1-6-settings-d2-lamp-peripheriae-copy-copy-copy', '7-1-8-settings-system-default-copy',
  '7-1-7-settings-d2-lamp-peripheriae-copy-copy-copy-copy',
]);
addArrowChain([
  'file-group-quantitative-copy', 'file-group-multiwavelength-copy', 'file-group-kinetics-copy',
  'file-group-corr-copy', 'file-group-photometry-water-select-copy',
]);
// Preserve every imported LCD screen in Runtime: orphan roots are reachable
// through a deterministic DOWN catalogue chain after the visible menus.
const incomingStates = new Set(fsm.transitionOrder.map((id) => fsm.transitions[id]?.to).filter(Boolean));
const orphanStates = states.filter((id) => !incomingStates.has(id) && id !== 'SYS-DIAGNOSTIC');
let catalogueCursor = 'main-menu-select-kinetics-copy';
for (const stateId of orphanStates) {
  addTransition(catalogueCursor, stateId, 'UI.DOWN', 'button');
  catalogueCursor = stateId;
}
// Runtime enables a virtual key only when allowedStates contains the active
// state. Derive it from the actual event transitions rather than a stale list.
for (const element of Object.values(project.controlPanel.elements ?? {})) {
  if (element.type !== 'button' || !element.fsmEventId) continue;
  element.allowedStates = fsm.transitionOrder
    .map((id) => fsm.transitions[id])
    .filter((transition) => transition?.trigger?.eventId === element.fsmEventId)
    .map((transition) => transition.from)
    .filter((stateId, index, all) => all.indexOf(stateId) === index);
}
project.meta.name = `${project.meta.name} — дерево FSM и клавиатура`;
project.meta.description = 'ECROS-5400UV: дерево состояний, полная клавиатура и ортогональные переходы.';
snapshot.savedAt = new Date().toISOString();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(snapshot, null, 2), 'utf8');
console.log(JSON.stringify({ output, states: states.length, transitions: fsm.transitionOrder.length, events: fsm.eventOrder.length, roots: roots.length }, null, 2));

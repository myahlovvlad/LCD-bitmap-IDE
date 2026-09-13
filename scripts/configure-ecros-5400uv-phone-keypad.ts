import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectFile = resolve(process.cwd(), 'ECROS-5400UV', 'ECROS-5400UV_FSM_11-09-2026.lcdproj');
const backupFile = `${projectFile}.before-phone-keypad`;
const write = process.argv.includes('--write');

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as RecordValue;
}

function update(record: RecordValue, updates: RecordValue): boolean {
  const changed = Object.entries(updates).some(([key, value]) => JSON.stringify(record[key]) !== JSON.stringify(value));
  Object.assign(record, updates);
  return changed;
}

const document = asRecord(JSON.parse(readFileSync(projectFile, 'utf8')));
const project = asRecord(document.project);
const fsm = asRecord(project.fsm);
const states = asRecord(fsm.states);
const events = asRecord(fsm.events);
const transitions = asRecord(fsm.transitions);
const transitionOrder = fsm.transitionOrder as string[];
const panel = asRecord(project.controlPanel);
const elements = asRecord(panel.elements);

const phoneKeys: Record<string, { label: string; eventId: string }> = {
  'button-3': { label: '1', eventId: 'UI.K1' },
  'button-5': { label: '2 ABC', eventId: 'UI.K2' },
  'button-6': { label: '3 DEF', eventId: 'UI.K3' },
  'button-7': { label: '4 GHI', eventId: 'UI.K4' },
  'button-8': { label: '5 JKL', eventId: 'UI.K5' },
  'button-9': { label: '6 MNO', eventId: 'UI.K6' },
  'button-10': { label: '7 PQRS', eventId: 'UI.K7' },
  'button-11': { label: '8 TUV', eventId: 'UI.K8' },
  'button-12': { label: '9 WXYZ', eventId: 'UI.K9A' },
  'button-18': { label: '0', eventId: 'UI.K0' }
};

const numericInputStates = [
  'PHOT_IN_WL_IN',
  'PHOT_PAR_MODE_E_IN_GAIN',
  'PHOT_PAR_PARLL_MEAS_IN',
  'QUANT_SMODE_CRV_NEW_IN',
  'QUANT_SMODE_CRV_NEW_CUVETTE_IN',
  'QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_INPUTTING',
  'QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN',
  'QUANT_SMODE_CRV_NEW_STD_1_INPUTTING',
  'QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN',
  'QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN_N723',
  'QUANT_SMODE_COEF_IN_COEFF_A_LIN',
  'QUANT_SMODE_COEF_IN_COEFF_A_LIN_0',
  'QUANT_SMODE_COEF_PARR_MEAS_IN',
  'KIN_PAR_LAYERS_LOW_INPUTTING_A',
  'KIN_PAR_TIME_INPUTTING_TIMESTEP',
  'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN',
  'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL',
  'MUTLIWAVELENGTH_MEAS_ZERO_SET_WL'
];
const textInputStates = [
  'PHOT_NAME_FILE',
  'FILE_PHOT_MN_REN_N112',
  'QUANT_SMODE_CRV_NEW_SAVE_YES_NAME',
  'QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAME'
];

let changedKeys = 0;
let configuredStates = 0;
let remappedCommitTransitions = 0;
let restoredMultiwaveTransitions = 0;
for (const [id, key] of Object.entries(phoneKeys)) {
  const button = asRecord(elements[id]);
  if (button.type !== 'button') throw new Error(`${id} is not a button.`);
  if (update(button, { label: key.label, keyCode: key.label, fsmEventId: key.eventId })) changedKeys += 1;
  const event = asRecord(events[key.eventId]);
  update(event, { name: key.label });
}
for (const id of numericInputStates) {
  const state = asRecord(states[id]);
  if (update(state, { input: { mode: 'numeric', maxLength: 12, allowDecimal: true, allowNegative: true } })) configuredStates += 1;
}
for (const id of textInputStates) {
  const state = asRecord(states[id]);
  if (update(state, { input: { mode: 'text', maxLength: 16, allowDecimal: false, allowNegative: false } })) configuredStates += 1;
}
for (const transitionId of transitionOrder) {
  const transition = asRecord(transitions[transitionId]);
  if (
    ![...numericInputStates, ...textInputStates].includes(transition.from as string)
    || asRecord(transition.trigger).eventId !== 'UI.PAR'
  ) continue;
  if (update(asRecord(transition.trigger), { eventId: 'UI.OK', mechanism: 'button', buttonId: 'button-21' })) {
    remappedCommitTransitions += 1;
  }
  update(transition, { labelMode: 'button' });
}

const multiwaveRoutes: Array<[string, string, 'UI.OK' | 'UI.ESC']> = [
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4', 'MUTLIWAVELENGTH_PAR_NEXT', 'UI.OK'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN', 'MUTLIWAVELENGTH_PAR_NUMBER_WL', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2', 'UI.ESC'],
  ['MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4', 'MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3', 'UI.ESC']
];
for (const [from, to, eventId] of multiwaveRoutes) {
  const exists = transitionOrder.some((id) => {
    const transition = asRecord(transitions[id]);
    return transition.from === from && asRecord(transition.trigger).eventId === eventId;
  });
  if (exists) continue;
  const id = `transition-repair-${from.toLowerCase()}-${eventId.slice(3).toLowerCase()}`;
  transitions[id] = {
    id,
    from,
    to,
    sourceHandle: 's-right',
    targetHandle: 't-left',
    trigger: { eventId, mechanism: 'button', buttonId: eventId === 'UI.OK' ? 'button-21' : 'button-22', timerMs: null, fact: null },
    kind: 'navigation',
    condition: null,
    source: 'repair:ecros-5400uv-phone-keypad',
    backendProcessId: null,
    labelMode: 'button'
  };
  transitionOrder.push(id);
  restoredMultiwaveTransitions += 1;
}

if (!write) {
  console.log(`Dry run: ${changedKeys} keypad controls, ${configuredStates} input states, ${remappedCommitTransitions} input commits and ${restoredMultiwaveTransitions} multiwave transitions need updating.`);
  process.exit(0);
}

if (!existsSync(backupFile)) copyFileSync(projectFile, backupFile);
document.savedAt = new Date().toISOString();
asRecord(project.meta).updatedAt = document.savedAt;
writeFileSync(projectFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Updated ${changedKeys} keypad controls, ${configuredStates} input states, ${remappedCommitTransitions} input commits and ${restoredMultiwaveTransitions} multiwave transitions. Backup: ${backupFile}`);

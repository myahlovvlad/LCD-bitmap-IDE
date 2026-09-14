import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectFile = resolve(process.cwd(), 'ECROS-5400UV', 'ECROS-5400UV_FSM_11-09-2026.lcdproj');
const backupFile = `${projectFile}.before-keyboard-guards`;
const write = process.argv.includes('--write');

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as RecordValue;
}

const document = asRecord(JSON.parse(readFileSync(projectFile, 'utf8')));
const project = asRecord(document.project);
const fsm = asRecord(project.fsm);
const transitions = asRecord(fsm.transitions);
const transitionOrder = fsm.transitionOrder as string[];
const controlPanel = asRecord(project.controlPanel);
const elements = asRecord(controlPanel.elements);

let changedButtons = 0;
let repairedStateReferences = 0;

for (const element of Object.values(elements)) {
  const button = asRecord(element);
  if (button.type !== 'button' || typeof button.fsmEventId !== 'string') continue;

  const expectedStates = transitionOrder
    .map((id) => asRecord(transitions[id]))
    .filter((transition) => asRecord(transition.trigger).eventId === button.fsmEventId)
    .map((transition) => transition.from as string)
    .filter((stateId, index, stateIds) => stateIds.indexOf(stateId) === index);
  const currentStates = Array.isArray(button.allowedStates) ? button.allowedStates : [];

  if (JSON.stringify(currentStates) !== JSON.stringify(expectedStates)) {
    repairedStateReferences += currentStates.length;
    button.allowedStates = expectedStates;
    changedButtons += 1;
  }
}

if (!write) {
  console.log(`Dry run: ${changedButtons} buttons need guard synchronization; ${repairedStateReferences} old entries would be replaced.`);
  process.exit(0);
}

if (!existsSync(backupFile)) copyFileSync(projectFile, backupFile);
writeFileSync(projectFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Updated ${changedButtons} buttons. Backup: ${backupFile}`);

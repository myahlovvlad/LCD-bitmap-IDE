import { DISPLAY_CONSTRAINTS, DOMAIN_GLOSSARY } from '../src/renderer/config/constants';
import { importFsmModel } from '../src/renderer/core/fsmImporter';
import { loadBundledFsmModel } from '../src/renderer/core/loadBundledFsm';

const imported = loadBundledFsmModel();

assertEqual(imported.stateOrder.length, 5, 'Bundled demo state count');
assertEqual(imported.transitionOrder.length, 4, 'Bundled demo transition count');

for (const stateId of imported.stateOrder) {
  const canvas = imported.project.canvasByStateId[stateId];
  assert(Boolean(canvas), `Canvas exists for ${stateId}`);
  assertEqual(canvas.width, DISPLAY_CONSTRAINTS.width, `${stateId} canvas width`);
  assertEqual(canvas.height, DISPLAY_CONSTRAINTS.height, `${stateId} canvas height`);
}

const rawImported = importFsmModel({
  project: 'Public Fixture',
  states: [
    { id: 'A', lcd: ['MAIN', 'READY'] },
    { id: 'B', lcd: ['RESULT'] }
  ],
  transitions: [{ from: 'A', to: 'B', trigger: 'ENTER' }]
});

assertEqual(rawImported.project.modelId, 'Universal-LCD-128x64', 'Importer model id');
assertEqual(rawImported.stateOrder.length, 2, 'Raw importer state count');
assertEqual(rawImported.transitionOrder.length, 1, 'Raw importer transition count');
assertEqual(
  DOMAIN_GLOSSARY.referenceSolution.preferred,
  'Reference Solution',
  'Glossary preferred Reference Solution'
);

console.log(
  `Importer verified: ${imported.stateOrder.length} bundled demo states, ${rawImported.stateOrder.length} raw fixture states.`
);

function assert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

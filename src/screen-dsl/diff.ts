import type { ScreenInterchangeProjectV1 } from '../screen-interchange';
import type { ScreenDslSemanticDiff, ScreenDslSemanticOperation } from './model';

export function diffScreenInterchange(left: ScreenInterchangeProjectV1, right: ScreenInterchangeProjectV1): ScreenDslSemanticDiff {
  const operations: ScreenDslSemanticOperation[] = [];
  const leftScreens = new Map(left.screens.map((screen) => [screen.id, screen]));
  const rightScreens = new Map(right.screens.map((screen) => [screen.id, screen]));
  for (const [id, screen] of rightScreens) {
    const previous = leftScreens.get(id);
    if (!previous) {
      operations.push({ type: 'screen.create', id, path: `/screens/${id}` });
      continue;
    }
    if (JSON.stringify({ ...previous, objects: undefined }) !== JSON.stringify({ ...screen, objects: undefined })) {
      operations.push({ type: 'screen.update', id, path: `/screens/${id}` });
    }
    operations.push(...diffObjects(id, previous.objects, screen.objects));
  }
  for (const id of leftScreens.keys()) {
    if (!rightScreens.has(id)) {
      operations.push({ type: 'screen.delete', id, path: `/screens/${id}` });
    }
  }
  return { operations };
}

function diffObjects(screenId: string, leftObjects: ScreenInterchangeProjectV1['screens'][number]['objects'], rightObjects: ScreenInterchangeProjectV1['screens'][number]['objects']): ScreenDslSemanticOperation[] {
  const operations: ScreenDslSemanticOperation[] = [];
  const left = new Map(leftObjects.map((object) => [object.id, object]));
  const right = new Map(rightObjects.map((object) => [object.id, object]));
  for (const [id, object] of right) {
    const previous = left.get(id);
    if (!previous) {
      operations.push({ type: 'object.create', id, path: `/screens/${screenId}/objects/${id}` });
    } else if (JSON.stringify(previous) !== JSON.stringify(object)) {
      operations.push({ type: 'object.update', id, path: `/screens/${screenId}/objects/${id}` });
    }
  }
  for (const id of left.keys()) {
    if (!right.has(id)) {
      operations.push({ type: 'object.delete', id, path: `/screens/${screenId}/objects/${id}` });
    }
  }
  const leftOrder = leftObjects.map((object) => object.id).join('\n');
  const rightOrder = rightObjects.map((object) => object.id).join('\n');
  if (leftOrder !== rightOrder && leftObjects.some((object) => right.has(object.id))) {
    operations.push({ type: 'object.reorder', id: screenId, path: `/screens/${screenId}/objects` });
  }
  return operations;
}

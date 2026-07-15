import type {
  ScreenInterchangeBitmapObjectV1,
  ScreenInterchangeObjectV1,
  ScreenInterchangeProjectV1,
  ScreenInterchangeSpecialObjectV1
} from '../../screen-interchange';
import type { ScreenDslImportMode } from '../../screen-dsl';
import type { ScreenDslIdentityPlan } from './contracts';

export function prepareScreenDslCandidate(
  candidate: ScreenInterchangeProjectV1,
  importMode: ScreenDslImportMode,
  identityPlan: ScreenDslIdentityPlan
): ScreenInterchangeProjectV1 {
  if (importMode !== 'clone') {
    return candidate;
  }
  return {
    ...candidate,
    project: {
      ...candidate.project,
      screenOrder: candidate.project.screenOrder.map((screenId) => identityPlan.screens[screenId] ?? screenId)
    },
    screens: candidate.screens.map((screen) => {
      const screenId = identityPlan.screens[screen.id] ?? screen.id;
      const objectIds = new Map(screen.objects.map((object) => [object.id, identityPlan.objects[`${screen.id}:${object.id}`] ?? object.id]));
      const resourceId = (ref: string): string => identityPlan.resources[ref] ?? ref;
      return {
        ...screen,
        id: screenId,
        linkedStateIds: [],
        objectOrder: screen.objectOrder.map((objectId) => objectIds.get(objectId) ?? objectId),
        objects: screen.objects.map((object) => cloneObject(object, objectIds, resourceId))
      };
    }),
    resources: {
      fonts: Object.fromEntries(Object.entries(candidate.resources.fonts).map(([id, resource]) => [
        identityPlan.resources[id] ?? id,
        { ...resource, id: identityPlan.resources[id] ?? id }
      ])),
      glyphs: Object.fromEntries(Object.entries(candidate.resources.glyphs).map(([id, resource]) => [
        identityPlan.resources[id] ?? id,
        { ...resource, id: identityPlan.resources[id] ?? id, fontId: identityPlan.resources[resource.fontId] ?? resource.fontId }
      ])),
      bitmaps: Object.fromEntries(Object.entries(candidate.resources.bitmaps).map(([id, resource]) => [
        identityPlan.resources[id] ?? id,
        { ...resource, id: identityPlan.resources[id] ?? id, sourceObjectId: objectIdsForResource(candidate, identityPlan, resource.sourceObjectId) }
      ]))
    },
    traceability: {
      ...candidate.traceability,
      screens: {},
      objects: {},
      resources: {}
    }
  };
}

function cloneObject(
  object: ScreenInterchangeObjectV1,
  objectIds: Map<string, string>,
  resourceId: (ref: string) => string
): ScreenInterchangeObjectV1 {
  const base = {
    ...object,
    id: objectIds.get(object.id) ?? object.id,
    resourceRefs: object.resourceRefs.map(resourceId)
  };
  if (base.type === 'bitmap') {
    return { ...base, bitmapRef: resourceId((object as ScreenInterchangeBitmapObjectV1).bitmapRef) } as ScreenInterchangeObjectV1;
  }
  if (base.type === 'special') {
    const special = object as ScreenInterchangeSpecialObjectV1;
    return { ...base, glyphOverrideRef: special.glyphOverrideRef ? resourceId(special.glyphOverrideRef) : undefined } as ScreenInterchangeObjectV1;
  }
  return base as ScreenInterchangeObjectV1;
}

function objectIdsForResource(
  candidate: ScreenInterchangeProjectV1,
  identityPlan: ScreenDslIdentityPlan,
  sourceObjectId: string
): string {
  for (const screen of candidate.screens) {
    const mapped = identityPlan.objects[`${screen.id}:${sourceObjectId}`];
    if (mapped) {
      return mapped;
    }
  }
  return sourceObjectId;
}

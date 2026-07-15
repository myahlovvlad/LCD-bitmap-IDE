import {
  SCREEN_INTERCHANGE_KIND,
  type ScreenInterchangeObjectV1,
  type ScreenInterchangeProjectV1
} from '../screen-interchange';
import {
  SCREEN_DSL_FORMAT,
  SCREEN_DSL_LAYOUT_MODE,
  SCREEN_DSL_VERSION,
  type ScreenDslDocumentV1,
  type ScreenDslObjectV1
} from './model';

export function screenInterchangeToDslDocument(packageV1: ScreenInterchangeProjectV1): ScreenDslDocumentV1 {
  return {
    format: SCREEN_DSL_FORMAT,
    version: SCREEN_DSL_VERSION,
    layoutMode: SCREEN_DSL_LAYOUT_MODE,
    project: { ...packageV1.project, screenOrder: [...packageV1.project.screenOrder], display: { ...packageV1.project.display } },
    screens: packageV1.screens.map((screen) => ({
      ...screen,
      tags: [...screen.tags],
      objectOrder: [...screen.objectOrder],
      linkedStateIds: [...screen.linkedStateIds],
      display: { ...screen.display },
      meta: { ...screen.meta },
      objects: screen.objects.map(interchangeObjectToDsl)
    })),
    resources: clone(packageV1.resources)
  };
}

export function screenDslDocumentToInterchange(document: ScreenDslDocumentV1): ScreenInterchangeProjectV1 {
  return {
    kind: SCREEN_INTERCHANGE_KIND,
    version: 1,
    project: { ...document.project, screenOrder: [...document.project.screenOrder], display: { ...document.project.display } },
    screens: document.screens.map((screen) => ({
      ...screen,
      tags: [...screen.tags],
      objectOrder: [...screen.objectOrder],
      linkedStateIds: [...screen.linkedStateIds],
      display: { ...screen.display },
      meta: { ...screen.meta },
      objects: screen.objects.map(dslObjectToInterchange)
    })),
    resources: clone(document.resources),
    traceability: {
      projectId: document.project.id,
      screens: Object.fromEntries(document.screens.map((screen) => [screen.id, {
        sourceScreenId: screen.id,
        linkedStateIds: [...screen.linkedStateIds],
        selectedObjectIds: []
      }])),
      objects: Object.fromEntries(document.screens.flatMap((screen) => screen.objects.map((object) => [`${screen.id}:${object.id}`, {
        sourceScreenId: screen.id,
        sourceObjectId: object.id,
        objectType: object.kind,
        resourceRefs: [...object.resourceRefs]
      }]))),
      resources: {
        ...Object.fromEntries(Object.keys(document.resources.fonts).map((id) => [id, { resourceType: 'font' as const }])),
        ...Object.fromEntries(Object.keys(document.resources.glyphs).map((id) => [id, { resourceType: 'glyph' as const }])),
        ...Object.fromEntries(Object.keys(document.resources.bitmaps).map((id) => [id, { resourceType: 'bitmap' as const }]))
      }
    }
  };
}

function interchangeObjectToDsl(object: ScreenInterchangeObjectV1): ScreenDslObjectV1 {
  const { type, resourceRefs, ...rest } = object;
  return { ...clone(rest), kind: type, resourceRefs: [...resourceRefs] } as ScreenDslObjectV1;
}

function dslObjectToInterchange(object: ScreenDslObjectV1): ScreenInterchangeObjectV1 {
  const { kind, resourceRefs, ...rest } = object;
  return { ...clone(rest), type: kind, resourceRefs: [...resourceRefs] } as unknown as ScreenInterchangeObjectV1;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

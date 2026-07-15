import type {
  BitmapCanvasObject,
  CanvasObject,
  DisplayConfig,
  FontVariant,
  LcdBitmapProject,
  LcdScreen,
  SpecialCanvasObject
} from '../domain';
import {
  SCREEN_INTERCHANGE_KIND,
  SCREEN_INTERCHANGE_VERSION,
  type ScreenInterchangeBitmapResourceV1,
  type ScreenInterchangeObjectV1,
  type ScreenInterchangeProjectV1,
  type ScreenInterchangeResourcesV1,
  type ScreenInterchangeSpecialObjectV1,
  type ScreenInterchangeTraceabilityV1
} from './model';

export interface ScreenInterchangeExportOptions {
  screenIds?: readonly string[];
}

interface ConversionContext {
  project: LcdBitmapProject;
  resources: ScreenInterchangeResourcesV1;
  traceability: ScreenInterchangeTraceabilityV1;
}

export function projectToScreenInterchange(
  project: LcdBitmapProject,
  options: ScreenInterchangeExportOptions = {}
): ScreenInterchangeProjectV1 {
  const selectedScreenIds = options.screenIds
    ? project.screenOrder.filter((screenId) => options.screenIds?.includes(screenId))
    : project.screenOrder;
  const context: ConversionContext = {
    project,
    resources: {
      fonts: {},
      glyphs: {},
      bitmaps: {}
    },
    traceability: {
      projectId: project.meta.id,
      screens: {},
      objects: {},
      resources: {}
    }
  };

  const screens = selectedScreenIds
    .map((screenId) => project.screens[screenId])
    .filter((screen): screen is LcdScreen => Boolean(screen))
    .map((screen) => screenToScreenInterchange(screen, context));

  return {
    kind: SCREEN_INTERCHANGE_KIND,
    version: SCREEN_INTERCHANGE_VERSION,
    project: {
      id: project.meta.id,
      name: project.meta.name,
      schemaVersion: project.meta.schemaVersion,
      display: cloneDisplay(project.display),
      screenOrder: screens.map((screen) => screen.id)
    },
    screens,
    resources: context.resources,
    traceability: context.traceability
  };
}

export function screenToScreenInterchangePackage(
  project: LcdBitmapProject,
  screenId: string
): ScreenInterchangeProjectV1 {
  return projectToScreenInterchange(project, { screenIds: [screenId] });
}

export function screenInterchangeToLcdScreens(packageV1: ScreenInterchangeProjectV1): Record<string, LcdScreen> {
  return Object.fromEntries(packageV1.screens.map((screen) => [
    screen.id,
    {
      id: screen.id,
      name: screen.name,
      description: screen.description,
      tags: [...screen.tags],
      width: screen.display.width,
      height: screen.display.height,
      objects: screen.objects
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((object) => reconstructObject(object, packageV1.resources)),
      selectedObjectIds: [...(packageV1.traceability.screens[screen.id]?.selectedObjectIds ?? [])],
      createdAt: screen.meta.createdAt,
      updatedAt: screen.meta.updatedAt
    }
  ]));
}

function screenToScreenInterchange(
  screen: LcdScreen,
  context: ConversionContext
): ScreenInterchangeProjectV1['screens'][number] {
  const linkedStateIds = context.project.fsm.stateOrder.filter((stateId) => context.project.fsm.states[stateId]?.screenId === screen.id);
  const objects = screen.objects.map((object, order) => objectToInterchange(screen.id, object, order, context));

  context.traceability.screens[screen.id] = {
    sourceScreenId: screen.id,
    linkedStateIds,
    selectedObjectIds: [...screen.selectedObjectIds]
  };

  return {
    id: screen.id,
    name: screen.name,
    description: screen.description,
    tags: [...screen.tags],
    display: {
      width: screen.width,
      height: screen.height,
      colorMode: context.project.display.colorMode,
      packing: context.project.display.packing
    },
    objectOrder: objects.map((object) => object.id),
    objects,
    linkedStateIds,
    meta: {
      createdAt: screen.createdAt,
      updatedAt: screen.updatedAt
    }
  };
}

function objectToInterchange(
  screenId: string,
  object: CanvasObject,
  order: number,
  context: ConversionContext
): ScreenInterchangeObjectV1 {
  const resourceRefs: string[] = [];
  const base = {
    id: object.id,
    type: object.type,
    order,
    zIndex: object.zIndex,
    visible: object.visible,
    locked: object.locked,
    source: object.source
  };
  const addFontRef = (fontVariant: FontVariant | undefined): void => {
    if (!fontVariant) {
      return;
    }
    const ref = `font:${fontVariant}`;
    resourceRefs.push(ref);
    const existing = Object.values(context.project.fonts).find((font) => font.variant === fontVariant);
    context.resources.fonts[ref] = existing
      ? { ...existing, glyphIds: [...existing.glyphIds] }
      : {
        id: ref,
        name: `Bundled font ${fontVariant}`,
        sourceFormat: 'bundled',
        variant: fontVariant,
        glyphCount: 0,
        createdAt: context.project.meta.createdAt,
        glyphIds: []
      };
    context.traceability.resources[ref] = { resourceType: 'font' };
  };
  const finish = (value: object): ScreenInterchangeObjectV1 => {
    const withRefs = { ...value, resourceRefs: [...resourceRefs] } as unknown as ScreenInterchangeObjectV1;
    context.traceability.objects[`${screenId}:${object.id}`] = {
      sourceScreenId: screenId,
      sourceObjectId: object.id,
      objectType: object.type,
      resourceRefs: [...resourceRefs]
    };
    return withRefs;
  };

  if (object.type === 'text') {
    addFontRef(object.fontVariant);
    return finish({ ...base, type: 'text', text: { ...object.text }, x: object.x, y: object.y, fontVariant: object.fontVariant, pendingTranslation: object.pendingTranslation });
  }
  if (object.type === 'line') {
    return finish({ ...base, type: 'line', x0: object.x0, y0: object.y0, x1: object.x1, y1: object.y1 });
  }
  if (object.type === 'rect') {
    return finish({ ...base, type: 'rect', x: object.x, y: object.y, width: object.width, height: object.height, filled: object.filled });
  }
  if (object.type === 'icon') {
    return finish({ ...base, type: 'icon', iconId: object.iconId, x: object.x, y: object.y, width: object.width, height: object.height });
  }
  if (object.type === 'bitmap') {
    const bitmapRef = `bitmap:${screenId}:${object.id}`;
    resourceRefs.push(bitmapRef);
    context.resources.bitmaps[bitmapRef] = bitmapResource(bitmapRef, object);
    context.traceability.resources[bitmapRef] = { sourceScreenId: screenId, sourceObjectId: object.id, resourceType: 'bitmap' };
    return finish({ ...base, type: 'bitmap', name: object.name, x: object.x, y: object.y, width: object.width, height: object.height, bitmapRef });
  }
  if (object.type === 'special') {
    return finish(specialObjectToInterchange(screenId, object, { ...base, type: 'special' }, resourceRefs, context));
  }
  return finish({ ...base, type: 'invert', x: object.x, y: object.y, width: object.width, height: object.height });
}

function specialObjectToInterchange(
  screenId: string,
  object: SpecialCanvasObject,
  base: Omit<ScreenInterchangeSpecialObjectV1, 'resourceRefs' | 'kind' | 'x' | 'y' | 'width' | 'height' | 'checked' | 'value'>,
  resourceRefs: string[],
  context: ConversionContext
): Omit<ScreenInterchangeSpecialObjectV1, 'resourceRefs'> {
  if (object.fontVariant) {
    const ref = `font:${object.fontVariant}`;
    resourceRefs.push(ref);
    const existing = Object.values(context.project.fonts).find((font) => font.variant === object.fontVariant);
    context.resources.fonts[ref] = existing
      ? { ...existing, glyphIds: [...existing.glyphIds] }
      : {
        id: ref,
        name: `Bundled font ${object.fontVariant}`,
        sourceFormat: 'bundled',
        variant: object.fontVariant,
        glyphCount: 0,
        createdAt: context.project.meta.createdAt,
        glyphIds: []
      };
    context.traceability.resources[ref] = { resourceType: 'font' };
  }

  const glyphOverrideRef = object.glyphOverride ? `glyph:${screenId}:${object.id}:override` : undefined;
  if (glyphOverrideRef && object.glyphOverride) {
    resourceRefs.push(glyphOverrideRef);
    context.resources.glyphs[glyphOverrideRef] = {
      id: glyphOverrideRef,
      char: object.glyphChar ?? '',
      fontId: object.fontVariant ? `font:${object.fontVariant}` : 'inline',
      width: object.glyphOverride.width,
      data: [...object.glyphOverride.data],
      topOffset: object.glyphOverride.topOffset,
      nominalHeight: object.glyphOverride.nominalHeight
    };
    context.traceability.resources[glyphOverrideRef] = { sourceScreenId: screenId, sourceObjectId: object.id, resourceType: 'glyph' };
  }

  return {
    ...base,
    type: 'special',
    kind: object.kind,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    checked: object.checked,
    value: object.value,
    fontVariant: object.fontVariant,
    glyphChar: object.glyphChar,
    glyphOverrideRef
  };
}

function reconstructObject(object: ScreenInterchangeObjectV1, resources: ScreenInterchangeResourcesV1): CanvasObject {
  const base = {
    id: object.id,
    zIndex: object.zIndex,
    visible: object.visible,
    locked: object.locked,
    source: object.source
  };
  if (object.type === 'text') {
    return { ...base, type: 'text', text: { ...object.text }, x: object.x, y: object.y, fontVariant: object.fontVariant, pendingTranslation: object.pendingTranslation };
  }
  if (object.type === 'line') {
    return { ...base, type: 'line', x0: object.x0, y0: object.y0, x1: object.x1, y1: object.y1 };
  }
  if (object.type === 'rect') {
    return { ...base, type: 'rect', x: object.x, y: object.y, width: object.width, height: object.height, filled: object.filled };
  }
  if (object.type === 'icon') {
    return { ...base, type: 'icon', iconId: object.iconId, x: object.x, y: object.y, width: object.width, height: object.height };
  }
  if (object.type === 'bitmap') {
    const bitmap = resources.bitmaps[object.bitmapRef];
    return { ...base, type: 'bitmap', name: object.name, x: object.x, y: object.y, width: object.width, height: object.height, bytes: [...(bitmap?.bytes ?? [])] };
  }
  if (object.type === 'special') {
    const glyphOverride = object.glyphOverrideRef ? resources.glyphs[object.glyphOverrideRef] : undefined;
    return {
      ...base,
      type: 'special',
      kind: object.kind,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      checked: object.checked,
      value: object.value,
      fontVariant: object.fontVariant,
      glyphChar: object.glyphChar,
      glyphOverride: glyphOverride
        ? {
          width: glyphOverride.width,
          data: [...glyphOverride.data],
          topOffset: glyphOverride.topOffset,
          nominalHeight: glyphOverride.nominalHeight
        }
        : undefined
    };
  }
  return { ...base, type: 'invert', x: object.x, y: object.y, width: object.width, height: object.height };
}

function bitmapResource(id: string, object: BitmapCanvasObject): ScreenInterchangeBitmapResourceV1 {
  return {
    id,
    name: object.name,
    width: object.width,
    height: object.height,
    bytes: [...object.bytes],
    sourceObjectId: object.id
  };
}

function cloneDisplay(display: DisplayConfig): DisplayConfig {
  return { ...display };
}

import {
  SCREEN_INTERCHANGE_KIND,
  SCREEN_INTERCHANGE_VERSION,
  type ScreenInterchangeObjectV1,
  type ScreenInterchangeProjectV1,
  type ScreenInterchangeValidationIssue,
  type ScreenInterchangeValidationResult
} from './model';
import { PROJECT_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION_LEGACY } from '../domain/project';

export function validateScreenInterchange(packageV1: ScreenInterchangeProjectV1): ScreenInterchangeValidationResult {
  const issues: ScreenInterchangeValidationIssue[] = [];

  if (packageV1.kind !== SCREEN_INTERCHANGE_KIND) {
    addIssue(issues, 'error', 'kind', `Expected ${SCREEN_INTERCHANGE_KIND}.`);
  }
  if (packageV1.version !== SCREEN_INTERCHANGE_VERSION) {
    addIssue(issues, 'error', 'version', `Expected version ${SCREEN_INTERCHANGE_VERSION}.`);
  }
  const knownSchemaVersions: number[] = [PROJECT_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION_LEGACY];
  if (!knownSchemaVersions.includes(packageV1.project.schemaVersion)) {
    addIssue(issues, 'error', 'project.schemaVersion', `Screen Interchange V1 requires project schema v${PROJECT_SCHEMA_VERSION_LEGACY} or v${PROJECT_SCHEMA_VERSION}.`);
  }
  validateDisplay(packageV1.project.display, 'project.display', issues);

  const screenIds = new Set<string>();
  for (const screenId of packageV1.project.screenOrder) {
    if (screenIds.has(screenId)) {
      addIssue(issues, 'error', `project.screenOrder.${screenId}`, 'Duplicate screen id in screen order.');
    }
    screenIds.add(screenId);
  }

  const actualScreenIds = new Set(packageV1.screens.map((screen) => screen.id));
  for (const screenId of screenIds) {
    if (!actualScreenIds.has(screenId)) {
      addIssue(issues, 'error', `screens.${screenId}`, 'Screen order references a missing screen.');
    }
  }
  for (const screen of packageV1.screens) {
    if (!screenIds.has(screen.id)) {
      addIssue(issues, 'warning', `screens.${screen.id}`, 'Screen exists outside project screen order.');
    }
    validateDisplay(screen.display, `screens.${screen.id}.display`, issues);
    validateScreenObjects(packageV1, screen.objects, screen.objectOrder, `screens.${screen.id}`, issues);
  }

  validateResourceClosure(packageV1, issues);

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues
  };
}

function validateScreenObjects(
  packageV1: ScreenInterchangeProjectV1,
  objects: readonly ScreenInterchangeObjectV1[],
  objectOrder: readonly string[],
  path: string,
  issues: ScreenInterchangeValidationIssue[]
): void {
  const seen = new Set<string>();
  objects.forEach((object, index) => {
    if (seen.has(object.id)) {
      addIssue(issues, 'error', `${path}.objects.${object.id}`, 'Duplicate object id in screen.');
    }
    seen.add(object.id);
    if (object.order !== index) {
      addIssue(issues, 'warning', `${path}.objects.${object.id}.order`, 'Object order differs from array index.');
    }
    if (objectOrder[index] !== object.id) {
      addIssue(issues, 'error', `${path}.objectOrder.${index}`, 'Object order does not match objects array.');
    }
    validateObjectResourceRefs(packageV1, object, `${path}.objects.${object.id}`, issues);
  });
  for (const objectId of objectOrder) {
    if (!seen.has(objectId)) {
      addIssue(issues, 'error', `${path}.objectOrder.${objectId}`, 'Object order references a missing object.');
    }
  }
}

function validateObjectResourceRefs(
  packageV1: ScreenInterchangeProjectV1,
  object: ScreenInterchangeObjectV1,
  path: string,
  issues: ScreenInterchangeValidationIssue[]
): void {
  for (const ref of object.resourceRefs) {
    if (!hasResource(packageV1, ref)) {
      addIssue(issues, 'error', `${path}.resourceRefs.${ref}`, 'Object references a missing resource.');
    }
  }
  if (object.type === 'bitmap' && !packageV1.resources.bitmaps[object.bitmapRef]) {
    addIssue(issues, 'error', `${path}.bitmapRef`, 'Bitmap object references a missing bitmap resource.');
  }
  if (object.type === 'special' && object.glyphOverrideRef && !packageV1.resources.glyphs[object.glyphOverrideRef]) {
    addIssue(issues, 'error', `${path}.glyphOverrideRef`, 'Special object references a missing glyph resource.');
  }
}

function validateResourceClosure(
  packageV1: ScreenInterchangeProjectV1,
  issues: ScreenInterchangeValidationIssue[]
): void {
  const referenced = new Set<string>();
  for (const screen of packageV1.screens) {
    for (const object of screen.objects) {
      object.resourceRefs.forEach((ref) => referenced.add(ref));
      if (object.type === 'bitmap') {
        referenced.add(object.bitmapRef);
      }
      if (object.type === 'special' && object.glyphOverrideRef) {
        referenced.add(object.glyphOverrideRef);
      }
    }
  }

  for (const ref of Object.keys(packageV1.resources.fonts)) {
    if (!referenced.has(ref)) {
      addIssue(issues, 'warning', `resources.fonts.${ref}`, 'Font resource is not referenced by exported screens.');
    }
  }
  for (const ref of Object.keys(packageV1.resources.glyphs)) {
    if (!referenced.has(ref)) {
      addIssue(issues, 'warning', `resources.glyphs.${ref}`, 'Glyph resource is not referenced by exported screens.');
    }
  }
  for (const ref of Object.keys(packageV1.resources.bitmaps)) {
    if (!referenced.has(ref)) {
      addIssue(issues, 'warning', `resources.bitmaps.${ref}`, 'Bitmap resource is not referenced by exported screens.');
    }
  }
}

function hasResource(packageV1: ScreenInterchangeProjectV1, ref: string): boolean {
  return Boolean(packageV1.resources.fonts[ref] ?? packageV1.resources.glyphs[ref] ?? packageV1.resources.bitmaps[ref]);
}

function validateDisplay(
  display: { width: number; height: number; colorMode: string; packing: string },
  path: string,
  issues: ScreenInterchangeValidationIssue[]
): void {
  if (!Number.isInteger(display.width) || display.width <= 0) {
    addIssue(issues, 'error', `${path}.width`, 'Display width must be a positive integer.');
  }
  if (!Number.isInteger(display.height) || display.height <= 0) {
    addIssue(issues, 'error', `${path}.height`, 'Display height must be a positive integer.');
  }
  if (display.colorMode !== 'monochrome') {
    addIssue(issues, 'error', `${path}.colorMode`, 'Only monochrome displays are supported in V1.');
  }
  if (display.packing !== 'vertical-lsb') {
    addIssue(issues, 'error', `${path}.packing`, 'Only vertical-lsb packing is supported in V1.');
  }
}

function addIssue(
  issues: ScreenInterchangeValidationIssue[],
  severity: ScreenInterchangeValidationIssue['severity'],
  path: string,
  message: string
): void {
  issues.push({
    id: `screen-interchange-${issues.length + 1}`,
    severity,
    path,
    message
  });
}

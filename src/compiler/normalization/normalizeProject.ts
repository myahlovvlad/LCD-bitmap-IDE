import { canonicalSerializeIr } from '../serialization/canonicalSerializeIr';
import { fingerprintIr } from '../serialization/fingerprintIr';
import type { CompilerTraceLink } from '../ir/traceability';
import { COMPILER_IR_VERSION } from '../ir/version';
import type { CompilerSourceSnapshot } from '../source/compilerSource';
import type { NormalizedCompilerIrResult } from '../ir/compilerIr';
import { validateCompilerSource } from '../validation/validateCompilerSource';
import { normalizeFsm } from './normalizeFsm';
import { normalizeLocalization, normalizeResources } from './normalizeLocalization';
import { normalizeScreens } from './normalizeScreens';
import { normalizeSymbols } from './normalizeSymbols';
import { getEncodedDisplayByteLength } from '../encoding/displayEncoder';
import { sanitizeCompilerSymbol } from '../ir/symbolTable';

export function normalizeProject(source: CompilerSourceSnapshot): NormalizedCompilerIrResult {
  const sourceDiagnostics = validateCompilerSource(source);
  const symbolResult = normalizeSymbols(source);
  const symbols = symbolResult.symbols;
  const screens = normalizeScreens(source, symbols);
  const fsm = normalizeFsm(source, symbols);
  const localization = normalizeLocalization(source);
  const resources = normalizeResources(source, symbols);
  const animations = normalizeAnimations(source);
  const diagnostics = [...sourceDiagnostics, ...symbolResult.diagnostics];
  const ir = {
    irVersion: COMPILER_IR_VERSION,
    source: {
      projectId: source.project.meta.id,
      projectName: source.project.meta.name,
      projectVersion: source.project.meta.version,
      projectSchemaVersion: source.project.meta.schemaVersion,
      sourceFingerprint: source.sourceFingerprint
    },
    display: {
      ...source.project.display,
      byteLength: getEncodedDisplayByteLength(source.project.display)
    },
    fsm,
    screens,
    localization,
    resources,
    animations,
    symbols,
    traceability: { links: collectTraceLinks(screens, fsm) }
  };
  const completeness = {
    stateCount: fsm.states.length,
    eventCount: fsm.events.length,
    transitionCount: fsm.transitions.length,
    screenCount: screens.length,
    canvasObjectCount: screens.reduce((count, screen) => count + screen.objects.length, 0),
    localizedTextCount: localization.entries.length,
    fontGlyphCount: resources.fontGlyphs.length,
    diagnosticCount: diagnostics.length
  };
  const canonicalJson = canonicalSerializeIr(ir);
  return {
    ir,
    diagnostics,
    completeness,
    canonicalJson,
    fingerprint: fingerprintIr(ir)
  };
}

function normalizeAnimations(source: CompilerSourceSnapshot) {
  const catalog = source.project.animations ?? { resources: {}, order: [] };
  const resources = catalog.order
    .map((id) => catalog.resources[id])
    .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource))
    .map((resource, index) => ({
      id: resource.id,
      symbol: uniqueAnimationSymbol(resource.id, index, catalog.order),
      loop: resource.loop,
      frames: resource.frames.map((frame) => ({ id: frame.id, bytes: [...frame.bytes], durationMs: frame.durationMs }))
    }));
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const bindings = source.project.screenOrder.flatMap((screenId) => {
    const screen = source.project.screens[screenId];
    if (!screen) return [];
    return [
      ...(screen.animationId && resourceIds.has(screen.animationId)
        ? [{ screenId: screen.id, objectId: null, animationId: screen.animationId }]
        : []),
      ...screen.objects.flatMap((object) => object.type === 'bitmap' && object.animationId && resourceIds.has(object.animationId)
        ? [{ screenId: screen.id, objectId: object.id, animationId: object.animationId }]
        : [])
    ];
  });
  return { resources, bindings };
}

function uniqueAnimationSymbol(id: string, index: number, order: readonly string[]): string {
  const base = sanitizeCompilerSymbol(id, 'animation');
  return order.slice(0, index).some((previous) => sanitizeCompilerSymbol(previous, 'animation') === base)
    ? `${base}_${index + 1}`
    : base;
}

function collectTraceLinks(
  screens: ReturnType<typeof normalizeScreens>,
  fsm: ReturnType<typeof normalizeFsm>
): CompilerTraceLink[] {
  return [
    ...screens.flatMap((screen, index) => [
      { irPath: `/screens/${index}`, sourceType: 'screen' as const, sourceId: screen.id, sourcePath: screen.sourcePath },
      ...screen.objects.map((object, objectIndex) => ({
        irPath: `/screens/${index}/objects/${objectIndex}`,
        sourceType: 'canvas-object' as const,
        sourceId: object.id,
        sourcePath: object.sourcePath
      }))
    ]),
    ...fsm.states.map((state, index) => ({
      irPath: `/fsm/states/${index}`,
      sourceType: 'fsm-state' as const,
      sourceId: state.id,
      sourcePath: state.sourcePath
    })),
    ...fsm.events.map((event, index) => ({
      irPath: `/fsm/events/${index}`,
      sourceType: 'fsm-event' as const,
      sourceId: event.id,
      sourcePath: event.sourcePath
    })),
    ...fsm.transitions.map((transition, index) => ({
      irPath: `/fsm/transitions/${index}`,
      sourceType: 'fsm-transition' as const,
      sourceId: transition.id,
      sourcePath: transition.sourcePath
    }))
  ];
}

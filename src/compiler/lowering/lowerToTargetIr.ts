import { FontRenderer, type FontGlyphs, type LanguageCode } from '../../domain';
import type { NormalizedCompilerIrV1 } from '../ir/compilerIr';
import type { CompilerTargetProfile } from '../profiles/targetProfile';
import type { LoweredScreenIr, LoweredTargetIrV1 } from '../target-ir/targetIr';
import { TARGET_IR_VERSION } from '../target-ir/targetIr';
import { packFrameBufferVerticalLsb, renderLoweredScreenObjects } from './rendering';

export interface LowerToTargetIrOptions {
  readonly language: LanguageCode;
  readonly targetProfile: CompilerTargetProfile;
  readonly fontGlyphs?: FontGlyphs;
}

export function lowerToTargetIr(ir: NormalizedCompilerIrV1, options: LowerToTargetIrOptions): LoweredTargetIrV1 {
  const fontRenderer = options.fontGlyphs ? new FontRenderer(options.fontGlyphs) : undefined;
  const screens = ir.screens.map((screen): LoweredScreenIr => {
    const frameBuffer = renderLoweredScreenObjects(screen.objects, {
      language: options.language,
      width: screen.width,
      height: screen.height,
      fontRenderer
    });
    const framebufferBytes = packFrameBufferVerticalLsb(frameBuffer, screen.width, screen.height);
    return {
      id: screen.id,
      order: screen.order,
      width: screen.width,
      height: screen.height,
      symbol: screen.symbol,
      sourcePath: screen.sourcePath,
      objects: screen.objects,
      byteLength: framebufferBytes.length,
      framebufferBytes
    };
  });

  return {
    targetIrVersion: TARGET_IR_VERSION,
    sourceIrVersion: ir.irVersion,
    sourceFingerprint: ir.source.sourceFingerprint,
    targetProfile: options.targetProfile,
    language: options.language,
    project: {
      id: ir.source.projectId,
      name: ir.source.projectName,
      version: ir.source.projectVersion
    },
    screens,
    fsm: {
      stateCount: ir.fsm.states.length,
      eventCount: ir.fsm.events.length,
      transitionCount: ir.fsm.transitions.length
    },
    resources: {
      fontGlyphCount: ir.resources.fontGlyphs.length
    },
    memory: {
      screenCount: screens.length,
      totalScreenBytes: screens.reduce((sum, screen) => sum + screen.byteLength, 0),
      maxScreenBytes: screens.reduce((max, screen) => Math.max(max, screen.byteLength), 0)
    }
  };
}

import type { LanguageCode } from '../../domain';
import type { NormalizedCanvasObjectIr } from '../ir/screenIr';
import type { CompilerTargetProfile } from '../profiles/targetProfile';
import type { CanonicalRaster } from '../raster/canonicalRaster';

export const TARGET_IR_VERSION = 1 as const;
export type TargetIrVersion = typeof TARGET_IR_VERSION;

export interface LoweredTargetIrV1 {
  readonly targetIrVersion: TargetIrVersion;
  readonly sourceIrVersion: number;
  readonly sourceFingerprint?: string;
  readonly targetProfile: CompilerTargetProfile;
  readonly language: LanguageCode;
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
  };
  readonly screens: readonly LoweredScreenIr[];
  readonly fsm: {
    readonly stateCount: number;
    readonly eventCount: number;
    readonly transitionCount: number;
  };
  readonly resources: {
    readonly fontGlyphCount: number;
  };
  readonly animations: {
    readonly resources: readonly LoweredAnimationIr[];
    readonly bindings: readonly LoweredAnimationBindingIr[];
  };
  readonly memory: {
    readonly screenCount: number;
    readonly totalScreenBytes: number;
    readonly maxScreenBytes: number;
  };
}

export interface LoweredAnimationIr {
  readonly id: string;
  readonly symbol: string;
  readonly loop: boolean;
  readonly frames: readonly LoweredAnimationFrameIr[];
}

export interface LoweredAnimationFrameIr {
  readonly id: string;
  readonly bytes: readonly number[];
  readonly durationMs: number;
}

export interface LoweredAnimationBindingIr {
  readonly screenId: string;
  readonly objectId: string | null;
  readonly animationId: string;
}

export interface LoweredScreenIr {
  readonly id: string;
  readonly order: number;
  readonly width: number;
  readonly height: number;
  readonly symbol: string;
  readonly sourcePath: string;
  readonly objects: readonly NormalizedCanvasObjectIr[];
  readonly byteLength: number;
  readonly canonicalRaster: CanonicalRaster;
  readonly framebufferBytes: readonly number[];
}

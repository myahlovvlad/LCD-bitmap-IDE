import type { LanguageCode } from '../../domain';
import type { NormalizedCanvasObjectIr } from '../ir/screenIr';
import type { CompilerTargetProfile } from '../profiles/targetProfile';

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
  readonly memory: {
    readonly screenCount: number;
    readonly totalScreenBytes: number;
    readonly maxScreenBytes: number;
  };
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
  readonly framebufferBytes: readonly number[];
}

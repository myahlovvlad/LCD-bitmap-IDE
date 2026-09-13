import type { DisplayProfile } from '../../domain/displayProfile';

export type CompilerDisplayPacking = DisplayProfile['packing'];

export interface CompilerTargetProfile {
  readonly id: string;
  readonly version: number;
  readonly display: DisplayProfile & {
    readonly byteLength: number;
  };
  readonly codegen: {
    readonly cArrayBytesPerRow: number;
    readonly allScreensTableByteLength: number;
    readonly includeHeaderGuardSuffix: string;
    readonly structName: string;
  };
  readonly symbolPrefix?: string;
}

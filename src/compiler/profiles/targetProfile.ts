export type CompilerDisplayPacking = 'vertical-lsb';

export interface CompilerTargetProfile {
  readonly id: string;
  readonly version: number;
  readonly display: {
    readonly colorMode: 'monochrome';
    readonly packing: CompilerDisplayPacking;
    readonly width: number;
    readonly height: number;
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

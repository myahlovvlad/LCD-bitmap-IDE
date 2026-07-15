import type { LanguageCode } from '../../domain';
import type { CodegenArtifactSet } from '../artifacts/codegenArtifacts';
import type { LoweredTargetIrV1 } from '../target-ir/targetIr';

export interface CodegenBackend {
  readonly id: string;
  readonly targetProfileId: string;
  generate(targetIr: LoweredTargetIrV1, request: CodegenRequest): CodegenArtifactSet;
}

export type CodegenArtifactScope = 'selected-screen' | 'all-screens';

export interface CodegenRequest {
  readonly scope: CodegenArtifactScope;
  readonly language: LanguageCode;
  readonly projectSymbolName?: string;
  readonly selectedScreenId?: string;
  readonly selectedSymbolName?: string;
}

export class CodegenBackendRegistry {
  private readonly backends = new Map<string, CodegenBackend>();

  register(backend: CodegenBackend): void {
    this.backends.set(backend.id, backend);
  }

  get(id: string): CodegenBackend {
    const backend = this.backends.get(id);
    if (!backend) {
      throw new Error(`Codegen backend is not registered: ${id}`);
    }
    return backend;
  }
}

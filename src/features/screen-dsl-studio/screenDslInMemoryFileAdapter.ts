import type { ScreenDslFileAdapter } from './screenDslFileAdapter';
import type {
  OpenScreenDslFileResult,
  SaveScreenDslFileRequest,
  SaveScreenDslFileResult
} from '../../shared/screenDslFiles/contracts';

/**
 * Controllable in-memory file adapter for Vitest integration tests.
 * Records calls and returns preset results — no Electron or filesystem.
 */
export class ScreenDslInMemoryFileAdapter implements ScreenDslFileAdapter {
  private _openResult: OpenScreenDslFileResult = { cancelled: true };
  private _saveResult: SaveScreenDslFileResult = { cancelled: true };

  readonly openCalls: number[] = [];
  readonly saveCalls: SaveScreenDslFileRequest[] = [];

  setOpenResult(result: OpenScreenDslFileResult): void {
    this._openResult = result;
  }

  setSaveResult(result: SaveScreenDslFileResult): void {
    this._saveResult = result;
  }

  reset(): void {
    this._openResult = { cancelled: true };
    this._saveResult = { cancelled: true };
    this.openCalls.length = 0;
    this.saveCalls.length = 0;
  }

  async open(): Promise<OpenScreenDslFileResult> {
    this.openCalls.push(Date.now());
    return this._openResult;
  }

  async save(request: SaveScreenDslFileRequest): Promise<SaveScreenDslFileResult> {
    this.saveCalls.push(request);
    return this._saveResult;
  }
}

/**
 * Atomic file write utility for Screen DSL file save operations.
 * Main-process only — uses Node.js fs/promises.
 *
 * Strategy:
 * 1. Create a unique temporary sibling file (target.tmp.<random>)
 * 2. Write complete UTF-8 bytes
 * 3. Close/flush (writeFile handles this)
 * 4. Rename temp → target (atomic on POSIX; near-atomic on Windows NTFS)
 * 5. Cleanup temp on failure
 *
 * Invariants:
 * - temp filename is unique (randomUUID suffix), never fixed
 * - partial content never appears at target path
 * - path comes from dialog result — renderer never supplies it
 * - cleanup is best-effort on failure
 */

import { writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AtomicWriteResult {
  readonly ok: boolean;
  readonly byteLength?: number;
  readonly errorCode?: string;
  readonly message?: string;
}

/**
 * Atomically write UTF-8 content to the target path.
 * The caller must have verified that targetPath came from a dialog result.
 */
export async function atomicWriteUtf8(targetPath: string, content: string): Promise<AtomicWriteResult> {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.tmp.${randomUUID()}`);
  const bytes = Buffer.from(content, 'utf-8');

  try {
    await writeFile(tempPath, bytes);
  } catch (err: unknown) {
    // Cleanup not needed — write failed before temp was created/written fully
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errorCode: 'WRITE_FAILED', message };
  }

  try {
    await rename(tempPath, targetPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Cleanup temp file best-effort
    await unlink(tempPath).catch(() => { /* best-effort */ });
    return { ok: false, errorCode: 'RENAME_FAILED', message };
  }

  return { ok: true, byteLength: bytes.length };
}

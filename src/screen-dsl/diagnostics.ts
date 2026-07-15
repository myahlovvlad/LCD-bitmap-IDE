import type { ScreenDslDiagnostic } from './model';

export function screenDslError(code: string, message: string, path = '$', line?: number, column?: number): ScreenDslDiagnostic {
  return { code, severity: 'error', message, path, line, column };
}

export function screenDslWarning(code: string, message: string, path = '$'): ScreenDslDiagnostic {
  return { code, severity: 'warning', message, path };
}

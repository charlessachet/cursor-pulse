import * as vscode from 'vscode';
import { sanitizeDiagnosticsValue } from './diagnosticsSanitizer';

export interface Diagnostics {
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
  dispose(): void;
}

function sanitize(value: unknown): string {
  const sanitized = sanitizeDiagnosticsValue(value);
  return typeof sanitized === 'string' ? sanitized : sanitized === undefined ? '' : JSON.stringify(sanitized, null, 2);
}

export function createDiagnostics(): Diagnostics {
  const output = vscode.window.createOutputChannel('CursorPulse');

  const write = (level: 'INFO' | 'WARN' | 'ERROR', message: string, extra?: unknown): void => {
    output.appendLine(`[${level}] ${message}`);
    if (extra !== undefined) {
      const sanitized = sanitize(extra);
      if (sanitized) {
        output.appendLine(sanitized);
      }
    }
  };

  return {
    info(message, extra) {
      write('INFO', message, extra);
    },
    warn(message, extra) {
      write('WARN', message, extra);
    },
    error(message, extra) {
      write('ERROR', message, extra);
    },
    dispose() {
      output.dispose();
    },
  };
}

import * as vscode from 'vscode';

const SESSION_TOKEN_KEY = 'cursorPulse.sessionToken';

export class SessionTokenStore {
  public constructor(private readonly secretStorage: vscode.SecretStorage) {}

  public async getToken(): Promise<string | undefined> {
    const token = await this.secretStorage.get(SESSION_TOKEN_KEY);
    return token?.trim() || undefined;
  }

  public async setToken(token: string): Promise<void> {
    await this.secretStorage.store(SESSION_TOKEN_KEY, token);
  }

  public async clearToken(): Promise<void> {
    await this.secretStorage.delete(SESSION_TOKEN_KEY);
  }
}

export function parseSessionToken(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const cookieMatch = trimmed.match(/WorkosCursorSessionToken=([^;\s]+)/i);
  if (cookieMatch?.[1]) {
    return cookieMatch[1];
  }

  if (/\s/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}


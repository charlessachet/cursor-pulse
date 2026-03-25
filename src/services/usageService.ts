import * as vscode from 'vscode';
import {
  CursorClientError,
  CursorPersonalUsagePayload,
  CursorPulseDiagnosticsReport,
  CursorPulseSnapshot,
  CursorPulseViewState,
  RefreshResult,
} from '../client/types';
import { CursorClient } from '../client/cursorClient';
import type { Diagnostics } from '../infra/diagnostics';
import { sanitizeDiagnosticsValue } from '../infra/diagnosticsSanitizer';
import { SessionTokenStore } from '../infra/secrets';
import { mapUsagePayloadToSnapshot } from './usageMapper';

const LAST_SNAPSHOT_KEY = 'cursorPulse.lastSnapshot';
const RETRY_DELAY_MS = 30_000;

export class UsageService {
  private lastRawPayload?: CursorPersonalUsagePayload;
  private lastError?: CursorPulseDiagnosticsReport['lastError'];

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tokenStore: SessionTokenStore,
    private readonly client: CursorClient,
    private readonly diagnostics: Diagnostics,
  ) {}

  public async getInitialState(): Promise<CursorPulseViewState> {
    const token = await this.tokenStore.getToken();
    if (!token) {
      return {
        hasToken: false,
        message: 'Set your Cursor session token to get started.',
      };
    }

    const cachedSnapshot = await this.getSavedSnapshot();
    if (cachedSnapshot) {
      return {
        hasToken: true,
        snapshot: {
          ...cachedSnapshot,
          status: 'stale',
        },
        message: 'Using your last good snapshot while Cursor sync catches up.',
      };
    }

    return {
      hasToken: true,
      snapshot: createEmptySnapshot('loading'),
    };
  }

  public async refresh(): Promise<RefreshResult> {
    const token = await this.tokenStore.getToken();
    if (!token) {
      return {
        state: {
          hasToken: false,
          message: 'Set your Cursor session token to get started.',
        },
      };
    }

    try {
      const payload = await this.client.fetchPersonalUsage(token);
      const snapshot = mapUsagePayloadToSnapshot(payload);
      this.lastRawPayload = sanitizeDiagnosticsValue(payload);
      this.lastError = undefined;

      await this.saveSnapshot(snapshot);

      return {
        state: {
          hasToken: true,
          snapshot,
        },
      };
    } catch (error) {
      return this.handleRefreshError(error);
    }
  }

  public async clearCachedSnapshot(): Promise<void> {
    await this.context.globalState.update(LAST_SNAPSHOT_KEY, undefined);
  }

  public async buildDiagnosticsReport(
    currentState?: CursorPulseViewState,
  ): Promise<CursorPulseDiagnosticsReport> {
    const token = await this.tokenStore.getToken();
    const lastSuccessfulSnapshot = await this.getSavedSnapshot();

    return sanitizeDiagnosticsValue({
      exportedAt: new Date().toISOString(),
      hasToken: Boolean(token),
      currentState,
      lastSuccessfulSnapshot,
      lastRawPayload: this.lastRawPayload,
      lastError: this.lastError,
    });
  }

  private async handleRefreshError(error: unknown): Promise<RefreshResult> {
    const cachedSnapshot = await this.getSavedSnapshot();

    if (error instanceof CursorClientError) {
      this.lastError = {
        kind: 'cursor_client',
        message: error.message,
        statusCode: error.statusCode,
      };
      this.diagnostics.warn('Cursor refresh failed.', { kind: error.kind, statusCode: error.statusCode });

      if (error.kind === 'auth') {
        return {
          state: {
            hasToken: true,
            snapshot: createEmptySnapshot('auth_error'),
            message: 'Session expired. Run CursorPulse: Set Session Token.',
          },
        };
      }

      if (error.kind === 'network' && cachedSnapshot) {
        return {
          state: {
            hasToken: true,
            snapshot: {
              ...cachedSnapshot,
              status: 'stale',
            },
            message: 'Showing last successful snapshot.',
          },
          retryAfterMs: RETRY_DELAY_MS,
        };
      }

      if (error.kind === 'parse' && cachedSnapshot) {
        return {
          state: {
            hasToken: true,
            snapshot: {
              ...cachedSnapshot,
              status: 'stale',
            },
            message: 'Showing last successful snapshot.',
          },
        };
      }

      return {
        state: {
          hasToken: true,
          snapshot: createEmptySnapshot('fetch_error'),
          message:
            error.kind === 'parse'
              ? 'Could not parse Cursor usage response.'
              : 'Unable to refresh Cursor usage right now.',
        },
        retryAfterMs: error.kind === 'network' ? RETRY_DELAY_MS : undefined,
      };
    }

    this.lastError = {
      kind: 'unexpected',
      message: String(error),
    };
    this.diagnostics.error('Unexpected refresh failure.', { error: String(error) });

    if (cachedSnapshot) {
      return {
        state: {
          hasToken: true,
          snapshot: {
            ...cachedSnapshot,
            status: 'stale',
          },
          message: 'Showing last successful snapshot.',
        },
        retryAfterMs: RETRY_DELAY_MS,
      };
    }

    return {
      state: {
        hasToken: true,
        snapshot: createEmptySnapshot('fetch_error'),
        message: 'Unable to refresh Cursor usage right now.',
      },
      retryAfterMs: RETRY_DELAY_MS,
    };
  }

  private async saveSnapshot(snapshot: CursorPulseSnapshot): Promise<void> {
    await this.context.globalState.update(LAST_SNAPSHOT_KEY, snapshot);
  }

  private async getSavedSnapshot(): Promise<CursorPulseSnapshot | undefined> {
    return this.context.globalState.get<CursorPulseSnapshot>(LAST_SNAPSHOT_KEY);
  }
}

function createEmptySnapshot(status: CursorPulseSnapshot['status']): CursorPulseSnapshot {
  return {
    source: 'personal',
    fetchedAt: new Date().toISOString(),
    included: {},
    spend: {},
    activity: {},
    status,
  };
}

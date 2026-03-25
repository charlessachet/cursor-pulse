import * as assert from 'node:assert/strict';
import { CursorClientError, CursorPulseSnapshot, CursorPulseViewState } from '../../src/client/types';
import { UsageService } from '../../src/services/usageService';

suite('UsageService', () => {
  const baseSnapshot: CursorPulseSnapshot = {
    source: 'personal',
    fetchedAt: '2026-03-24T10:42:00.000Z',
    included: {
      total: 500,
      used: 253,
      remaining: 247,
      percentUsed: 0.506,
      resetDate: '2026-04-01T00:00:00.000Z',
    },
    spend: {
      used: 1.52,
      limit: 150,
      remaining: 148.48,
      percentUsed: 0.0101,
    },
    activity: {
      avgPerDay: 8.7,
      beyondIncludedCount: 34,
    },
    status: 'ok',
  };

  test('returns sign-in state when no token is stored', async () => {
    const service = new UsageService(
      fakeContext(),
      fakeTokenStore(undefined),
      fakeClient(baseSnapshot),
      fakeDiagnostics(),
    );

    const result = await service.refresh();
    assert.equal(result.state.hasToken, false);
    assert.equal(result.state.message, 'Set your Cursor session token to get started.');
  });

  test('uses cached snapshot on startup when available', async () => {
    const service = new UsageService(
      fakeContext(baseSnapshot),
      fakeTokenStore('abc%3A%3Arest'),
      fakeClient(baseSnapshot),
      fakeDiagnostics(),
    );

    const state = await service.getInitialState();
    assert.equal(state.hasToken, true);
    assert.equal(state.snapshot?.status, 'stale');
    assert.equal(state.snapshot?.included.remaining, 247);
  });

  test('returns auth state on auth errors', async () => {
    const service = new UsageService(
      fakeContext(),
      fakeTokenStore('abc%3A%3Arest'),
      fakeThrowingClient(new CursorClientError('auth', 'nope')),
      fakeDiagnostics(),
    );

    const result = await service.refresh();
    assert.equal(result.state.snapshot?.status, 'auth_error');
  });

  test('falls back to stale cache on transient errors', async () => {
    const context = fakeContext(baseSnapshot);
    const service = new UsageService(
      context,
      fakeTokenStore('abc%3A%3Arest'),
      fakeThrowingClient(new CursorClientError('network', 'offline')),
      fakeDiagnostics(),
    );

    const result = await service.refresh();
    assert.equal(result.state.snapshot?.status, 'stale');
    assert.equal(result.retryAfterMs, 30000);
  });

  test('does not retry automatically on generic http errors', async () => {
    const service = new UsageService(
      fakeContext(baseSnapshot),
      fakeTokenStore('abc%3A%3Arest'),
      fakeThrowingClient(new CursorClientError('http', 'bad gateway', 502)),
      fakeDiagnostics(),
    );

    const result = await service.refresh();
    assert.equal(result.state.snapshot?.status, 'fetch_error');
    assert.equal(result.retryAfterMs, undefined);
  });

  test('builds a sanitized diagnostics report', async () => {
    const context = fakeContext(baseSnapshot);
    const service = new UsageService(
      context,
      fakeTokenStore('abc%3A%3Arest'),
      fakeClient(baseSnapshot),
      fakeDiagnostics(),
    );

    await service.refresh();

    const report = await service.buildDiagnosticsReport({
      hasToken: true,
      snapshot: baseSnapshot,
    });

    assert.equal(report.hasToken, true);
    assert.equal(report.lastSuccessfulSnapshot?.included.remaining, 247);
    assert.equal(report.lastRawPayload?.auth?.email, '<redacted>');
    assert.equal(report.lastRawPayload?.auth?.sub, '<redacted>');
    assert.equal(report.lastRawPayload?.team?.member?.userId, '<redacted>');
  });
});

function fakeContext(initialSnapshot?: CursorPulseSnapshot) {
  const store = new Map<string, unknown>();
  if (initialSnapshot) {
    store.set('cursorPulse.lastSnapshot', initialSnapshot);
  }

  return {
    globalState: {
      get<T>(key: string): T | undefined {
        return store.get(key) as T | undefined;
      },
      async update(key: string, value: unknown): Promise<void> {
        if (value === undefined) {
          store.delete(key);
          return;
        }

        store.set(key, value);
      },
    },
  } as never;
}

function fakeTokenStore(token: string | undefined) {
  return {
    async getToken(): Promise<string | undefined> {
      return token;
    },
  } as never;
}

function fakeClient(snapshot: CursorPulseSnapshot) {
  return {
    async fetchPersonalUsage() {
      return {
        auth: {
          email: 'person@company.com',
          sub: 'user_123',
          name: 'Charles',
        },
        usage: {
          'gpt-4': {
            numRequests: snapshot.included.used,
            maxRequestUsage: snapshot.included.total,
          },
          startOfMonth: '2026-03-01T00:00:00.000Z',
        },
        hardLimit: {
          hardLimit: snapshot.spend.limit,
        },
        invoice: {
          items: [
            {
              description: `${snapshot.activity.beyondIncludedCount} token-based usage calls to claude-4-sonnet, totalling: $${snapshot.spend.used?.toFixed(2)}`,
              cents: Math.round((snapshot.spend.used ?? 0) * 100),
            },
          ],
        },
        cycleStart: '2026-03-01T00:00:00.000Z',
        team: {
          id: 42,
          member: {
            userId: 99,
            fastPremiumRequests: snapshot.included.used,
            spendCents: Math.round((snapshot.spend.used ?? 0) * 100),
            hardLimitOverrideDollars: snapshot.spend.limit,
          },
        },
      };
    },
  } as never;
}

function fakeThrowingClient(error: Error) {
  return {
    async fetchPersonalUsage() {
      throw error;
    },
  } as never;
}

function fakeDiagnostics() {
  return {
    info() {},
    warn() {},
    error() {},
    dispose() {},
  } as never;
}

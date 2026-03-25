import * as assert from 'node:assert/strict';
import { CursorClient, extractUserIdFromToken } from '../../src/client/cursorClient';
import { CursorClientError } from '../../src/client/types';

suite('CursorClient', () => {
  const originalFetch = global.fetch;

  teardown(() => {
    global.fetch = originalFetch;
  });

  test('extractUserIdFromToken returns the token prefix', () => {
    assert.equal(extractUserIdFromToken('abc123%3A%3Arest'), 'abc123');
  });

  test('extractUserIdFromToken rejects invalid tokens', () => {
    assert.throws(() => extractUserIdFromToken('abc123'), CursorClientError);
  });

  test('fetchPersonalUsage fetches team usage and filtered daily events', async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const responses = [
      jsonResponse({ id: 209260840, sub: 'user_123' }),
      jsonResponse({ startOfMonth: '2026-03-01T00:00:00.000Z', 'gpt-4': { numRequests: 0 } }),
      jsonResponse({ noUsageBasedAllowed: true }),
      jsonResponse({ pricingDescription: { id: 'abc' } }),
      jsonResponse({ teams: [{ id: 2542093 }] }),
      jsonResponse({ userId: 209260840 }),
      jsonResponse({
        teamMemberSpend: [
          {
            userId: 209260840,
            spendCents: 107299,
            includedSpendCents: 11852,
          },
        ],
      }),
      jsonResponse({
        totalUsageEventsCount: 2,
        usageEventsDisplay: [
          { timestamp: '1774398791362', model: 'default', chargedCents: 4.5 },
          { timestamp: '1774394396462', model: 'composer-2', chargedCents: 10.5 },
        ],
      }),
    ];

    global.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      const next = responses.shift();
      if (!next) {
        throw new Error('Unexpected extra request');
      }

      return next as Response;
    }) as typeof global.fetch;

    const client = new CursorClient(fakeDiagnostics());
    const payload = await client.fetchPersonalUsage('abc%3A%3Arest');

    assert.equal(payload.team?.id, 2542093);
    assert.equal(payload.team?.member?.spendCents, 107299);
    assert.equal(payload.filteredUsageEvents?.usageEventsDisplay?.length, 2);
    assert.equal(requests.at(-1)?.url, 'https://cursor.com/api/dashboard/get-filtered-usage-events');
    assert.match(requests.at(-1)?.body ?? '', /"teamId":2542093/);
    assert.match(requests.at(-1)?.body ?? '', /"userId":209260840/);
    assert.match(requests.at(-1)?.body ?? '', /"pageSize":500/);
  });

  test('fetchPersonalUsage surfaces auth failures', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 401,
      async json() {
        return {};
      },
    })) as unknown as typeof global.fetch;

    const client = new CursorClient(fakeDiagnostics());
    await assert.rejects(() => client.fetchPersonalUsage('abc%3A%3Arest'), (error: unknown) => {
      assert.ok(error instanceof CursorClientError);
      assert.equal(error.kind, 'auth');
      return true;
    });
  });

  test('fetchPersonalUsage surfaces network failures', async () => {
    global.fetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof global.fetch;

    const client = new CursorClient(fakeDiagnostics());
    await assert.rejects(() => client.fetchPersonalUsage('abc%3A%3Arest'), (error: unknown) => {
      assert.ok(error instanceof CursorClientError);
      assert.equal(error.kind, 'network');
      return true;
    });
  });

  test('fetchPersonalUsage tolerates filtered usage failures', async () => {
    const responses = [
      jsonResponse({ id: 209260840, sub: 'user_123' }),
      jsonResponse({ startOfMonth: '2026-03-01T00:00:00.000Z', 'gpt-4': { numRequests: 0 } }),
      jsonResponse({ noUsageBasedAllowed: true }),
      jsonResponse({ pricingDescription: { id: 'abc' } }),
      jsonResponse({ teams: [{ id: 2542093 }] }),
      jsonResponse({ userId: 209260840 }),
      jsonResponse({
        teamMemberSpend: [
          {
            userId: 209260840,
            spendCents: 107299,
            includedSpendCents: 11852,
          },
        ],
      }),
      {
        ok: false,
        status: 500,
        async json() {
          return {};
        },
      },
    ];

    global.fetch = (async () => {
      const next = responses.shift();
      if (!next) {
        throw new Error('Unexpected extra request');
      }

      return next as Response;
    }) as typeof global.fetch;

    const diagnosticsMessages: string[] = [];
    const client = new CursorClient({
      info(message: string) {
        diagnosticsMessages.push(message);
      },
      warn() {},
      error() {},
      dispose() {},
    });

    const payload = await client.fetchPersonalUsage('abc%3A%3Arest');
    assert.equal(payload.filteredUsageEvents, undefined);
    assert.equal(
      diagnosticsMessages.includes(
        'Filtered daily usage events were unavailable; continuing without daily history.',
      ),
      true,
    );
  });
});

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 200,
    async json() {
      return value;
    },
  } as Response;
}

function fakeDiagnostics() {
  return {
    info() {},
    warn() {},
    error() {},
    dispose() {},
  };
}

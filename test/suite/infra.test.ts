import * as assert from 'node:assert/strict';
import mock = require('mock-require');
import { sanitizeDiagnosticsValue } from '../../src/infra/diagnosticsSanitizer';
import { SessionTokenStore } from '../../src/infra/secrets';

suite('infra', () => {
  teardown(() => {
    mock.stopAll();
  });

  test('SessionTokenStore trims values and clears them', async () => {
    const store = new Map<string, string>();
    const tokenStore = new SessionTokenStore({
      async get(key: string) {
        return store.get(key);
      },
      async store(key: string, value: string) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
    } as never);

    await tokenStore.setToken(' abc%3A%3Arest ');
    assert.equal(await tokenStore.getToken(), 'abc%3A%3Arest');

    await tokenStore.clearToken();
    assert.equal(await tokenStore.getToken(), undefined);
  });

  test('sanitizeDiagnosticsValue redacts nested sensitive values', () => {
    const sanitized = sanitizeDiagnosticsValue({
      token: 'abc',
      cookie: 'WorkosCursorSessionToken=secret',
      nested: {
        email: 'person@example.com',
        items: ['WorkosCursorSessionToken=another'],
      },
    });

    assert.deepEqual(sanitized, {
      token: '<redacted>',
      cookie: '<redacted>',
      nested: {
        email: '<redacted>',
        items: ['WorkosCursorSessionToken=<redacted>'],
      },
    });
  });

  test('createDiagnostics writes sanitized output', () => {
    const lines: string[] = [];
    let disposed = false;
    mock('vscode', {
      window: {
        createOutputChannel() {
          return {
            appendLine(line: string) {
              lines.push(line);
            },
            dispose() {
              disposed = true;
            },
          };
        },
      },
    });

    const { createDiagnostics } = require('../../src/infra/diagnostics');
    const diagnostics = createDiagnostics();
    diagnostics.info('hello', { token: 'abc', cookie: 'WorkosCursorSessionToken=secret' });
    diagnostics.warn('warn');
    diagnostics.error('error', 'WorkosCursorSessionToken=secret');
    diagnostics.dispose();

    assert.deepEqual(lines, [
      '[INFO] hello',
      JSON.stringify({ token: '<redacted>', cookie: '<redacted>' }, null, 2),
      '[WARN] warn',
      '[ERROR] error',
      'WorkosCursorSessionToken=<redacted>',
    ]);
    assert.equal(disposed, true);
  });

  test('RefreshScheduler schedules intervals and retries', async () => {
    const intervals: Array<{ fn: () => void; delay: number }> = [];
    const timeouts: Array<{ fn: () => void; delay: number }> = [];
    const clearedIntervals: unknown[] = [];
    const clearedTimeouts: unknown[] = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    global.setInterval = ((fn: TimerHandler, delay?: number) => {
      const handle = { kind: 'interval', delay };
      intervals.push({ fn: fn as () => void, delay: delay ?? 0 });
      return handle as never;
    }) as unknown as typeof global.setInterval;
    global.clearInterval = ((handle: unknown) => {
      clearedIntervals.push(handle);
    }) as typeof global.clearInterval;
    global.setTimeout = ((fn: TimerHandler, delay?: number) => {
      const handle = { kind: 'timeout', delay };
      timeouts.push({ fn: fn as () => void, delay: delay ?? 0 });
      return handle as never;
    }) as unknown as typeof global.setTimeout;
    global.clearTimeout = ((handle: unknown) => {
      clearedTimeouts.push(handle);
    }) as typeof global.clearTimeout;

    try {
      const { RefreshScheduler } = require('../../src/infra/scheduler');
      const refreshCalls: number[] = [];
      const infoMessages: string[] = [];
      const scheduler = new RefreshScheduler(
        () => ({
          pollMinutes: 15,
          displayMode: 'compact',
          showUnlimitedActivity: true,
          showModelAnalytics: true,
          warningThresholdSpend: 0.8,
          warningThresholdIncluded: 0.1,
        }),
        async () => {
          refreshCalls.push(Date.now());
          return {
            state: { hasToken: true },
            retryAfterMs: refreshCalls.length === 1 ? 5_000 : undefined,
          };
        },
        {
          info(message: string) {
            infoMessages.push(message);
          },
          warn() {},
          error() {},
          dispose() {},
        },
      );

      scheduler.start();
      assert.equal(intervals[0]?.delay, 900_000);
      assert.deepEqual(infoMessages, ['Scheduled refresh every 15 minute(s).']);

      await scheduler.triggerImmediate();
      assert.equal(timeouts[0]?.delay, 5_000);

      scheduler.restart();
      assert.ok(clearedIntervals.length >= 1);
      assert.ok(clearedTimeouts.length >= 1);

      intervals.at(-1)?.fn();
      assert.equal(refreshCalls.length, 2);

      scheduler.stop();
      assert.ok(clearedIntervals.length >= 2);
    } finally {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });
});

import * as assert from 'node:assert/strict';
import { CursorPulseConfig, CursorPulseViewState } from '../../src/client/types';
import { applyStatusBarState, getStatusBarCommand, renderStatusBarText } from '../../src/ui/statusBar';

const config: CursorPulseConfig = {
  pollMinutes: 15,
  displayMode: 'compact',
  showUnlimitedActivity: true,
  showModelAnalytics: true,
  warningThresholdSpend: 0.8,
  warningThresholdIncluded: 0.1,
};

suite('renderStatusBarText', () => {
  test('uses set-token command when signed out', () => {
    assert.equal(
      getStatusBarCommand({
        hasToken: false,
      }),
      'cursorPulse.setSessionToken',
    );
  });

  test('uses set-token command for auth errors', () => {
    assert.equal(
      getStatusBarCommand({
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          status: 'auth_error',
        },
      }),
      'cursorPulse.setSessionToken',
    );
  });

  test('uses refresh command for healthy states', () => {
    assert.equal(
      getStatusBarCommand({
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          status: 'ok',
        },
      }),
      'cursorPulse.refresh',
    );
  });

  test('renders healthy compact text', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'personal',
        fetchedAt: '2026-03-24T10:42:00.000Z',
        included: {
          total: 500,
          used: 253,
          remaining: 247,
          percentUsed: 0.506,
        },
        spend: {
          used: 1.52,
          limit: 150,
          remaining: 148.48,
          percentUsed: 0.01,
        },
        activity: {},
        status: 'ok',
      },
    };

    assert.equal(renderStatusBarText(state, config), '◈ 247 | $1.52');
  });

  test('renders warning text', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'personal',
        fetchedAt: '2026-03-24T10:42:00.000Z',
        included: {
          total: 500,
          used: 472,
          remaining: 28,
          percentUsed: 0.944,
        },
        spend: {
          used: 84.2,
          limit: 150,
          remaining: 65.8,
          percentUsed: 0.561,
        },
        activity: {},
        status: 'ok',
      },
    };

    assert.equal(renderStatusBarText(state, config), '▲ 28 | $84.20');
  });

  test('renders dollar-based team included usage compactly', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'team',
        fetchedAt: '2026-03-24T10:42:00.000Z',
        included: {
          unit: 'usd',
          remaining: 0,
        },
        spend: {
          used: 1040.16,
          unlimited: true,
        },
        activity: {},
        status: 'ok',
      },
    };

    assert.equal(renderStatusBarText(state, config), '◆ $0 | $1,040.16');
  });

  test('renders auth text', () => {
    assert.equal(
      renderStatusBarText(
        {
          hasToken: true,
          snapshot: {
            source: 'personal',
            fetchedAt: '2026-03-24T10:42:00.000Z',
            included: {},
            spend: {},
            activity: {},
            status: 'auth_error',
          },
        },
        config,
      ),
      'CursorPulse: reconnect',
    );
  });

  test('renders loading text', () => {
    assert.equal(
      renderStatusBarText(
        {
          hasToken: true,
          snapshot: {
            source: 'personal',
            fetchedAt: '2026-03-24T10:42:00.000Z',
            included: {},
            spend: {},
            activity: {},
            status: 'loading',
          },
        },
        config,
      ),
      'CursorPulse: syncing',
    );
  });

  test('renders unavailable text for fetch errors', () => {
    assert.equal(
      renderStatusBarText(
        {
          hasToken: true,
          snapshot: {
            source: 'personal',
            fetchedAt: '2026-03-24T10:42:00.000Z',
            included: {},
            spend: {},
            activity: {},
            status: 'fetch_error',
          },
        },
        config,
      ),
      'CursorPulse: unavailable',
    );
  });

  test('applyStatusBarState updates the item and shows it', () => {
    const item = {
      command: '',
      text: '',
      tooltip: 'existing',
      shown: false,
      show() {
        this.shown = true;
      },
    };

    applyStatusBarState(
      item as never,
      {
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {
            used: 1.52,
          },
          activity: {},
          status: 'ok',
        },
      },
      config,
    );

    assert.equal(item.command, 'cursorPulse.refresh');
    assert.equal(item.text, '◈ ? | $1.52');
    assert.equal(item.tooltip, undefined);
    assert.equal(item.shown, true);
  });

  test('renders signed-out text', () => {
    assert.equal(
      renderStatusBarText(
        {
          hasToken: false,
        },
        config,
      ),
      'CursorPulse: connect',
    );
  });
});

import * as assert from 'node:assert/strict';
import { CursorPulseConfig, CursorPulseViewState } from '../../src/client/types';
import { buildTooltipMarkdown } from '../../src/ui/tooltipContent';

const config: CursorPulseConfig = {
  pollMinutes: 15,
  displayMode: 'compact',
  showUnlimitedActivity: true,
  showModelAnalytics: true,
  warningThresholdSpend: 0.8,
  warningThresholdIncluded: 0.1,
};

suite('renderTooltip', () => {
  test('renders the full breakdown', () => {
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
          resetDate: '2026-04-01T00:00:00.000Z',
        },
        spend: {
          used: 1.52,
          limit: 150,
          remaining: 148.48,
          percentUsed: 0.01,
        },
        activity: {
          avgPerDay: 8.7,
          beyondIncludedCount: 34,
          projectedExhaustionDate: '2026-04-21T00:00:00.000Z',
        },
        analytics: {
          available: true,
          day: '2026-03-24',
          totalSpend: 1.52,
          totalRequests: 34,
          averageDailySpend: 0.76,
          averageDailyRequests: 17,
          topModels: [
            {
              model: 'claude-4-sonnet',
              spend: 0.95,
              requests: 21,
            },
            {
              model: 'gpt-4.1',
              spend: 0.57,
              requests: 13,
            },
          ],
        },
        status: 'ok',
      },
    };

    const tooltip = buildTooltipMarkdown(state, config);
    assert.match(tooltip, /Included left/);
    assert.match(tooltip, /On-demand spend/);
    assert.match(tooltip, /Activity signal/);
    assert.match(tooltip, /Today by model/);
    assert.match(tooltip, /Today total: \$1\.52 • 34 req/);
    assert.match(tooltip, /Reset: .* • Updated:/);
    assert.match(tooltip, /Source: Personal/);
  });

  test('shows team source when team-backed data is used', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'team',
        fetchedAt: '2026-03-24T10:42:00.000Z',
        included: {},
        spend: {},
        activity: {},
        status: 'ok',
      },
    };

    const tooltip = buildTooltipMarkdown(state, config);
    assert.match(tooltip, /Reset: \? • Updated:/);
    assert.match(tooltip, /Source: Team/);
  });

  test('renders loading copy', () => {
    const tooltip = buildTooltipMarkdown(
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
    );

    assert.match(tooltip, /Syncing your latest Cursor usage snapshot/);
  });

  test('renders auth error copy', () => {
    const tooltip = buildTooltipMarkdown(
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
    );

    assert.match(tooltip, /Your saved session expired/);
  });

  test('renders fetch error fallback copy', () => {
    const tooltip = buildTooltipMarkdown(
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
    );

    assert.match(tooltip, /couldn't read the latest usage response/);
  });

  test('shows cleaner included copy when total is unknown', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'team',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {
            remaining: 0,
          },
          spend: {},
          activity: {},
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Included left/);
    assert.match(tooltip, /0 remaining/);
    assert.doesNotMatch(tooltip, /0 of \?/);
  });

  test('renders dollar-based team usage and unlimited spend cleanly', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'team',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {
            unit: 'usd',
            remaining: 0,
            used: 118.52,
            resetDate: '2026-03-27T16:24:12.000Z',
          },
          spend: {
            used: 1040.16,
            unlimited: true,
          },
          activity: {},
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /\$0\.00 remaining/);
    assert.match(tooltip, /Included usage spent this cycle: \$118\.52/);
    assert.match(tooltip, /\$1,040\.16 \/ Unlimited/);
    assert.match(tooltip, /Spend cap: Unlimited/);
    assert.doesNotMatch(tooltip, /Activity signal/);
  });

  test('renders daily model analytics for team dollar usage', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'team',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {
            unit: 'usd',
            remaining: 0,
            used: 118.52,
            resetDate: '2026-03-27T16:24:12.000Z',
          },
          spend: {
            used: 1040.16,
            unlimited: true,
          },
          activity: {},
          analytics: {
            available: true,
            day: '2026-03-24',
            totalSpend: 4.2,
            totalRequests: 23,
            averageDailySpend: 2.1,
            averageDailyRequests: 11.5,
            topModels: [
              {
                model: 'claude-4-sonnet',
                spend: 3.4,
                requests: 18,
              },
              {
                model: 'gpt-4.1',
                spend: 0.8,
                requests: 5,
              },
            ],
          },
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Today by model/);
    assert.match(tooltip, /claude-4-sonnet: \$3\.40 • 18 req/);
    assert.match(tooltip, /gpt-4\.1: \$0\.80 • 5 req/);
    assert.match(tooltip, /Today total: \$4\.20 • 23 req/);
    assert.match(tooltip, /Average day this cycle: \$2\.10 • 11\.5 req/);
  });

  test('omits cycle average row when only today data is available', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'team',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {
            unit: 'usd',
            remaining: 0,
            used: 118.52,
            resetDate: '2026-03-27T16:24:12.000Z',
          },
          spend: {
            used: 1040.16,
            unlimited: true,
          },
          activity: {},
          analytics: {
            available: true,
            day: '2026-03-24',
            totalSpend: 0.25,
            totalRequests: 3,
            topModels: [
              {
                model: 'default',
                spend: 0.14,
                requests: 2,
              },
              {
                model: 'composer-2',
                spend: 0.1,
                requests: 1,
              },
            ],
          },
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Today total: \$0\.25 • 3 req/);
    assert.doesNotMatch(tooltip, /Average day this cycle/);
  });

  test('shows analytics unavailable copy when event data is missing', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          analytics: {
            available: false,
            day: '2026-03-24',
            topModels: [],
          },
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Daily model breakdown unavailable for this account/);
  });

  test('renders stale banner', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'personal',
        fetchedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        included: {},
        spend: {},
        activity: {},
        status: 'stale',
      },
      message: 'Showing last successful snapshot.',
    };

    const tooltip = buildTooltipMarkdown(state, config);
    assert.match(tooltip, /Using your last good snapshot/);
  });

  test('omits activity when disabled', () => {
    const state: CursorPulseViewState = {
      hasToken: true,
      snapshot: {
        source: 'personal',
        fetchedAt: '2026-03-24T10:42:00.000Z',
        included: {},
        spend: {},
        activity: {},
        status: 'ok',
      },
    };

    const tooltip = buildTooltipMarkdown(
      {
        ...state,
      },
      {
        ...config,
        showUnlimitedActivity: false,
      },
    );

    assert.doesNotMatch(tooltip, /Activity signal/);
  });

  test('omits model analytics when disabled', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          analytics: {
            available: true,
            day: '2026-03-24',
            totalSpend: 1.2,
            topModels: [],
          },
          status: 'ok',
        },
      },
      {
        ...config,
        showModelAnalytics: false,
      },
    );

    assert.doesNotMatch(tooltip, /Today by model/);
  });

  test('renders spend-only and request-only analytics rows cleanly', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'personal',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          analytics: {
            available: true,
            day: '2026-03-24',
            topModels: [
              { model: 'default', spend: 0.25 },
              { model: 'composer-2', requests: 2.5 },
            ],
          },
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Default: \$0\.25/);
    assert.match(tooltip, /Composer 2: 2\.5 req/);
  });

  test('formats long model names more cleanly', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: true,
        snapshot: {
          source: 'team',
          fetchedAt: '2026-03-24T10:42:00.000Z',
          included: {},
          spend: {},
          activity: {},
          analytics: {
            available: true,
            day: '2026-03-24',
            topModels: [
              {
                model: 'claude-4.6-opus-high-thinking',
                spend: 9.19,
                requests: 15,
              },
            ],
          },
          status: 'ok',
        },
      },
      config,
    );

    assert.match(tooltip, /Claude 4\.6 Opus Thinking: \$9\.19 • 15 req/);
  });

  test('shows friendlier signed-out copy', () => {
    const tooltip = buildTooltipMarkdown(
      {
        hasToken: false,
      },
      config,
    );

    assert.match(tooltip, /Connect your Cursor session/);
    assert.match(tooltip, /Set Session Token/);
  });
});

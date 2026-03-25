import * as assert from 'node:assert/strict';
import { CursorPulseConfig, CursorPulseViewState } from '../../src/client/types';
import { buildTooltipMarkdown } from '../../src/ui/tooltipContent';

const config: CursorPulseConfig = {
  pollMinutes: 15,
  displayMode: 'compact',
  showUnlimitedActivity: true,
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
        status: 'ok',
      },
    };

    const tooltip = buildTooltipMarkdown(state, config);
    assert.match(tooltip, /Included left/);
    assert.match(tooltip, /On-demand spend/);
    assert.match(tooltip, /Activity signal/);
    assert.match(tooltip, /Billing source: Personal/);
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
    assert.match(tooltip, /Billing source: Team/);
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

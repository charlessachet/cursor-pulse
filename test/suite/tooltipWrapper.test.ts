import * as assert from 'node:assert/strict';
import mock = require('mock-require');

suite('renderTooltip', () => {
  teardown(() => {
    mock.stopAll();
  });

  test('wraps tooltip markdown in an untrusted MarkdownString', () => {
    class FakeMarkdownString {
      public readonly value: string;
      public readonly supportThemeIcons: boolean | undefined;
      public isTrusted = true;

      public constructor(value: string, supportThemeIcons?: boolean) {
        this.value = value;
        this.supportThemeIcons = supportThemeIcons;
      }
    }

    mock('vscode', {
      MarkdownString: FakeMarkdownString,
    });

    const { renderTooltip } = require('../../src/ui/tooltip');
    const tooltip = renderTooltip(
      {
        hasToken: false,
      },
      {
        pollMinutes: 15,
        displayMode: 'compact',
        showUnlimitedActivity: true,
        showModelAnalytics: true,
        warningThresholdSpend: 0.8,
        warningThresholdIncluded: 0.1,
      },
    );

    assert.equal(tooltip.value.includes('CursorPulse'), true);
    assert.equal(tooltip.supportThemeIcons, true);
    assert.equal(tooltip.isTrusted, false);
  });
});

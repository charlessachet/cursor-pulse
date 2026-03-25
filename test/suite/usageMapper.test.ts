import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CursorPersonalUsagePayload } from '../../src/client/types';
import { mapUsagePayloadToSnapshot } from '../../src/services/usageMapper';

function loadFixture(name: string): CursorPersonalUsagePayload {
  const filePath = path.resolve(__dirname, '../../../test/fixtures', name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CursorPersonalUsagePayload;
}

suite('mapUsagePayloadToSnapshot', () => {
  const fetchedAt = new Date('2026-03-24T10:42:00.000Z');

  test('maps a healthy fixture', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('healthy-usage.json'), fetchedAt);

    assert.equal(snapshot.included.total, 500);
    assert.equal(snapshot.included.used, 253);
    assert.equal(snapshot.included.remaining, 247);
    assert.equal(snapshot.spend.used, 1.52);
    assert.equal(snapshot.spend.limit, 150);
    assert.equal(snapshot.activity.beyondIncludedCount, 34);
    assert.equal(snapshot.analytics?.available, true);
    assert.equal(snapshot.analytics?.totalSpend, 1.52);
    assert.equal(snapshot.analytics?.totalRequests, 34);
    assert.equal(snapshot.analytics?.averageDailySpend, 0.11);
    assert.equal(snapshot.analytics?.averageDailyRequests, 2.2);
    assert.equal(snapshot.analytics?.topModels[0]?.model, 'claude-4-sonnet');
    assert.equal(snapshot.analytics?.topModels[1]?.model, 'gpt-4.1');
  });

  test('maps an exhausted fixture', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('exhausted-usage.json'), fetchedAt);

    assert.equal(snapshot.included.remaining, 0);
    assert.equal(snapshot.spend.used, 84.2);
    assert.equal(snapshot.activity.beyondIncludedCount, 120);
  });

  test('handles a missing hard limit', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('missing-hard-limit.json'), fetchedAt);

    assert.equal(snapshot.spend.limit, undefined);
    assert.equal(snapshot.spend.remaining, undefined);
  });

  test('prefers team-backed usage when available', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('team-usage.json'), fetchedAt);

    assert.equal(snapshot.source, 'team');
    assert.equal(snapshot.included.remaining, 20);
    assert.equal(snapshot.spend.used, 1040.16);
    assert.equal(snapshot.spend.limit, 1500);
  });

  test('maps dollar-based team usage when request quota is unavailable', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('team-dollar-usage.json'), fetchedAt);

    assert.equal(snapshot.source, 'team');
    assert.equal(snapshot.included.unit, 'usd');
    assert.equal(snapshot.included.total, undefined);
    assert.equal(snapshot.included.used, 118.52);
    assert.equal(snapshot.included.remaining, 0);
    assert.equal(snapshot.spend.used, 1040.16);
    assert.equal(snapshot.spend.unlimited, true);
    assert.equal(snapshot.activity.avgPerDay, undefined);
    assert.equal(snapshot.activity.beyondIncludedCount, undefined);
    assert.equal(snapshot.analytics?.available, true);
    assert.equal(snapshot.analytics?.totalSpend, 0.25);
    assert.equal(snapshot.analytics?.totalRequests, 3);
    assert.equal(snapshot.analytics?.averageDailySpend, undefined);
    assert.equal(snapshot.analytics?.averageDailyRequests, undefined);
    assert.equal(snapshot.analytics?.topModels[0]?.model, 'default');
    assert.equal(snapshot.analytics?.topModels[0]?.requests, 2);
  });

  test('tolerates partial responses and excludes payments', () => {
    const snapshot = mapUsagePayloadToSnapshot(loadFixture('partial-response.json'), fetchedAt);

    assert.equal(snapshot.included.total, undefined);
    assert.equal(snapshot.included.remaining, 0);
    assert.equal(snapshot.spend.used, 0.8);
    assert.equal(snapshot.activity.beyondIncludedCount, 5);
    assert.equal(snapshot.analytics?.available, false);
  });
});

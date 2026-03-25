import * as assert from 'node:assert/strict';
import { parseSessionToken } from '../../src/infra/secrets';

suite('parseSessionToken', () => {
  test('accepts a raw token', () => {
    assert.equal(parseSessionToken('abc123%3A%3Arest'), 'abc123%3A%3Arest');
  });

  test('extracts the token from a cookie string', () => {
    assert.equal(
      parseSessionToken('foo=bar; WorkosCursorSessionToken=abc123%3A%3Arest; another=value'),
      'abc123%3A%3Arest',
    );
  });

  test('returns undefined when a cookie string has no token', () => {
    assert.equal(parseSessionToken('foo=bar; another=value'), undefined);
  });

  test('returns undefined for malformed whitespace input', () => {
    assert.equal(parseSessionToken('not a valid token'), undefined);
  });
});


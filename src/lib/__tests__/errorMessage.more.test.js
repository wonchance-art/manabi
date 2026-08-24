import { describe, expect, it } from 'vitest';
import { friendlyError, friendlyToastMessage } from '../errorMessage';

describe('friendlyError additional contracts', () => {
  it.each([
    ['ERR_NETWORK', true], ['connection refused', true], ['503', true],
    ['resource_exhausted', true], ['429', true], ['요청이 너무 많습니다', true],
    ['JWT expired', false], ['not authenticated', false], ['403', false],
    ['forbidden', false], ['23505', false], ['already exists', false],
    ['violates foreign key', false], ['42501', false], ['413', false], ['payload too large', false],
    ['bucket not found', false], ['model returned 404', false], ['api key absent', false],
    ['not valid json', true], ['json parse failed', true],
  ])('%j selects a pattern and retry policy', (input, retry) => {
    const result = friendlyError(input);
    expect(result.retry).toBe(retry);
    expect(result.technical).toBe(input);
    expect(result.message).not.toBe(input);
  });

  it.each([
    ['Error: plain', 'plain'], ['HTTP 500: broken', 'broken'],
    ['오류: details', 'details'], ['Server Error: nope', 'nope'],
  ])('cleans the %j prefix', (input, expected) => {
    expect(friendlyToastMessage(input)).toBe(expected);
  });

  it('limits an unknown message to 200 characters', () => {
    expect(friendlyError('x'.repeat(250)).message).toHaveLength(200);
  });

  it('extracts Error.message', () => {
    expect(friendlyError(new Error('network down')).technical).toBe('network down');
  });
});

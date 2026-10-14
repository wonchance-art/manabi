import { describe, expect, it, vi } from 'vitest';
import { friendlyError, friendlyToastMessage, UNKNOWN_ERROR_MESSAGE } from '../errorMessage';

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

  // WALL-STATES-001: 접두어 제거·200자 자르기는 그대로 보여 줄 수 있는 우리 한국어 안내에만 적용된다.
  // 영어 원문(옛 기대값 'plain'·'broken' …)은 더 이상 화면에 나가지 않는다 — 아래 고정 문구 계약.
  it.each([
    ['Error: 저장하지 못했어요.', '저장하지 못했어요.'], ['HTTP 500: 교재를 열지 못했어요.', '교재를 열지 못했어요.'],
    ['오류: 다시 골라 주세요.', '다시 골라 주세요.'], ['Server Error: 잠시 후 다시 열어 주세요.', '잠시 후 다시 열어 주세요.'],
  ])('cleans the %j prefix', (input, expected) => {
    expect(friendlyToastMessage(input)).toBe(expected);
  });

  it('limits a Korean message to 200 characters', () => {
    expect(friendlyError('가'.repeat(250)).message).toHaveLength(200);
  });

  it.each(['Error: plain', 'HTTP 500: broken', 'Server Error: nope', 'x'.repeat(250)])(
    'replaces the unknown raw %j with the fixed Korean message', (input) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(friendlyToastMessage(input)).toBe(UNKNOWN_ERROR_MESSAGE);
      warn.mockRestore();
    });

  it('extracts Error.message', () => {
    expect(friendlyError(new Error('network down')).technical).toBe('network down');
  });
});

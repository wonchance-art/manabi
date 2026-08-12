import { describe, expect, it } from 'vitest';
import { resolveAnalysisStatus } from '../analyzeText.js';

// 계약: 전량 실패는 'failed' — 'partial'로 두면 UI가 "완료(재시도 필요)"라고 실패를 가린다(#969).
describe('분석 최종 상태 판정', () => {
  const ok = { text: '我', failed: undefined, pos: '대명사' };
  const failedTok = { text: '…', failed: true };
  const br = { text: '\n', pos: '개행' };

  it('성공 토큰이 하나도 없으면 failed', () => {
    expect(resolveAnalysisStatus({ a: failedTok, b: failedTok }, 2, 2)).toBe('failed');
    expect(resolveAnalysisStatus({ a: failedTok, b: br }, 1, 2)).toBe('failed'); // 개행은 성공으로 안 친다
  });

  it('일부 실패는 partial', () => {
    expect(resolveAnalysisStatus({ a: ok, b: failedTok }, 1, 2)).toBe('partial');
  });

  it('실패 없으면 completed', () => {
    expect(resolveAnalysisStatus({ a: ok }, 0, 1)).toBe('completed');
  });

  it('빈 자료(0줄)는 completed 유지', () => {
    expect(resolveAnalysisStatus({}, 0, 0)).toBe('completed');
  });
});

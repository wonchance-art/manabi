import { describe, it, expect } from 'vitest';
import { parseStamps } from '../stamps.js';

// 스탬프 응답 파싱(순수부) — 네트워크 미접촉. 다양한 응답 형태를 안전하게 nodeId 배열로 접는다.
describe('parseStamps (순수)', () => {
  it('{stamps:[{nodeId,at}]} 에서 nodeId 만 추출', () => {
    const ids = parseStamps({ stamps: [{ nodeId: 'seoul', at: 'x' }, { nodeId: 'busan', at: 'y' }] });
    expect(ids).toEqual(['seoul', 'busan']);
  });

  it('문자열 배열 형태도 지원', () => {
    expect(parseStamps({ stamps: ['seoul', 'tokyo'] })).toEqual(['seoul', 'tokyo']);
  });

  it('깨진/누락 항목은 조용히 건너뛴다', () => {
    const ids = parseStamps({ stamps: [null, { at: 'no-id' }, { nodeId: 5 }, { nodeId: 'fuji' }, ''] });
    expect(ids).toEqual(['fuji']);
  });

  it('stamps 가 없거나 배열이 아니면 빈 배열', () => {
    expect(parseStamps(null)).toEqual([]);
    expect(parseStamps({})).toEqual([]);
    expect(parseStamps({ stamps: 'nope' })).toEqual([]);
    expect(parseStamps(undefined)).toEqual([]);
  });
});

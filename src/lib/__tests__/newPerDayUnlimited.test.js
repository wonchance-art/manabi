// LEVEL-NEW-UNLIMITED-001 — 하루 새 단어 「제한 없음」(9999)이 화면 · 요청 검사 · 서버 목록에서 같은 값이다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NEW_PER_DAY_OPTIONS, NEW_PER_DAY_UNLIMITED, newPerDayLabel, DEFAULT_NEW_PER_DAY } from '../vocabStudy';
import { normalizeFsrsRequest } from '../fsrsOperationOutbox';

const migration = fs.readFileSync('supabase/migrations/20261030050000_daily_new_limit_unlimited.sql', 'utf8');

describe('하루 새 단어 「제한 없음」', () => {
  it('설정 목록 끝에 9999 · 기본값 15 그대로 · 글은 「제한 없음」', () => {
    expect(NEW_PER_DAY_OPTIONS).toEqual([0, 5, 10, 15, 20, 30, 40, 9999]);
    expect(NEW_PER_DAY_UNLIMITED).toBe(9999);
    expect(DEFAULT_NEW_PER_DAY).toBe(15);
    expect(NEW_PER_DAY_OPTIONS.map(newPerDayLabel)).toEqual(['없음 (복습만)', '5개', '10개', '15개', '20개', '30개', '40개', '제한 없음']);
  });

  it('요청 검사는 목록 값만 받는다 — 9999는 통과, 목록 밖은 거절', () => {
    const base = { action: 'question', operationId: '00000000-0000-4000-8000-0000000000a1', cardId: '00000000-0000-4000-8000-0000000000b1', expectedRevision: 3 };
    const accept = n => { try { normalizeFsrsRequest({ ...base, ...(n === undefined ? {} : { dailyNewLimit: n }) }, '00000000-0000-4000-8000-0000000000c1'); return true; } catch (e) { return e?.code ?? e?.message; } };
    // 같은 바탕 요청이 한도 없이 통과하는지 먼저(바탕이 틀려 모두 거절되는 착시 방지).
    expect(accept(undefined)).toBe(true);
    expect(accept(9999)).toBe(true);
    expect(accept(15)).toBe(true);
    expect(accept(100)).not.toBe(true);
  });

  it('마이그레이션의 새 목록이 화면 목록과 같다', () => {
    expect(migration).toContain(`ARRAY[${NEW_PER_DAY_OPTIONS.join(', ')}]`);
  });
});

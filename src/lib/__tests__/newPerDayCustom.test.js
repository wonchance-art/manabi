// LEVEL-NEW-CUSTOM-001 — 하루 새 단어 직접 입력(오너 2026-11-01 KST): 0–999 아무 정수 또는 9999(제한 없음).
// 화면 · 요청 검사(isNewPerDayValue) · 서버 함수 두 곳 · 정책 CHECK가 같은 범위다. 복원 SQL은 직접 값을 목록 값으로 내린다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NEW_PER_DAY_MAX, NEW_PER_DAY_OPTIONS, NEW_PER_DAY_UNLIMITED, isNewPerDayValue, newPerDayChoices, newPerDayLabel } from '../vocabStudy';
import { normalizeFsrsRequest } from '../fsrsOperationOutbox';

const migration = fs.readFileSync('supabase/migrations/20261101030000_daily_new_limit_custom.sql', 'utf8');
const rollback = fs.readFileSync('docs/sql/daily-new-limit-custom-rollback.sql', 'utf8');
const RANGE = `generate_series(0,${NEW_PER_DAY_MAX})`;

describe('하루 새 단어 직접 입력', () => {
  it('판정 — 0–999 정수 · 9999만', () => {
    expect(NEW_PER_DAY_MAX).toBe(999);
    for (const n of [0, 1, 25, 999, NEW_PER_DAY_UNLIMITED, ...NEW_PER_DAY_OPTIONS]) expect(isNewPerDayValue(n)).toBe(true);
    for (const n of [-1, 1000, 9998, 10000, 2.5, '25', null, undefined, NaN]) expect(isNewPerDayValue(n)).toBe(false);
  });

  it('단어장 설정 목록 — 직접 값은 크기 순 제자리에 한 줄 · 고르기 값이면 목록 그대로', () => {
    expect(newPerDayChoices(15)).toBe(NEW_PER_DAY_OPTIONS);
    expect(newPerDayChoices(25)).toEqual([0, 5, 10, 15, 20, 25, 30, 40, 9999]);
    expect(newPerDayChoices(1000)).toBe(NEW_PER_DAY_OPTIONS);
    expect(newPerDayLabel(25)).toBe('25개');
  });

  it('요청 검사가 같은 범위를 받는다', () => {
    const base = { action: 'question', operationId: '00000000-0000-4000-8000-0000000000a1', cardId: '00000000-0000-4000-8000-0000000000b1', expectedRevision: 3 };
    const accept = n => { try { normalizeFsrsRequest({ ...base, dailyNewLimit: n }, '00000000-0000-4000-8000-0000000000c1'); return true; } catch { return false; } };
    expect([25, 999, 0, 9999].map(accept)).toEqual([true, true, true, true]);
    expect([1000, -1, 2.5].map(accept)).toEqual([false, false, false]);
  });

  it('마이그레이션 — 두 함수 목록을 범위로 · CHECK도 같은 범위 · 사전 · 사후 검사', () => {
    expect(migration.split(RANGE).length - 1).toBe(2); // 바꿀 자리 둘 — 설정 요청(learning_configure_admission) · 첫 문제(fsrs_apply_operation)
    expect(migration).toContain('CHECK ((daily_new_limit BETWEEN 0 AND 999) OR daily_new_limit = 9999)');
    expect(migration).toContain(`'CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= ${NEW_PER_DAY_MAX})) OR (daily_new_limit = 9999)))'`);
    expect(migration).toMatch(/RAISE EXCEPTION 'new_custom: unreviewed state/);
    expect(migration).toMatch(/RAISE EXCEPTION 'new_custom: post state differs/);
  });

  it('복원 — 직접 값을 아래 가장 가까운 목록 값으로 내린 뒤 「제한 없음」 판으로', () => {
    expect(rollback).toContain('<> ALL (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999])');
    expect(rollback).toContain("IS DISTINCT FROM 'dc409fa33d4c1ddfa413237c8c863676'");
    expect(rollback).toContain("IS DISTINCT FROM 'f33171a765921d092a5961480e7c7f7c'");
  });
});

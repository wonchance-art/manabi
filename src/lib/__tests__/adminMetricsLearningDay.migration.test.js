// 관리자 「일별 추이 · 가입 퍼널」 = 학습자 화면과 같은 셈(ADMIN-METRICS-DAY-001, 목업 9kvCCoQjGa6KUWzUtoRCuN).
// SQL은 코드 상수를 못 읽으므로 리터럴로 적는다 — 그 리터럴이 코드의 정본(답 · 채점 답 · 04시 학습일)과 같은지 여기서 대조한다.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NON_ANSWER_SOURCES } from '../reviewEventSources.js';
import { ACTIVITY_ONLY_SOURCES, countsAsStudyAnswer, isGradedReviewEvent } from '../weeklyReport.js';
import { PRACTICE_SOURCE } from '../practiceEvents.js';
import { FSRS_POLICY } from '../fsrsScheduler.js';

const MIGRATION = 'supabase/migrations/20261105010000_admin_metrics_learning_day.sql';
const ROLLBACK = 'docs/sql/admin-metrics-learning-day-rollback.sql';
const read = f => fs.readFileSync(f, 'utf8');
const lists = sql => [...sql.matchAll(/r\.source NOT IN \(([^)]*)\)/g)].map(m => m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort());
const sorted = xs => [...new Set(xs)].sort();

describe('admin_daily_metrics · admin_funnel — 학습자 화면과 같은 셈', () => {
  const sql = read(MIGRATION);
  it('활성 · 퍼널 = 답(countsAsStudyAnswer) — 답 아닌 출처 ∪ 연습을 뺀다', () => {
    const answer = sorted([...NON_ANSWER_SOURCES, PRACTICE_SOURCE]);
    const [dailyGraded, dailyActive, funnelEv] = lists(sql); // 본문 순서: 정답률 CASE → WHERE(활성) → 퍼널 ev
    expect(dailyActive).toEqual(answer);
    expect(funnelEv).toEqual(answer);
    for (const s of answer) expect(countsAsStudyAnswer({ source: s, correct: true }), s).toBe(false);
    for (const s of ACTIVITY_ONLY_SOURCES) expect(countsAsStudyAnswer({ source: s, correct: true }), s).toBe(true);
    expect(dailyGraded).toEqual(sorted([...answer, ...ACTIVITY_ONLY_SOURCES]));
    for (const s of dailyGraded) expect(isGradedReviewEvent({ source: s, correct: true }), s).toBe(false);
  });
  it('하루 = 04시 학습일(KST) — 정책과 같은 시간대 · 넘김 시각', () => {
    expect([FSRS_POLICY.timeZone, FSRS_POLICY.rolloverHour]).toEqual(['Asia/Seoul', 4]);
    expect(sql.match(/AT TIME ZONE 'Asia\/Seoul'\) - interval '4 hours'\)::date/g).length).toBeGreaterThanOrEqual(4);
    expect(sql).not.toMatch(/AT TIME ZONE 'UTC'/);
  });
  it('관리자 검사 · 보안 속성 · 실행권 · 앞뒤 지문 검사', () => {
    expect(sql.match(/IF NOT EXISTS \(SELECT 1 FROM profiles WHERE id = auth\.uid\(\) AND role = 'admin'\) THEN\s+RAISE EXCEPTION/g)).toHaveLength(2);
    expect(sql.match(/STABLE SECURITY DEFINER\n SET search_path TO 'public'/g)).toHaveLength(2);
    expect(sql).toContain('revoke execute on function public.admin_daily_metrics(integer), public.admin_funnel(integer) from public, anon;');
    expect(sql.match(/is distinct from fsrs_private\.activity_profile_hash\(\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\bdetail\b(?!\s*미접근)/);
  });
  it('복원 SQL = 운영 본문 그대로(md5(prosrc) 2026-11-05 KST 실측)', () => {
    const bodies = [...read(ROLLBACK).matchAll(/AS \$function\$([\s\S]*?)\$function\$;/g)].map(m => crypto.createHash('md5').update(m[1]).digest('hex'));
    expect(bodies).toEqual(['2cf8fe3ce20a2d9978b97eab6d089c80', '65edc86b6e76826aeb979fd8e13a5143']);
  });
  it('CI가 PGlite 검사를 돌린다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/admin-metrics-learning-day.mjs');
  });
});

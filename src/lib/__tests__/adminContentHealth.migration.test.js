// 관리자 「콘텐츠 건강」 출처 = 정답률 정본 출처(EVENT-SOURCE-001 후속, 2026-11-04 KST).
// SQL은 코드 상수를 읽을 수 없으므로 목록을 리터럴로 적는다 — 그 리터럴이 코드의 「답이 아닌 출처」와 같은지 여기서 대조한다.
// 코드에 답 아닌 출처가 늘면(예: 새 자기 확인 탭) 이 시험이 실패해 SQL도 같이 옮기게 한다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NON_ANSWER_SOURCES } from '../reviewEventSources.js';
import { ACTIVITY_ONLY_SOURCES, isGradedReviewEvent } from '../weeklyReport.js';
import { PRACTICE_SOURCE } from '../practiceEvents.js';

const MIGRATION = 'supabase/migrations/20261104110000_admin_content_health_answers.sql';
const ROLLBACK = 'docs/sql/admin-content-health-rollback.sql';
const read = f => fs.readFileSync(f, 'utf8');
const listIn = sql => {
  const m = sql.match(/r\.source NOT IN \(([^)]*)\)/);
  expect(m, 'NOT IN 목록').not.toBeNull();
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).sort();
};

describe('admin_content_health — 정답률 정본과 같은 출처만', () => {
  it('SQL이 빼는 출처 = 답 아닌 출처 ∪ 활동량만 ∪ 연습', () => {
    const expected = [...new Set([...NON_ANSWER_SOURCES, ...ACTIVITY_ONLY_SOURCES, PRACTICE_SOURCE])].sort();
    expect(listIn(read(MIGRATION))).toEqual(expected);
    for (const s of expected) expect(isGradedReviewEvent({ source: s, correct: false }), s).toBe(false);
  });
  it('관리자 검사 · 보안 속성 · 실행권 · 앞뒤 지문 검사를 지킨다', () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM profiles WHERE id = auth\.uid\(\) AND role = 'admin'\) THEN\s+RAISE EXCEPTION/);
    expect(sql).toContain('STABLE SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain('revoke execute on function public.admin_content_health(integer, integer) from public, anon;');
    expect(sql).toMatch(/has_function_privilege\('anon', 'public\.admin_content_health\(integer,integer\)', 'EXECUTE'\)/);
    expect(sql.match(/is distinct from fsrs_private\.activity_profile_hash\(\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\bdetail\b/);
  });
  it('복원 SQL = 예전 본문(ui만 뺀다)', () => {
    const sql = read(ROLLBACK);
    expect(sql).toContain("AND r.source <> 'ui'");
    expect(sql).not.toContain('NOT IN');
  });
  it('CI가 PGlite 검사를 돌린다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/admin-content-health-answers.mjs');
  });
});

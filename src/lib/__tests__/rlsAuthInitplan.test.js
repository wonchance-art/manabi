// RLS 정책 auth 호출 한 번 계산(RLS-INITPLAN-001 — 오너 승인 2026-11-03 KST).
// 마이그레이션 20261103000000_rls_auth_initplan.sql: 맨 auth.uid() · auth.role()을 (select …)로 감싸기만 한다(행마다 → 질의당 한 번).
// 학습 계약 지문 범위 테이블(capability · activity)은 건드리지 않는다 — 건드리면 운영 학습 기능이 꺼진다(#1504, migrationFingerprintRepin.test.js).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const FILE = 'supabase/migrations/20261103000000_rls_auth_initplan.sql';
const sql = fs.readFileSync(path.join(process.cwd(), FILE), 'utf8');
const code = sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
const statements = [...code.matchAll(/ALTER POLICY ("[^"]+"|\w+) ON public\.(\w+)([\s\S]*?);\n/g)].map(m => ({ name: m[1], table: m[2], body: m[3] }));
const FINGERPRINTED = ['user_vocabulary', 'user_known_words', 'review_events', 'reading_materials', 'uploaded_pdfs', 'profiles', 'vocabulary_contexts', 'vocabulary_exclusions'];

describe('RLS-INITPLAN-001 마이그레이션', () => {
  it('정책 75개 · 30개 테이블 — 전 기록표(rls_initplan_before)의 테이블 목록과 ALTER 대상이 같다', () => {
    expect(statements).toHaveLength(75);
    const listed = [...sliceBetween(code, 'p.tablename = ANY (ARRAY[', ']);').matchAll(/'(\w+)'/g)].map(m => m[1]).sort();
    expect(listed).toHaveLength(30);
    expect([...new Set(statements.map(s => s.table))].sort()).toEqual(listed);
  });
  it('식 안의 auth 호출은 모두 (select …)로 감쌌다 — 맨 호출 0, 바꾸는 것은 USING / WITH CHECK뿐', () => {
    for (const s of statements) {
      expect(s.body.replace(/\(select auth\.(uid|role)\(\)\)/g, ''), s.name).not.toMatch(/auth\.(uid|role|jwt)\(\)/);
      expect(s.body, s.name).toMatch(/^\s+(USING|WITH CHECK) \(/);
      expect(s.body, s.name).not.toMatch(/\b(TO|RENAME|AS (PERMISSIVE|RESTRICTIVE))\b/);
    }
  });
  it('지문 범위 테이블은 대상이 아니다(2단계 — 재게시와 함께 따로)', () => {
    for (const t of FINGERPRINTED) expect(statements.some(s => s.table === t), t).toBe(false);
  });
  it('같은 트랜잭션 사후 검사 — 정책 수 · 맨 호출 0 · 원래 식과 동치 · FSRS 계약 넷', () => {
    const check = sliceBetween(code, 'DO $check$', 'END $check$;');
    expect(check).toContain('policy count changed');
    expect(check).toContain('still call auth.* per row');
    expect(check).toContain("regexp_replace(a.qual, unwrap, 'auth.\\1()', 'g') IS DISTINCT FROM b.qual");
    expect(check).toContain("regexp_replace(a.with_check, unwrap, 'auth.\\1()', 'g') IS DISTINCT FROM b.with_check");
    for (const fn of ['contract_hash()', 'manual_contract_hash()', 'admission_contract_hash()', 'activity_profile_hash()']) expect(check).toContain(`fsrs_private.${fn}`);
  });
});

// 2단계(20261104060000_rls_auth_initplan_fingerprinted.sql — 2026-11-04 KST): 지문 범위 6개 테이블의 나머지 17개.
// 같은 트랜잭션에서 capability 상수 → core → activity profile → admission 재게시(§4.9-1). 동적 증명 = supabase/tests/rls-auth-initplan-fingerprinted.mjs.
const FILE2 = 'supabase/migrations/20261104060000_rls_auth_initplan_fingerprinted.sql';
const sql2 = fs.readFileSync(path.join(process.cwd(), FILE2), 'utf8');
const code2 = sql2.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
const change2 = sliceBetween(code2, 'DO $change$', 'END $change$;');
const statements2 = [...change2.matchAll(/ALTER POLICY ("[^"]+"|\w+) ON public\.(\w+)([^;]*);\n/g)].map(m => ({ name: m[1].replace(/"/g, ''), table: m[2], body: m[3] }));
const targets2 = [...sliceBetween(code2, 'INSERT INTO pg_temp.ri2_target', ');\n').matchAll(/\('(\w+)', '([^']+)', '(\w+)'/g)].map(m => ({ table: m[1], name: m[2], cmd: m[3] }));
const SIX = ['profiles', 'reading_materials', 'review_events', 'uploaded_pdfs', 'user_known_words', 'user_vocabulary'];

describe('RLS-INITPLAN-001 2단계 — 지문 범위 정책 17개 + 같은 트랜잭션 재게시', () => {
  it('정책 17개 · 6개 테이블 — ALTER 대상 = 사전 검사 대상 표(ri2_target), 1단계와 겹치지 않는다', () => {
    expect(statements2).toHaveLength(17);
    expect(targets2).toHaveLength(17);
    const key = s => `${s.table}:${s.name}`;
    expect(statements2.map(key).sort()).toEqual(targets2.map(key).sort());
    expect([...new Set(statements2.map(s => s.table))].sort()).toEqual(SIX);
    for (const t of SIX) expect(FINGERPRINTED, t).toContain(t);
    expect(statements.some(s => SIX.includes(s.table))).toBe(false);
  });
  it('식 안의 auth.uid()만 (select …)로 — 맨 호출 0, 바꾸는 것은 USING / WITH CHECK뿐(고칠 상태에서만)', () => {
    for (const s of statements2) {
      expect(s.body.replace(/\(select auth\.uid\(\)\)/g, ''), s.name).not.toMatch(/auth\.(uid|role|jwt)\(\)/);
      expect(s.body, s.name).toMatch(/^ (USING|WITH CHECK) \(/);
      expect(s.body, s.name).not.toMatch(/\b(TO|RENAME|AS (PERMISSIVE|RESTRICTIVE))\b/);
    }
    expect(change2).toMatch(/IF \(SELECT b\.needs_change FROM pg_temp\.ri2_state_before b\) THEN\s+ALTER POLICY/);
  });
  it('재게시 순서: ALTER 뒤 capability 상수 → core → profile → admission, 값은 _live()에서', () => {
    const order = ['ALTER POLICY "Users can manage own vocabulary"', 'PERFORM pg_temp.ri2_repin_capability();',
      'UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live()',
      'UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash_live()',
      'UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()'].map(s => change2.indexOf(s));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(code2).toContain("'CREATE OR REPLACE FUNCTION public.learning_language_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '''' AS %L'");
    expect(code2).not.toMatch(/UPDATE fsrs_private\.manual_save_settings/);
  });
  it('운영 해시 상수를 박지 않는다 — 고정 md5는 capability 본문 모양 둘뿐(사전 = 게시 = 실측, 사후 = 재계산)', () => {
    expect([...new Set(code2.match(/'[0-9a-f]{32}'/g))].sort()).toEqual(["'2e57290ce85b8f034f7f304dfdea3ad9'", "'4a497440fb53bc1a27c1975875c7d737'"]);
  });
  it('사전 · 사후 검사가 같은 트랜잭션에 있다', () => {
    const pre = sliceBetween(code2, 'DO $pre$', 'END $pre$;'), post = sliceBetween(code2, 'DO $post$', 'END $post$;');
    for (const s of ['capability body drift', 'learning contracts already drifted', 'Korean capability not ready before change', 'require_admission_integrity',
      'target policies missing', 'unreviewed bare auth.* policies', 'neither all original nor all wrapped']) expect(pre).toContain(s);
    for (const s of ['contracts not consistent after change', 'is distinct from fsrs_private.contract_hash()', 'is distinct from fsrs_private.activity_profile_hash()',
      'is distinct from fsrs_private.admission_contract_hash()', 'manual pin moved', 'already-applied run must not change anything', 'contract cache not refreshed',
      'Korean capability ready <> true', 'capability function attributes changed', 'beyond the select-wrap', 'policy count changed',
      'still call auth.* per row', 'snapshot output changed']) expect(post.toLowerCase()).toContain(s.toLowerCase());
    expect(code2.indexOf('SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE')).toBeGreaterThan(code2.indexOf('END $change$;'));
    expect(code2.indexOf('SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE')).toBeLessThan(code2.indexOf('DO $post$'));
  });
  it('CI가 PGlite 적용 검사(적용 · 재실행 · 복원)를 돌린다', () => {
    expect(fs.readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8')).toContain('node supabase/tests/rls-auth-initplan-fingerprinted.mjs');
  });
});

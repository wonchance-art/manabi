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

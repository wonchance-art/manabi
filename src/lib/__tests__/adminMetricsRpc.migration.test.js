import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// V4-1 집계 RPC 마이그레이션의 보안 불변식을 SQL 텍스트로 검증한다(psql 없이 회귀 방지).
// 목적: (a) 모든 함수가 admin 검사를 갖고, (b) detail/원문을 반환하지 않고,
//       (c) PUBLIC 회수 + authenticated에만 EXECUTE 부여를 유지하는지.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260708000100_admin_metrics_rpc.sql'),
  'utf8'
);

const FUNCTIONS = ['admin_funnel', 'admin_daily_metrics', 'admin_v3_metrics', 'admin_content_health'];

// 각 CREATE FUNCTION ... $$; 본문 블록을 잘라낸다.
function bodyOf(name) {
  const start = SQL.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  expect(start, `${name} 정의 존재`).toBeGreaterThanOrEqual(0);
  const end = SQL.indexOf('$$;', start);
  expect(end, `${name} 본문 종료`).toBeGreaterThan(start);
  return SQL.slice(start, end);
}

describe('20260708_admin_metrics_rpc — 보안 불변식', () => {
  it('함수 4개가 모두 정의된다', () => {
    for (const f of FUNCTIONS) {
      expect(SQL).toContain(`CREATE OR REPLACE FUNCTION ${f}(`);
    }
  });

  it('모든 함수가 SECURITY DEFINER + search_path 고정', () => {
    for (const f of FUNCTIONS) {
      const body = bodyOf(f);
      expect(body, `${f} SECURITY DEFINER`).toContain('SECURITY DEFINER');
      expect(body, `${f} search_path`).toContain('SET search_path = public');
    }
  });

  it('모든 함수가 첫 로직에서 admin 검사 후 예외를 던진다', () => {
    for (const f of FUNCTIONS) {
      const body = bodyOf(f);
      expect(body, `${f} admin 검사`).toMatch(
        /IF NOT EXISTS \(SELECT 1 FROM profiles WHERE id = auth\.uid\(\) AND role = 'admin'\) THEN[\s\S]*RAISE EXCEPTION/
      );
      // admin 검사가 RETURN QUERY(집계 반환)보다 먼저 와야 한다.
      const guardIdx = body.indexOf('RAISE EXCEPTION');
      const queryIdx = body.indexOf('RETURN QUERY');
      expect(guardIdx, `${f} 검사가 쿼리보다 선행`).toBeLessThan(queryIdx);
    }
  });

  it('어떤 함수도 detail/paragraph/materials를 결과 컬럼으로 반환하지 않는다', () => {
    // RETURNS TABLE (...) 선언부에 PII 컬럼명이 없어야 한다.
    const returnsBlocks = SQL.match(/RETURNS TABLE \([\s\S]*?\)/g) || [];
    expect(returnsBlocks.length).toBe(FUNCTIONS.length);
    for (const block of returnsBlocks) {
      expect(block).not.toMatch(/\bdetail\b/);
      expect(block).not.toMatch(/\bparagraph\b/);
      expect(block).not.toMatch(/\bmaterials\b/);
    }
  });

  it('PUBLIC 회수 + authenticated EXECUTE 부여를 모든 함수에 적용', () => {
    for (const f of FUNCTIONS) {
      expect(SQL, `${f} REVOKE`).toMatch(new RegExp(`REVOKE ALL ON FUNCTION ${f}\\([^)]*\\)\\s+FROM PUBLIC`));
      expect(SQL, `${f} GRANT`).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION ${f}\\([^)]*\\)\\s+TO authenticated`));
    }
  });

  it('ui 이벤트 집계는 source=ui + detail->>qtype 필터를 쓴다(rung/FSRS 무간섭)', () => {
    const body = bodyOf('admin_v3_metrics');
    expect(body).toContain("r.source = 'ui'");
    expect(body).toContain("r.detail->>'qtype' = 'forecast_tap'");
  });
});

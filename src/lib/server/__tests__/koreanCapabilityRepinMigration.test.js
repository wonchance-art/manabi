import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// KO-CAP-REPIN-001 — 실행 검증은 supabase/tests/korean-capability-repin.mjs(PGlite, CI). 여기서는 db push가 그대로 운영에
// 적용하는 파일이 §4.9-1 철사를 지키는 모양인지(사전 · 사후 검사, 한 트랜잭션, 임시 객체 정리)를 npm test에서 잡는다.
const SQL = readFileSync(
  new URL('../../../../supabase/migrations/20261016191500_korean_capability_repin.sql', import.meta.url),
  'utf8',
);
const code = SQL.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');

describe('Korean capability re-pin migration contract', () => {
  it('runs as the single db-push transaction (no own transaction control, nothing split out)', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK|END)\s*;/im);
    expect(code).not.toMatch(/\bCONCURRENTLY\b|\bVACUUM\b|ALTER\s+SYSTEM/i);
    expect(code).toMatch(/^SET LOCAL search_path = '';\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '180s';\n/m);
    expect(code).toMatch(/DO \$runner\$[\s\S]*?SET LOCAL not in effect[\s\S]*?END \$runner\$;/);
  });

  it('accepts only the reviewed needs-repair state or the already-repaired state (clean no-op)', () => {
    expect(code).toMatch(/IF k->>'pinned' = '1c25422cdd5f6be088ac624e8858cb3d' THEN\s+IF c->>'core' IS DISTINCT FROM '9dcbdd2614642e67911d4fcf2055b42d' THEN RAISE/);
    expect(code).toMatch(/ELSIF k->>'pinned' = 'da2c7548aa782ebb81d55e69d913cd52' THEN\s+IF c->>'core' = '9dcbdd2614642e67911d4fcf2055b42d' THEN RAISE/);
    expect(code).toMatch(/ELSE\s+RAISE EXCEPTION 'korean_capability_repin: pinned value is neither/);
    expect(code).toMatch(/b\.cap->>'pinned' = 'da2c7548aa782ebb81d55e69d913cd52' AND \(pg_temp\.perf_contracts\(\) IS DISTINCT FROM b\.contracts OR pg_temp\.perf_cap\(\) IS DISTINCT FROM b\.cap\)/);
  });

  it('stops unless the drift is exactly the reviewed #1504 state', () => {
    expect(code).toMatch(/k->>'live' IS DISTINCT FROM 'da2c7548aa782ebb81d55e69d913cd52'/);
    expect(code).toMatch(/perf_korean_live_hash_without\('policy:reading_materials:anon_book_chapters_hidden'\) IS DISTINCT FROM '1c25422cdd5f6be088ac624e8858cb3d'/);
    expect(code).toMatch(/NOT \(c->>'ok'\)::boolean THEN RAISE EXCEPTION 'korean_capability_repin: learning contracts already drifted/);
    // the capability body is checked against the reviewed template and the fingerprint copy against the live body
    expect(code).toContain("= '4a497440fb53bc1a27c1975875c7d737'");
    expect(code.match(/2e57290ce85b8f034f7f304dfdea3ad9/g)).toHaveLength(2);
  });

  it('re-pins only the capability scalar and the FSRS core pin, computed in the same transaction', () => {
    expect(code).toMatch(/PERFORM pg_temp\.perf_repin_capability\(NULL\);\s*PERFORM pg_temp\.perf_repin\('core'\);/);
    expect(code).not.toMatch(/perf_repin\('(manual|admission)'\)/);
    expect(code).not.toMatch(/CREATE OR REPLACE FUNCTION (?!public\.learning_language_capabilities\(\))/);
    expect(code).toMatch(/d->'attrs' IS DISTINCT FROM c->'attrs'/);
  });

  it('post-checks Korean ready, the four contracts, unchanged pins and identical snapshots — RAISE otherwise', () => {
    expect(code).toMatch(/pg_temp\.perf_korean_ready\(\) IS DISTINCT FROM true THEN RAISE/);
    expect(code).toMatch(/NOT \(c->>'ok'\)::boolean THEN RAISE EXCEPTION 'korean_capability_repin: contracts not consistent after change/);
    expect(code).toMatch(/activity profile pin moved/);
    expect(code).toMatch(/manual\/admission pin moved/);
    expect(code).toMatch(/fsrs_vocabulary_snapshot\(b\.actor\) - 'now'\) IS DISTINCT FROM b\.body/);
    expect(code).toMatch(/diffs <> 0 THEN RAISE/);
  });

  it('drops every temporary object it creates', () => {
    const fns = [...code.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThan(5);
    for (const fn of fns) expect(code).toContain(`DROP FUNCTION ${fn}(`);
    expect(code).toMatch(/DROP TABLE pg_temp\.perf_state_before, pg_temp\.perf_snapshot_before;\s*$/);
  });
});

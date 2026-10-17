import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * registry 동일성 계약(PERF-SNAPSHOT P4 · KO-PERF-SNAPSHOT-P4).
 *
 * P4(20261016191600_vocabulary_snapshot_set_flags.sql) 뒤 「registry 한 칸」의 정의가 둘이다 —
 * fsrs_private.vocabulary_registry_entry(actor, card)(fsrs_save_manual_vocabulary가 저장 직후 1건에 쓴다)와
 * public.fsrs_vocabulary_snapshot(actor)의 집합 계산. 두 정의는 모든 카드에서 같아야 한다:
 *   vocabulary_registry_entry(actor, id) = snapshot.registry[i]
 * 실행 증명은 PGlite(supabase/tests/vocabulary-snapshot-set-flags.mjs)와 마이그레이션 자신의 사후 검사 $parity$가 한다.
 * 이 계약은 그 검사가 사라지지 않게 잡는다 — P4 뒤에 둘 중 하나를 다시 정의하는 마이그레이션(동적 SQL 포함)이나 그 복원 SQL은
 * 같은 파일에 같은 $parity$ 검사(전 사용자 · 전 카드 비교 → 하나라도 다르면 RAISE)를 가져야 한다.
 * (중복 정의를 허용하는 대신 동치를 계약으로 묶는다 — CLAUDE.md 「중복 신설 금지」의 조건부 예외, RFC p4-rfc_ko.md §1 · §5.)
 */
const ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS = 'supabase/migrations';
const P4 = '20261016191600_vocabulary_snapshot_set_flags.sql';
const ROLLBACK = 'docs/sql/vocabulary-snapshot-set-flags-rollback.sql';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const code = sql => sql.replace(/--[^\n]*/g, '');

const REDEFINES = /create\s+or\s+replace\s+function\s+(?:fsrs_private\.vocabulary_registry_entry|public\.fsrs_vocabulary_snapshot)\s*\(/i;
const PARITY = [
  /DO \$parity\$/,
  /CROSS JOIN LATERAL pg_catalog\.jsonb_array_elements\(s\.snap->'registry'\) AS e\(x\)/,
  /fsrs_private\.vocabulary_registry_entry\(s\.actor, \(e\.x->>'cardId'\)::uuid\) IS DISTINCT FROM e\.x/,
  /FROM \(SELECT b\.actor, public\.fsrs_vocabulary_snapshot\(b\.actor\) AS snap FROM pg_temp\.perf_snapshot_before b\) s/,
  /IF bad <> 0 THEN RAISE EXCEPTION '[\w]+: registry_entry differs from snapshot\.registry/,
  /registry card count differs from vocabulary rows/,
];
const OUTPUT_GATE = /\(public\.fsrs_vocabulary_snapshot\(b\.actor\) - 'now'\) IS DISTINCT FROM b\.body/;
const CAPTURE_ALL = /SELECT u\.user_id AS actor, public\.fsrs_vocabulary_snapshot\(u\.user_id\) - 'now' AS body\s+FROM \(SELECT DISTINCT v\.user_id FROM public\.user_vocabulary v/;

const expectGates = (name, sql) => {
  const c = code(sql);
  for (const re of PARITY) expect(c, `${name}: ${re}`).toMatch(re);
  expect(c, `${name}: 전 사용자 출력 비교`).toMatch(OUTPUT_GATE);
  expect(c, `${name}: 비교 대상 = 단어를 가진 모든 사용자`).toMatch(CAPTURE_ALL);
};

describe('registry_entry ≡ snapshot.registry (P4)', () => {
  const sql = read(`${MIGRATIONS}/${P4}`);
  const snapshotBody = code(sql).match(/CREATE OR REPLACE FUNCTION public\.fsrs_vocabulary_snapshot\(p_actor uuid\)[\s\S]*? AS \$fn\$([\s\S]*?)\$fn\$;/)?.[1];

  it('P4 carries both post-check gates: identical output for all actors and parity on every card', () => {
    expectGates(P4, sql);
  });

  it('P4 snapshot no longer calls registry_entry per row, and keeps registry_entry itself', () => {
    expect(snapshotBody).toBeTruthy();
    expect(snapshotBody).not.toMatch(/vocabulary_registry_entry/);
    expect(code(sql)).not.toMatch(/CREATE OR REPLACE FUNCTION fsrs_private\.vocabulary_registry_entry/);
  });

  it('P4 set flags keep the blocked() semantics: known(word · base_form) and the three exclusion branches, NULL-free', () => {
    const lang = "CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END";
    expect(snapshotBody).toContain('SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor');
    expect(snapshotBody).toContain(`LEFT JOIN kw k1 ON k1.lang=${lang} AND k1.w=normalize(btrim(v.word_text),NFC)`);
    expect(snapshotBody).toContain(`LEFT JOIN kw k2 ON k2.lang=${lang} AND k2.w=normalize(btrim(v.base_form),NFC)`);
    expect(snapshotBody).toContain('e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL');
    expect(snapshotBody).toContain('unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL');
    expect(snapshotBody).toContain("LEFT JOIN exw ON exw.language=v.language AND exw.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)");
    expect(snapshotBody).toContain("'excluded',x.is_known OR x.is_excluded_only");
    // IN (subquery) would turn a NULL inside retired_vocabulary_ids into excluded: null — the set flags must stay join-based
    expect(snapshotBody).not.toMatch(/\bIN\s*\(\s*SELECT/i);
    // registry_entry's per-card guard (another user's FSRS card on this actor's word) as one set check, same error
    expect(snapshotBody).toMatch(/JOIN public\.user_vocabulary v ON v\.id=f\.card_id WHERE v\.user_id=p_actor AND f\.user_id<>p_actor\)\s+THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'/);
  });

  it('the rollback SQL carries the same gates', () => {
    expectGates(ROLLBACK, read(ROLLBACK));
  });

  it('every later migration that redefines either definition carries the same gates', () => {
    const later = fs.readdirSync(path.join(ROOT, MIGRATIONS)).filter(f => f.endsWith('.sql') && f > P4).sort();
    for (const file of later) {
      const sql = read(`${MIGRATIONS}/${file}`);
      if (REDEFINES.test(code(sql))) expectGates(file, sql);
    }
  });
});

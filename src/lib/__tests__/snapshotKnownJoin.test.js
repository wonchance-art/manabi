import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { containsProductionConstants } from '../../../supabase/tests/lib/production-constants.mjs';

// PERF-SNAPSHOT-KNOWN-001(2026-11-04 KST) — 단어장 snapshot 셋의 아는 단어 판정: LEFT JOIN kw k1/k2 → 행마다 키(vv) + EXISTS.
// 운영 실측: 플래너가 k2를 언어 하나로만 merge join하고 정규화 단어 비교를 짝마다 다시 봐(Rows Removed by Join Filter 37만) ≈ 210 ms가 들었다.
// 계약(문장 모양 — 실제 출력 동일 · 재게시 · 복원은 PGlite supabase/tests/snapshot-known-join.mjs · post-observation-migrations.mjs가 본다):
// ⑴ 바꾼 곳은 한 군데 — 새 세 본문 = 옛 원문(20261101120000_fsrs_card_kinds.sql)에서 아래 세 조각만 바꾼 것, 나머지 바이트 그대로
// ⑵ 새 꼴 — LEFT JOIN kw 없음 · vv(옛 조인 키와 같은 식) + EXISTS 둘 · kw는 그대로 (lang, w) DISTINCT(그래서 옛 조인이 행을 늘리지 않았다 = EXISTS와 같다)
// ⑶ 판정은 하나 — 세 본문의 판정 조각(WITH kw … x의 WHERE 앞)이 바이트 그대로 같고, cards · light는 snapshot과 요청 검사 · x의 조건 · 출력만 다르다
// ⑷ 사전 · 사후 검사가 옛 · 새 본문 md5를 고정하고(운영 해시 상수는 없다), 재게시는 core · manual · admission을 _live 값으로만
const ROOT = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const md5 = text => createHash('md5').update(text).digest('hex');
const FILE = 'supabase/migrations/20261104090000_snapshot_known_join.sql';
const PREVIOUS = 'supabase/migrations/20261101120000_fsrs_card_kinds.sql';
const migration = read(FILE);
const previous = read(PREVIOUS);
const code = sql => sql.replace(/--[^\n]*/g, '');

const FUNCTIONS = {
  snapshot: 'public.fsrs_vocabulary_snapshot(p_actor uuid)',
  light: 'public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean)',
  cards: 'public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[])',
};
const block = (sql, sig) => {
  const text = sliceBetween(sql, `CREATE OR REPLACE FUNCTION ${sig}\n`, 'END $function$;\n');
  return `${text}END $function$;\n`;
};
/** prosrc = $function$ … $function$ 사이(pg_proc.prosrc와 같은 글자 — 사전 · 사후 md5의 대상). */
const body = text => sliceBetween(text, 'AS $function$', '$function$;').slice('AS $function$'.length);
const prosrc = body;
const LANG = "CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END";
// 바꾼 세 조각(옛 → 새). 이 밖의 글자가 하나라도 다르면 ⑴이 깨진다.
const CHANGES = [
  [' x AS (\n', [
    ' -- PERF-SNAPSHOT-KNOWN-001: per-row known-word keys (the old join keys, same expressions). kw is DISTINCT on (lang,w), so the old LEFT JOINs',
    ' -- k1/k2 matched at most one row each — EXISTS gives the same is_known without a lang-only join that rechecks the word key per pair.',
    ` vv AS (SELECT v.id, ${LANG} AS lc,`,
    '   normalize(btrim(v.word_text),NFC) AS nw, normalize(btrim(v.base_form),NFC) AS nb FROM public.user_vocabulary v WHERE v.user_id=p_actor),',
    ' x AS (\n'].join('\n')],
  ['   (k1.w IS NOT NULL OR k2.w IS NOT NULL) AS is_known,\n',
    '   (EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nw) OR EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nb)) AS is_known,\n'],
  [`  LEFT JOIN kw k1 ON k1.lang=${LANG} AND k1.w=normalize(btrim(v.word_text),NFC)\n  LEFT JOIN kw k2 ON k2.lang=${LANG} AND k2.w=normalize(btrim(v.base_form),NFC)\n`,
    '  JOIN vv ON vv.id=v.id\n'],
];
const OLD = Object.fromEntries(Object.entries(FUNCTIONS).map(([k, sig]) => [k, block(previous, sig)]));
const NEW = Object.fromEntries(Object.entries(FUNCTIONS).map(([k, sig]) => [k, block(migration, sig)]));

describe('⑴ 바꾼 곳은 한 군데 — 새 본문 = 옛 원문에서 세 조각만', () => {
  it.each(Object.keys(FUNCTIONS))('%s: 옛 원문의 세 조각이 정확히 한 번씩 있고, 바꾸면 새 본문과 바이트 그대로 같다', key => {
    let expected = OLD[key];
    for (const [from, to] of CHANGES) {
      expect(expected.split(from).length - 1, from.slice(0, 40)).toBe(1);
      expected = expected.replace(from, to);
    }
    expect(NEW[key]).toBe(expected);
  });
  it('세 함수 모두 이 파일에 정의되고, 머리 줄(반환 · 언어 · STABLE SECURITY DEFINER · search_path)이 옛 원문 그대로다', () => {
    for (const key of Object.keys(FUNCTIONS)) {
      const head = text => sliceBetween(text, 'CREATE OR REPLACE FUNCTION', 'AS $function$');
      expect(head(NEW[key])).toBe(head(OLD[key]));
      expect(head(NEW[key])).toContain(" RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO ''\n");
    }
    // 권한 문이 없다 — CREATE OR REPLACE는 소유자 · ACL을 그대로 둔다(사후 검사가 속성 · 권한 불변을 확인).
    expect(code(migration)).not.toMatch(/\b(GRANT|REVOKE|ALTER FUNCTION)\b/i);
  });
});

describe('⑵ 새 꼴 — vv + EXISTS, LEFT JOIN kw 없음', () => {
  it.each(Object.keys(FUNCTIONS))('%s', key => {
    const b = NEW[key];
    expect(b).not.toMatch(/LEFT JOIN kw\b/);
    expect(b).not.toMatch(/\bk[12]\./);
    expect(b).toContain(' WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),');
    // vv 키 = 옛 조인 조건의 식 그대로(언어 코드 · NFC(btrim(word_text)) · NFC(btrim(base_form))) — 옛 원문에 있던 식이다.
    expect(OLD[key]).toContain(`k1.lang=${LANG} AND k1.w=normalize(btrim(v.word_text),NFC)`);
    expect(OLD[key]).toContain(`k2.lang=${LANG} AND k2.w=normalize(btrim(v.base_form),NFC)`);
    expect(b).toMatch(/\n {2}FROM public\.user_vocabulary v\n {2}LEFT JOIN public\.fsrs_cards f ON f\.vocabulary_id=v\.id AND f\.kind='recognition' AND f\.user_id=p_actor\n {2}JOIN vv ON vv\.id=v\.id\n {2}LEFT JOIN exid ON exid\.id=v\.id\n/);
    // 제외 판정(exid · exw)은 조인 그대로 — 운영 · PGlite 계획에서 두 키 hash join이라 같은 문제가 없다.
    expect(b).toContain("  LEFT JOIN exw ON exw.language=v.language AND exw.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)\n");
    expect(b).toContain('   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,\n');
    // IN (subquery)는 NULL을 흘릴 수 있다(P4 계약) — EXISTS는 언제나 true/false다.
    expect(body(b)).not.toMatch(/\bIN\s*\(\s*SELECT/i);
  });
});

describe('⑶ 판정은 하나 — 세 본문의 판정 조각이 같다', () => {
  const judged = b => sliceBetween(b, ' WITH kw AS (', '  WHERE v.user_id=p_actor');
  it('WITH kw … x의 FROM/JOIN까지 세 본문이 바이트 그대로 같고, x의 WHERE만 다르다', () => {
    expect(judged(NEW.light)).toBe(judged(NEW.snapshot));
    expect(judged(NEW.cards)).toBe(judged(NEW.snapshot));
    expect(NEW.snapshot).toContain('  WHERE v.user_id=p_actor)\n');
    expect(NEW.light).toContain('  WHERE v.user_id=p_actor AND (p_language IS NULL OR v.language=p_language))\n');
    expect(NEW.cards).toContain('  WHERE v.user_id=p_actor AND v.id=ANY(p_ids))\n');
  });
  it('cards = snapshot에서 요청 검사 · id 조건만 다르다(주석 줄 빼고)', () => {
    const lines = b => body(b).split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
    const request = " IF (CASE WHEN p_ids IS NULL OR array_ndims(p_ids) IS DISTINCT FROM 1 OR cardinality(p_ids) NOT BETWEEN 1 AND 50 THEN true ELSE array_position(p_ids, NULL) IS NOT NULL END)\n THEN RAISE EXCEPTION 'invalid_fsrs_request' USING ERRCODE='22023'; END IF;\n";
    expect(lines(NEW.cards).replace(request, '').replace('  WHERE v.user_id=p_actor AND v.id=ANY(p_ids))\n', '  WHERE v.user_id=p_actor)\n')).toBe(lines(NEW.snapshot));
  });
});

describe('⑷ 사전 · 사후 검사 · 재게시 · 출력 비교', () => {
  const c = code(migration);
  it('옛 본문 md5(= 옛 원문)를 사전 검사가, 새 본문 md5를 사전(no-op) · 사후 검사가 고정한다 · 운영 해시 상수 없음', () => {
    for (const key of Object.keys(FUNCTIONS)) {
      const before = md5(prosrc(OLD[key])), after = md5(prosrc(NEW[key]));
      expect(before).not.toBe(after);
      expect(c.split(`'${before}'`).length - 1, `${key} old`).toBeGreaterThanOrEqual(1);
      expect(c.split(`'${after}'`).length - 1, `${key} new`).toBe(2);
      expect(migration).toContain(`본문 md5 ${before} → ${after}`);
    }
    expect(containsProductionConstants(migration)).toBe(false);
    expect(c).toMatch(/RAISE EXCEPTION 'snapshot_known: unreviewed function bodies %'/);
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
  });
  it('재게시 = core · manual · admission을 _live 값으로(바뀔 때만 · 1행) — profile · capability는 건드리지 않고 불변을 확인한다', () => {
    expect(c).toContain('UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();');
    expect(c).toContain('UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash_live();');
    expect(c).toMatch(/UPDATE fsrs_private\.admission_settings SET contract_hash = fsrs_private\.admission_contract_hash_live\(\)\s+WHERE contract_hash IS DISTINCT FROM fsrs_private\.admission_contract_hash_live\(\);/);
    expect(c).not.toMatch(/UPDATE fsrs_private\.activity_settings/);
    expect(c).not.toMatch(/learning_language_capabilities\(\) RETURNS/);
    expect(c).toMatch(/activity profile pin moved/);
    expect(c).toMatch(/Korean capability changed/);
    // 사전: 네 게시값 = 캐시 · _live, 한국어 ready. 사후: 같은 것 + 캐시 갱신.
    expect(sliceBetween(c, 'DO $pre$', 'END $pre$;')).toMatch(/NOT \(c->>'ok'\)::boolean OR NOT \(c->>'live_ok'\)::boolean/);
    expect(sliceBetween(c, 'DO $pre$', 'END $pre$;')).toMatch(/skj_korean_ready\(\) IS DISTINCT FROM true/);
    expect(c).toMatch(/SET CONSTRAINTS fsrs_private\.contract_cache_refresh IMMEDIATE;\nSET CONSTRAINTS fsrs_private\.contract_cache_refresh DEFERRED;\n\nDO \$post\$/);
  });
  it('전원의 출력 셋(snapshot · light 언어 NULL + 모든 언어 × 두 모양 · cards 묶음)을 바꾸기 전에 담고 뒤에 같은 인자로 비교한다', () => {
    const outputs = sliceBetween(c, 'CREATE FUNCTION pg_temp.skj_outputs(', '$q$;\n');
    expect(outputs).toContain("public.fsrs_vocabulary_snapshot(p_actor) - 'now'");
    expect(outputs).toContain("public.fsrs_vocabulary_snapshot_light(p_actor, l.lang, s.summary) - 'now'");
    expect(outputs).toContain('pg_catalog.unnest(pg_catalog.array_prepend(NULL::text, p_langs)) l(lang) CROSS JOIN pg_catalog.unnest(ARRAY[false, true]) s(summary)');
    expect(outputs).toContain('public.fsrs_vocabulary_snapshot_cards(p_actor, ARRAY(SELECT pg_catalog.jsonb_array_elements_text(b.x)::uuid))');
    // 담기는 변경(CREATE OR REPLACE) 전, 비교는 뒤.
    const captured = c.indexOf('CREATE TEMP TABLE skj_output_before'), changed = c.indexOf('CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot(');
    expect(captured).toBeGreaterThan(0);
    expect(captured).toBeLessThan(changed);
    expect(c.indexOf('pg_temp.skj_outputs(o.actor, o.langs, o.batches) IS DISTINCT FROM o.body')).toBeGreaterThan(changed);
    expect(sliceBetween(c, 'CREATE TEMP TABLE skj_actors', 'CREATE TEMP TABLE skj_output_before')).toContain('(SELECT f.user_id FROM public.fsrs_cards f UNION SELECT v.user_id FROM public.user_vocabulary v) u');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { blankComments, buildSql, extractConstants, ownBodies, pendingFiles, signatures } from './precheck-pending-migrations.mjs';

// 병합 전 운영 상수 대조(런북 K-0 일반화 — FINGERPRINT-REPIN-002 ⑶)의 추출기 계약. 스크립트는 SQL만 만든다(DB 연결 없음).
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const md5 = (s) => createHash('md5').update(s).digest('hex');
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32), D = 'd'.repeat(32);

describe('주석 밖 32자리 md5 상수만', () => {
  it('-- · /* */ 주석의 값은 세지 않고, 문자열 · 달러 인용 속 「--」는 주석이 아니다 · 줄 번호는 원문 그대로', () => {
    const sql = [
      `-- 예전 값 ${A}`,
      `/* 메모 ${B}`,
      `   여전히 주석 ${B} */ SELECT '${C}';`,
      `SELECT '-- 이건 문자열 ${D}';`,
      `DO $x$ BEGIN RAISE NOTICE '--'; PERFORM '${A}'; END $x$; -- 끝 ${B}`,
    ].join('\n');
    expect(blankComments(sql).split('\n')).toHaveLength(5);
    const got = extractConstants(sql, 'f.sql').map(({ line, value }) => [line, value]);
    expect(got).toEqual([[3, C], [4, D], [5, A]]);
  });
  it('더 긴 16진 문자열의 일부(예: 40자리 SHA)는 상수가 아니다', () => {
    expect(extractConstants(`SELECT '${'e'.repeat(40)}', '${A}';`, 'f.sql').map(c => c.value)).toEqual([A]);
  });
});

describe('파일 안에서 정해지는 값(offline)', () => {
  it('이 파일이 새로 정의하는 함수 본문의 md5 — 달러 인용 그대로 · 앞뒤 줄바꿈을 뺀 안쪽 SELECT', () => {
    const body = "\nSELECT 1\n";
    const sql = `CREATE OR REPLACE FUNCTION public.f(p uuid) RETURNS int LANGUAGE sql AS $fn$${body}$fn$;\nSELECT '${md5(body)}', '${md5('SELECT 1')}', '${A}';`;
    expect(ownBodies(sql).get(md5(body))).toBe('public.f');
    const [own, inner, other] = extractConstants(sql, 'f.sql');
    expect([own.offline, inner.offline, other.offline]).toEqual(['public.f', 'public.f (안쪽 SELECT)', '']);
  });
  it('저장소 P4: 새 snapshot 본문 md5(90cb5fb5…)는 offline, 나머지 상수는 운영에서 다시 계산할 대상', () => {
    const file = '20261016191600_vocabulary_snapshot_set_flags.sql';
    const constants = extractConstants(read(`supabase/migrations/${file}`), file);
    expect(constants.length).toBeGreaterThan(10);
    expect(new Set(constants.filter(c => c.offline === 'public.fsrs_vocabulary_snapshot').map(c => c.value))).toEqual(new Set(['90cb5fb52d43d00eeb4b5c5a41ba8b19']));
    for (const value of ['b2771b0426e2cb6aefe776edc9d0f108', 'f31dd8681a092d3df84746a0dfea9c79', '771d6c4f3ecc170b6ae0eb685771ce4e', 'da2c7548aa782ebb81d55e69d913cd52'])
      expect(constants.some(c => c.value === value && !c.offline), value).toBe(true);
    // 주석에만 있는 191500 전 core(9dcbdd…)는 대상이 아니다
    expect(constants.some(c => c.value === '9dcbdd2614642e67911d4fcf2055b42d')).toBe(false);
    expect(signatures(read(`supabase/migrations/${file}`))).toEqual(expect.arrayContaining(['fsrs_private.blocked(uuid,uuid)', 'fsrs_private.vocabulary_registry_entry(uuid,uuid)', 'public.fsrs_vocabulary_snapshot(uuid)']));
  });
});

describe('출력 SQL — 읽기 전용', () => {
  const fixture = read('supabase/tests/fixtures/m09-learning-contracts-20261010.sql');
  const sql = buildSql(extractConstants(`SELECT '${A}';`, 'x.sql'), ['public.fsrs_vocabulary_snapshot(uuid)'], fixture);
  it("read only 트랜잭션 · search_path '' · 끝은 rollback", () => {
    const lines = sql.trim().split('\n').filter(l => !l.startsWith('--'));
    expect(lines[0]).toBe('begin transaction read only;');
    expect(lines[1]).toBe("set local search_path = '';");
    expect(lines.at(-1)).toBe('rollback;');
  });
  it('쓰기 · DDL 문이 없다(문자열 · 주석 밖) — 문장은 begin · set local · with … select · rollback 넷뿐', () => {
    const code = blankComments(sql).replace(/'(?:[^']|'')*'/g, "''");
    expect(code).not.toMatch(/\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|copy|vacuum|call|do)\b\s/i);
    expect(code.split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+/)[0].toLowerCase())).toEqual(['begin', 'set', 'with', 'rollback']);
  });
  it('다시 계산하는 양 — capability 넷 · FSRS 게시 · 계산값 · 재게시 뒤 core 예측 · 이름 적힌 함수 본문 · 지문 SELECT가 운영 본문과 같은지', () => {
    for (const name of ['capability.pinned', 'capability.live', 'capability.template_md5', 'capability.fingerprint_md5', 'fsrs.core', 'fsrs.manual', 'fsrs.admission', 'fsrs.profile',
      'fsrs.core_computed', 'fsrs.core_after_capability_repin', 'prosrc_md5:public.fsrs_vocabulary_snapshot(uuid)']) expect(sql).toContain(`'${name}'`);
    expect(sql).toContain('capability_fingerprint_matches_embedded');
    expect(sql).toContain("= '2e57290ce85b8f034f7f304dfdea3ad9' as capability_fingerprint_matches_embedded");
    expect(sql).toMatch(/= '[0-9a-f]{32}' as core_fingerprint_matches_embedded/);
  });
});

describe('대상 파일', () => {
  it('--after 버전 뒤의 저장소 마이그레이션만, 버전 순서대로', () => {
    const files = pendingFiles({ after: '20261016165910', files: [] }, ROOT);
    // 첫 파일을 못 박지 않는다 — 165910 바로 뒤에 보완 파일(예: 170000)이 끼어들 수 있다. 포함 · 정렬 · 범위만.
    expect(files).toContain('supabase/migrations/20261016171800_admin_set_user_role.sql');
    expect([...files].sort()).toEqual(files);
    expect(files).toContain('supabase/migrations/20261016191600_vocabulary_snapshot_set_flags.sql');
    expect(files.every(f => path.basename(f).slice(0, 14) > '20261016165910')).toBe(true);
    expect(() => pendingFiles({ after: 'x', files: [] }, ROOT)).toThrow(/--after/);
  });
});

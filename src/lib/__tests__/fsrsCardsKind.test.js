// CARD-TYPES-001 단계 1 — 카드 표에 vocabulary_id · kind 모양만 더한다(오너 방향 승인 2026-11-01 KST · 설계 docs/design/card-types.md §4.1 · §7).
// 동작 무변경이 이 단계의 계약이다: 함수 본문 · 트리거를 손대지 않고(생성 열 · 기본값만), 옛 card_id FK를 그대로 두며, 다른 종류 행은 아직 막는다.
// 실제 적용 · 출력 동일 · 복원은 PGlite(supabase/tests/fsrs-cards-kind.mjs · post-observation-migrations.mjs)가 본다 — 여기서는 문장 모양과 이음새.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween';

const read = (f) => fs.readFileSync(f, 'utf8');
const migration = read('supabase/migrations/20261101090000_fsrs_cards_kind.sql');
const rollback = read('docs/sql/fsrs-cards-kind-rollback.sql');
const fixture = read('supabase/tests/fixtures/m09-learning-contracts-20261010.sql');
const design = read('docs/design/card-types.md');
const code = (sql) => sql.replace(/--[^\n]*/g, '');
// 두 파일의 검토한 모양 상수(이 파일 전 · 뒤) — 같은 글자여야 한다.
const shapeOf = (sql, name) => {
  const head = `CREATE FUNCTION pg_temp.${name}() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$`;
  return sliceBetween(sql, head, '$q$;').slice(head.length);
};

describe('스키마 1단계 — 열 · 제약', () => {
  const body = code(migration);
  it('vocabulary_id = card_id 생성 열(채우기 UPDATE · 트리거 없음) · kind 기본 recognition', () => {
    expect(body).toContain('ADD COLUMN vocabulary_id uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED');
    expect(body).toContain("ADD COLUMN kind text NOT NULL DEFAULT 'recognition'");
    expect(body).not.toMatch(/\bUPDATE\s+public\.fsrs_cards\b/i);
    // 문장으로 만드는 트리거 없음(모양 상수 문자열 속 'trigger CREATE TRIGGER …'은 기존 트리거의 기대 정의다).
    expect(body).not.toMatch(/^\s*(EXECUTE\s+')?CREATE\s+(OR\s+REPLACE\s+)?(CONSTRAINT\s+)?TRIGGER\b/im);
  });
  it('종류 세 값 · 단어 → 뜻 = 단어 id(영구) · 단계 1은 단어 → 뜻만', () => {
    expect(body).toContain("ADD CONSTRAINT fsrs_cards_kind_check CHECK (kind IN ('recognition', 'production', 'listening'))");
    expect(body).toContain("ADD CONSTRAINT fsrs_cards_recognition_identity_check CHECK (kind <> 'recognition' OR vocabulary_id = card_id)");
    expect(body).toContain("ADD CONSTRAINT fsrs_cards_kind_stage1_check CHECK (kind = 'recognition')");
  });
  it('새 FK는 옛 card_id FK와 같은 ON DELETE · 옛 FK는 남긴다 · 고유 (user_id, vocabulary_id, kind) · FK 검사용 인덱스', () => {
    const old = fixture.match(/ADD CONSTRAINT "fsrs_cards_card_id_fkey" FOREIGN KEY \(card_id\) REFERENCES public\.user_vocabulary\(id\) (ON DELETE \w+);/);
    expect(old?.[1]).toBe('ON DELETE RESTRICT');
    expect(body).toContain(`ADD CONSTRAINT fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary (id) ${old[1]}`);
    expect(body).not.toMatch(/DROP\s+CONSTRAINT\s+fsrs_cards_card_id_fkey/i);
    expect(body).toContain('ADD CONSTRAINT fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind)');
    expect(body).toContain('CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards (vocabulary_id)');
  });
});

describe('동작 무변경 — 함수 본문 · 출력', () => {
  const body = code(migration);
  it('함수를 만들거나 고치지 않는다(임시 도구만) · 반영 함수 본문은 LEARN-AHEAD 뒤 그대로여야 적용', () => {
    const created = [...body.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)/gi)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((n) => n.startsWith('pg_temp.'))).toBe(true);
    expect(body).not.toMatch(/pg_get_functiondef|EXECUTE\s+pg_catalog\.replace/i);
    expect(body).toContain("IS DISTINCT FROM '9bf0c8612988174843d69731a953390c' THEN RAISE EXCEPTION 'card_kinds: unreviewed fsrs_apply_operation");
    expect(body).toContain("IF pg_temp.ck_functions() IS DISTINCT FROM b.functions THEN RAISE EXCEPTION 'card_kinds: a learning function changed'");
  });
  it('사전 · 사후 검사 — 두 모양만 받는다 · 행 그대로 · 카드가 있는 사용자 전원의 출력 동일', () => {
    expect(body).toContain("RAISE EXCEPTION 'card_kinds: unreviewed state (fsrs_cards shape %)'");
    expect(body).toContain("RAISE NOTICE 'card_kinds: already applied — no-op'");
    expect(body).toMatch(/total <> b\.cards OR bad <> 0 THEN RAISE EXCEPTION 'card_kinds: rows changed/);
    expect(body).toContain("public.fsrs_vocabulary_snapshot(r.actor) - 'now' IS DISTINCT FROM r.snapshot OR public.fsrs_list_states(r.actor) IS DISTINCT FROM r.states");
  });
  it('재게시 core · admission(_live) · manual · profile은 움직이지 않는다 · 캐시 갱신 확인', () => {
    expect(body).toContain('UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live()');
    expect(body).toContain('UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()');
    expect(body).not.toMatch(/UPDATE\s+fsrs_private\.(manual_save_settings|activity_settings)/i);
    expect(body).toContain("RAISE EXCEPTION 'card_kinds: manual or profile pin moved'");
    expect(body).toContain('SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;');
  });
  it('옛 모양 상수 = 운영 관측 정의의 열 · 제약 이름', () => {
    const shape = shapeOf(migration, 'ck_old_shape');
    const table = sliceBetween(fixture, 'CREATE TABLE "public"."fsrs_cards" (', ');');
    const columns = [...table.matchAll(/^\s*"(\w+)"/gm)].map((m) => m[1]).sort();
    expect([...shape.matchAll(/'column (\w+) /g)].map((m) => m[1]).sort()).toEqual(columns);
    const constraints = [...fixture.matchAll(/ALTER TABLE "public"\."fsrs_cards" ADD CONSTRAINT "(\w+)"/g)].map((m) => m[1]).sort();
    expect([...shape.matchAll(/'constraint (\w+) /g)].map((m) => m[1]).sort()).toEqual(constraints);
    expect(shape).toContain('trigger CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards');
  });
});

describe('복원 · 이음새', () => {
  it('복원은 같은 두 모양으로 판정하고 더한 것만 지운다 · 같은 두 지문 재게시', () => {
    expect(shapeOf(rollback, 'ckr_old_shape')).toBe(shapeOf(migration, 'ck_old_shape'));
    expect(shapeOf(rollback, 'ckr_new_shape')).toBe(shapeOf(migration, 'ck_new_shape'));
    const body = code(rollback);
    for (const name of ['fsrs_cards_user_id_vocabulary_id_kind_key', 'fsrs_cards_vocabulary_id_fkey', 'fsrs_cards_kind_stage1_check',
      'fsrs_cards_recognition_identity_check', 'fsrs_cards_kind_check']) expect(body).toContain(`DROP CONSTRAINT ${name}`);
    expect(body).toContain('DROP INDEX public.fsrs_cards_vocabulary_id_idx;');
    expect(body).toContain('DROP COLUMN kind');
    expect(body).toContain('DROP COLUMN vocabulary_id');
    expect(body).not.toMatch(/DROP\s+CONSTRAINT\s+fsrs_cards_card_id_fkey|DELETE\s+FROM|\bUPDATE\s+public\./i);
    expect(body).toContain("f.vocabulary_id IS DISTINCT FROM f.card_id OR f.kind IS DISTINCT FROM ''recognition''");
    expect(body).toContain('UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live()');
    expect(body).toContain('UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()');
  });
  it('CI가 동작 검사를 돌린다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/fsrs-cards-kind.mjs');
  });
  it('클라이언트는 카드 표를 직접 읽지 않는다(새 열이 화면 출력에 새지 않는다)', () => {
    const files = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(js|jsx|ts|tsx)$/.test(f) && !f.includes('__tests__'));
    const hits = files.filter((f) => /from\(\s*['"]fsrs_cards['"]/.test(read(`src/${f}`)));
    expect(hits).toEqual([]);
  });
  it('단계 2 인벤토리 — fsrs_cards를 언급하는 함수 14개가 설계 문서에 있다', () => {
    const inventory = sliceBetween(design, '### 4.2', '## 5.');
    for (const fn of ['fsrs_apply_operation', 'fsrs_apply_learning_operation', 'fsrs_legacy_boundary', 'fsrs_list_states', 'admission_contract_hash_live',
      'guard_legacy_event', 'guard_legacy_vocabulary', 'next_question_at', 'vocabulary_registry_entry', 'fsrs_read_state', 'fsrs_vocabulary_snapshot`',
      'fsrs_vocabulary_snapshot_cards', 'fsrs_vocabulary_snapshot_light', 'learning_admit_legacy']) expect(inventory, fn).toContain(fn);
  });
});

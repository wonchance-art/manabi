-- 주인 없는 비공개 자료 10행을 지우기 전에 DB 안에 통째로 백업한다(ORPHAN-MATERIALS-001 — 오너 승인 2026-11-07 11:35 KST 「권장안대로」,
-- 오케스트레이터 경유). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나. 이 파일은 지우지 않는다(백업만).
--
-- 대상(운영 실측 11/7 KST): owner_id NULL · visibility 'private'인 id 1 · 5 · 7 · 13 · 14 · 15 · 16 · 17 · 18 · 30(옛 탈퇴 계정의 잔존 —
--   ACCOUNT-DELETE-002 전에 공개 아닌 자료가 SET NULL로 남던 것). RLS상 아무도 볼 수 없고, reading_materials를 참조하는 FK 19개
--   (단어장 · 문맥 · 진행 · 교정 · 서재 · 문법 노트 · 교재 연결 · 주석 · 댓글 · 반 · 신고 · 추천 · 원문 위치 · 모임 등) 모두 0행,
--   저장소 파일 0 · group_id · source_pdf_id · document_json · 수업 설명 · 회화 대본 없음.
-- 이 파일이 하는 것: backup_private.reading_materials_orphans_20261107 — 위 조건에 맞는 행의 모든 열(reading_materials와 같은 열) +
--   backed_up_at. anon · authenticated는 스키마부터 닫힌다. 대상 행 수가 10이 아니면 아무것도 만들지 않고 알린다(삭제 SQL이 백업 10행을
--   확인하므로 백업 없이 지워지지 않는다). 이미 백업이 있으면 다시 쓰지 않는다.
-- 삭제는 별도 — docs/sql/orphan-private-materials-20261107-delete.sql(오너가 Supabase 실행 확인 창에서 직접 승인).
-- 복원: docs/sql/orphan-private-materials-20261107-restore.sql(백업에서 같은 id로 되돌린다). 백업 표를 지우는 일은 오너 확인 뒤에만.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

create schema if not exists backup_private;
revoke all on schema backup_private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema backup_private from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema backup_private from authenticated'; end if;
end $$;

DO $backup$
DECLARE n int; ids bigint[] := array[1, 5, 7, 13, 14, 15, 16, 17, 18, 30];
BEGIN
  IF to_regclass('backup_private.reading_materials_orphans_20261107') IS NOT NULL THEN
    RAISE NOTICE 'orphan backup: already exists — not rewritten';
    RETURN;
  END IF;
  SELECT count(*) INTO n FROM public.reading_materials
   WHERE id = ANY (ids) AND owner_id IS NULL AND visibility IS DISTINCT FROM 'public';
  IF n <> cardinality(ids) THEN
    RAISE NOTICE 'orphan backup: expected % orphan private rows, found % — nothing created', cardinality(ids), n;
    RETURN;
  END IF;
  CREATE TABLE backup_private.reading_materials_orphans_20261107 AS
    SELECT m.*, now() AS backed_up_at FROM public.reading_materials m
     WHERE m.id = ANY (ids) AND m.owner_id IS NULL AND m.visibility IS DISTINCT FROM 'public';
  ALTER TABLE backup_private.reading_materials_orphans_20261107 ADD PRIMARY KEY (id);
  ALTER TABLE backup_private.reading_materials_orphans_20261107 ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE backup_private.reading_materials_orphans_20261107 FROM PUBLIC;
  RAISE NOTICE 'orphan backup: % rows saved', n;
END $backup$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') and has_schema_privilege('anon', 'backup_private', 'USAGE') then
    raise exception 'backup_private must be closed to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and has_schema_privilege('authenticated', 'backup_private', 'USAGE') then
    raise exception 'backup_private must be closed to authenticated';
  end if;
end $$;

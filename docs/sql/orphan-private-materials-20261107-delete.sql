-- 주인 없는 비공개 자료 10행 삭제(ORPHAN-MATERIALS-001 — 오너 승인 2026-11-07 11:35 KST, 실행 확인 창은 오너가 직접 승인).
-- 먼저: supabase/migrations/20261107030000_backup_orphan_private_materials.sql이 운영에 적용돼 백업 10행이 있어야 한다.
-- 이 SQL이 스스로 확인한다 — 하나라도 어긋나면 아무것도 지우지 않고 예외로 멈춘다(트랜잭션 전체 되돌림):
--   ① 백업 표에 10행 · 각 행의 raw_text · processed_json · title이 지금 행과 같다(md5)
--   ② 지금도 10행 모두 owner_id NULL · 비공개
--   ③ reading_materials를 참조하는 FK의 모든 표에서 10행을 가리키는 줄 0(카탈로그에서 FK를 읽어 센다 — 표가 늘어도 빠지지 않는다)
--   ④ 지운 행 수 = 10
-- 복원: docs/sql/orphan-private-materials-20261107-restore.sql
BEGIN;
DO $del$
DECLARE ids bigint[] := array[1, 5, 7, 13, 14, 15, 16, 17, 18, 30]; n int; f record; refs bigint; deleted int;
BEGIN
  IF to_regclass('backup_private.reading_materials_orphans_20261107') IS NULL THEN
    RAISE EXCEPTION 'orphan delete: backup table missing — stop';
  END IF;
  SELECT count(*) INTO n FROM backup_private.reading_materials_orphans_20261107 b JOIN public.reading_materials m USING (id)
   WHERE b.id = ANY (ids) AND m.owner_id IS NULL AND m.visibility IS DISTINCT FROM 'public'
     AND md5(coalesce(b.raw_text, '')) = md5(coalesce(m.raw_text, ''))
     AND md5(coalesce(b.processed_json::text, '')) = md5(coalesce(m.processed_json::text, ''))
     AND b.title IS NOT DISTINCT FROM m.title;
  IF n <> cardinality(ids) THEN RAISE EXCEPTION 'orphan delete: backup/live check matched % of % rows — stop', n, cardinality(ids); END IF;
  FOR f IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'public.reading_materials'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY ($1)', f.tbl, f.col) INTO refs USING ids;
    IF refs > 0 THEN RAISE EXCEPTION 'orphan delete: %.% still references % rows — stop', f.tbl, f.col, refs; END IF;
  END LOOP;
  DELETE FROM public.reading_materials WHERE id = ANY (ids) AND owner_id IS NULL AND visibility IS DISTINCT FROM 'public';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted <> cardinality(ids) THEN RAISE EXCEPTION 'orphan delete: deleted % rows, expected % — rolled back', deleted, cardinality(ids); END IF;
  RAISE NOTICE 'orphan delete: % rows deleted (backup kept)', deleted;
END $del$;
COMMIT;

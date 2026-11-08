-- 되돌리기: 20261108030000_zh_seed_title_fix.sql (ZH-SEED-TITLE-001 · 2026-11-08 KST). 오너 확인 뒤에만 SQL 편집기(postgres)에서 한 번.
-- 백업한 제목으로 되돌린다. 백업 표는 지우지 않는다.
BEGIN;
UPDATE public.reading_materials m SET title = b.title FROM backup_private.seed_titles_20261108 b WHERE m.id = b.material_id;
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM backup_private.seed_titles_20261108 b JOIN public.reading_materials m ON m.id = b.material_id WHERE m.title IS DISTINCT FROM b.title) THEN
    RAISE EXCEPTION 'rollback: title not restored';
  END IF;
END $post$;
COMMIT;

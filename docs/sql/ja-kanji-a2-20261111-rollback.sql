-- 복원(오너 확인 뒤에만) — 20261111010000_ja_n5_kanji_a2(JA-KANJI-A-001 A-2).
-- 백업한 25행의 raw_text · processed_json을 통째로 되돌린다(표기 · 표제어 · 분할 · metadata 전부 전환 전 그대로).
-- 전환 뒤 그 자료에 학습 기록(문맥 위치 · 저장 단어 · 읽던 위치)이 붙었으면 옛 본문 해시 · 토큰 key와 어긋나므로 멈춘다 — 그때는 오너와 다시 정한다.
-- 백업 표는 기록으로 남긴다(다시 적용하려면 백업 행을 먼저 비워야 한다 — 마이그레이션은 백업이 있으면 무변경). 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('vocabulary_contexts', 'material_id'), ('user_vocabulary', 'material_id'), ('user_vocabulary', 'source_material_id'),
      ('original_reading_positions', 'material_id'), ('library_bookmarks', 'material_id'), ('token_corrections', 'material_id')) x(tbl, col) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IN (SELECT material_id FROM backup_private.ja_kanji_a2_20261111)', r.tbl, r.col) INTO n;
      IF n > 0 THEN RAISE NOTICE 'ja kanji a2 rollback: %.% has % rows', r.tbl, r.col, n; END IF;
      total := total + n;
    END IF;
  END LOOP;
  IF total > 0 THEN RAISE EXCEPTION 'ja kanji a2 rollback: learner records exist on converted materials (%) — stop, decide with the owner', total; END IF;
END $guard$;

UPDATE public.reading_materials m
SET raw_text = b.raw_text, processed_json = b.processed_json
FROM backup_private.ja_kanji_a2_20261111 b
WHERE m.id = b.material_id;

-- 확인: 0이어야 한다.
SELECT count(*) AS differs_from_backup FROM backup_private.ja_kanji_a2_20261111 b JOIN public.reading_materials m ON m.id = b.material_id
WHERE m.raw_text IS DISTINCT FROM b.raw_text OR m.processed_json IS DISTINCT FROM b.processed_json;
COMMIT;

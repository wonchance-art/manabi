-- 복원(오너 확인 뒤에만) — 20261112040000_voa_learning_english_import(EN-SOURCE-001 ⓒ 1차).
-- 넣은 26편을 지우고 시드 작업 한 줄을 반입 전 값(status · material_ids · current_key · failure_streak · last_error · lease_until)으로 되돌린다.
-- 학습 기록이 붙기 전에만 깨끗하다 — reading_materials를 가리키는 표 다수가 ON DELETE CASCADE라(운영 실측 11/9) 아래 사전 검사가
--   그 자료를 가리키는 행을 하나라도 찾으면 아무것도 지우지 않고 멈춘다(그때는 오너와 다시 정한다 — 숨김(visibility) 등).
-- 다른 자료 · 작업의 분석 진행(chapters_done · attempts · llm_usage)은 건드리지 않는다. 백업 표는 기록으로 남긴다. 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $guard$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('user_vocabulary', 'material_id'), ('user_vocabulary', 'source_material_id'), ('reading_progress', 'material_id'),
      ('vocabulary_contexts', 'material_id'), ('library_bookmarks', 'material_id'), ('original_reading_positions', 'material_id'),
      ('daily_suggestions', 'material_id'), ('material_comments', 'material_id'), ('grammar_notes', 'material_id'),
      ('token_corrections', 'material_id'), ('study_group_reads', 'material_id'), ('class_material_copies', 'copy_material_id'),
      ('textbook_material_links', 'material_id'), ('vocab_decks', 'source_material_id')) x(tbl, col) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IN (SELECT unnest(added_ids) FROM backup_private.voa_import_job_20261109)', r.tbl, r.col) INTO n;
      IF n > 0 THEN RAISE NOTICE 'voa rollback: %.% has % rows on imported materials', r.tbl, r.col, n; END IF;
      total := total + n;
    END IF;
  END LOOP;
  IF total > 0 THEN RAISE EXCEPTION 'voa rollback: learner records exist on imported materials (%) — stop, decide with the owner', total; END IF;
END $guard$;

DELETE FROM public.reading_materials m
USING backup_private.voa_import_job_20261109 b
WHERE m.id = ANY (b.added_ids) AND m.processed_json->'metadata'->'source'->>'site' = 'voa_le';

UPDATE public.canonical_analysis_jobs j
SET status = b.status, material_ids = b.material_ids, current_key = b.current_key, failure_streak = b.failure_streak,
    last_error = b.last_error, lease_until = b.lease_until, updated_at = now()
FROM backup_private.voa_import_job_20261109 b
WHERE j.id = b.job_id;

-- 확인: 둘 다 0이어야 한다.
SELECT (SELECT count(*) FROM public.reading_materials m, backup_private.voa_import_job_20261109 b WHERE m.id = ANY (b.added_ids)) AS imported_left,
       (SELECT count(*) FROM public.canonical_analysis_jobs j JOIN backup_private.voa_import_job_20261109 b ON b.job_id = j.id
         WHERE j.material_ids IS DISTINCT FROM b.material_ids OR j.status <> b.status) AS job_differs;
COMMIT;

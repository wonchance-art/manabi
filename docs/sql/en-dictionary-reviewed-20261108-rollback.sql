-- 복원(오너 확인 뒤에만) — 20261108070000_en_dictionary_reviewed(SEED-QA-002 B).
-- 1) 이 파일이 바꾼 토큰 31개를 백업 값으로 되돌린다(빈 뜻 25 · hotter/hottest는 A가 채운 값 · #135 it's는 A가 채운 「그것은」 · #135 th는 옛 분석 값).
-- 2) it's 사전 행을 백업 값으로 되돌린다.
-- 3) 이 파일이 새로 넣은 사전 행(백업 action 'inserted')을 지운다 — 'kept'(이미 있던 행)는 건드리지 않는다.
--    크론이 그 뒤 새 행의 뜻으로 다른 토큰을 채웠다면(meaning_src 'dictionary') 그 토큰은 en-meaning-fill 복원 SQL 2)로 되돌린다.
-- 원문 · sequence · 다른 토큰 · metadata는 건드리지 않는다. 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, coalesce(b.token, d.value))
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.en_dictionary_reviewed_20261108_tokens b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM backup_private.en_dictionary_reviewed_20261108_tokens);

UPDATE public.morpheme_dictionary d
SET pos = b.row_before->>'pos', reading = b.row_before->>'reading', meanings = b.row_before->'meanings', source = b.row_before->>'source'
FROM backup_private.en_dictionary_reviewed_20261108_dict b
WHERE b.action = 'updated' AND d.language = 'English' AND d.base_form = b.base_form;

DELETE FROM public.morpheme_dictionary d
USING backup_private.en_dictionary_reviewed_20261108_dict b
WHERE b.action = 'inserted' AND d.language = 'English' AND d.base_form = b.base_form;

-- 확인: 토큰 = 백업 · 넣은 행 0 · it's 첫 뜻 = 백업.
SELECT
  (SELECT count(*) FROM backup_private.en_dictionary_reviewed_20261108_tokens b JOIN public.reading_materials m ON m.id = b.material_id
    WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM b.token) tokens_differ,
  (SELECT count(*) FROM public.morpheme_dictionary d JOIN backup_private.en_dictionary_reviewed_20261108_dict b
    ON b.action = 'inserted' AND d.language = 'English' AND d.base_form = b.base_form) inserted_left,
  (SELECT d.meanings->0->>'meaning' FROM public.morpheme_dictionary d WHERE d.language = 'English' AND d.base_form = 'it''s') its_first;
COMMIT;

-- 복원(오너 확인 뒤에만) — 20261108060000_en_meaning_fill(SEED-QA-002 A · C).
-- 1) 마이그레이션이 채운 토큰(backup_private.en_meaning_fill_20261108)을 백업 값으로 되돌린다.
-- 2) 그 뒤 크론(material_fill_empty_meanings)이 채운 토큰은 백업이 없으므로 출처 표식(meaning_src = 'dictionary')으로 찾아
--    채우기 전 모양(pos null · 뜻 빈칸 · 표식 없음)으로 되돌린다. 원래 pos는 null · 뜻은 빈칸이었다(대상 조건).
-- 3) 함수를 지운다(크론은 PGRST202를 「건너뜀」으로 받는다 — 응답 · 다른 단계는 그대로).
-- 원문 · sequence · 다른 토큰 · metadata는 건드리지 않는다. 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, coalesce(b.token, d.value))
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.en_meaning_fill_20261108 b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM backup_private.en_meaning_fill_20261108);

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, CASE WHEN d.value->>'meaning_src' = 'dictionary'
                                      THEN (d.value - 'meaning_src') || jsonb_build_object('pos', NULL, 'meaning', '')
                                      ELSE d.value END)
  FROM jsonb_each(m.processed_json->'dictionary') d))
WHERE m.visibility = 'public'
  AND m.processed_json->'metadata'->>'language' = 'English'
  AND EXISTS (SELECT 1 FROM jsonb_each(m.processed_json->'dictionary') d WHERE d.value->>'meaning_src' = 'dictionary');

DROP FUNCTION IF EXISTS public.material_fill_empty_meanings(integer);

-- 확인: 표식 남은 토큰 0 · 백업 토큰 = 지금 값.
SELECT
  (SELECT count(*) FROM public.reading_materials m, jsonb_each(m.processed_json->'dictionary') d WHERE d.value->>'meaning_src' = 'dictionary') marked_left,
  (SELECT count(*) FROM backup_private.en_meaning_fill_20261108 b JOIN public.reading_materials m ON m.id = b.material_id
    WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM b.token) differs_from_backup;
COMMIT;

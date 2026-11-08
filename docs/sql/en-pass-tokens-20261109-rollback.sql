-- 복원(오너 확인 뒤에만) — 20261109000000_en_pass_tokens(EN-LEMMA-SS ⑵).
-- 백업한 3토큰을 그대로 되돌린다. 원문 · sequence · 다른 토큰 · metadata는 건드리지 않는다. 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, coalesce(b.token, d.value))
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.en_pass_tokens_20261109 b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM backup_private.en_pass_tokens_20261109);

-- 확인: 0이어야 한다.
SELECT count(*) AS differs_from_backup FROM backup_private.en_pass_tokens_20261109 b JOIN public.reading_materials m ON m.id = b.material_id
WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM b.token;
COMMIT;

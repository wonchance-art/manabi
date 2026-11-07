-- 되돌리기: 20261108010000_punct_pos_private_materials.sql (JA-PUNCT-002 · 2026-11-08 KST).
-- 오너 확인 뒤에만 SQL 편집기(postgres)에서 한 번 실행한다. 백업한 사전 항목 104개를 고치기 전 값 그대로 되돌린다(다른 항목 · 원문 · sequence 그대로).
-- 사후 = 백업 104개와 운영 항목이 같다. 백업 표는 지우지 않는다.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, coalesce(b.token, d.value))
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.punct_tokens_private_20261108 b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM backup_private.punct_tokens_private_20261108);
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM backup_private.punct_tokens_private_20261108 b JOIN public.reading_materials m ON m.id = b.material_id
             WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM b.token) THEN
    RAISE EXCEPTION 'rollback: tokens not restored';
  END IF;
END $post$;
COMMIT;

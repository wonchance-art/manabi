-- 되돌리기: 20261108020000_zh_seed_token_fixes.sql (ZH-SEED-QA-001 · 2026-11-08 KST).
-- 오너 확인 뒤에만 SQL 편집기(postgres)에서 한 번 실행한다. 백업한 사전 항목 3개(364 全家 · 368 吃 · 370 美英)를 고치기 전 값 그대로 되돌린다.
-- 사후 = 백업 3개와 운영 항목이 같다. 백업 표는 지우지 않는다.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', b.token_key], b.token)
FROM backup_private.zh_seed_tokens_20261108 b WHERE m.id = b.material_id;
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM backup_private.zh_seed_tokens_20261108 b JOIN public.reading_materials m ON m.id = b.material_id
             WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM b.token) THEN
    RAISE EXCEPTION 'rollback: tokens not restored';
  END IF;
END $post$;
COMMIT;

-- krdict-senses.sql 되돌리기(1단계). 사전 표 3개만 지우며 user_vocabulary·다른 학습 표는 건드리지 않는다.
-- 사전 행은 같은 입력으로 다시 임포트하면 같은 해시로 복원된다(scripts/import-krdict.mjs, 결정적).
-- 카드 연결(vocabulary_krdict_senses)이 한 행이라도 있으면 사용자 기록이 사라지므로 중단한다.
-- 그때의 복구 경로는 표를 지우는 것이 아니라 앱의 연결 기록을 멈추는 것(동결)이다.
-- 다른 객체가 이 표에 기대고 있으면 CASCADE 없이 실패해 그 객체를 함께 지우지 않는다.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = '';
DO $rollback_guard$
BEGIN
  IF pg_catalog.to_regclass('public.vocabulary_krdict_senses') IS NOT NULL THEN
    LOCK TABLE public.vocabulary_krdict_senses IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM public.vocabulary_krdict_senses) THEN
      RAISE EXCEPTION 'krdict_rollback_card_links_present' USING HINT = '카드 연결이 있으면 표를 지우지 말고 기록 경로를 동결한다';
    END IF;
  END IF;
END $rollback_guard$;
DROP TABLE IF EXISTS public.vocabulary_krdict_senses;
DROP TABLE IF EXISTS public.krdict_senses;
DROP TABLE IF EXISTS public.krdict_releases;
NOTIFY pgrst, 'reload schema';
COMMIT;

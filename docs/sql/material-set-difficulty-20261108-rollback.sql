-- MATERIAL-DIFFICULTY-002 복원(20261108040000_material_set_difficulty) — 오너 확인 뒤에만 실행.
-- 하는 것: ① 쓰기 RPC 삭제 ② 모든 자료의 processed_json.metadata.difficulty 칸 하나만 제거(다른 칸 · 원문 · 분석 그대로).
-- 그 칸은 이 마이그레이션 이전에 0행에 있었다(적용 전 확인 2026-11-08 KST — 공개 · completed 132행 모두 없음) — 지워도 옛 값이 사라지지 않는다.
-- 지울 때 다른 트리거(작성기 원본 · 서재 책 표식)는 그 칸들을 바꾸지 않으므로 통과한다.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.material_set_difficulty(bigint, jsonb, text);
UPDATE public.reading_materials
   SET processed_json = processed_json #- '{metadata,difficulty}'
 WHERE processed_json->'metadata' ? 'difficulty';
DO $chk$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reading_materials WHERE processed_json->'metadata' ? 'difficulty') THEN
    RAISE EXCEPTION 'difficulty rollback: rows still carry metadata.difficulty';
  END IF;
END $chk$;
COMMIT;

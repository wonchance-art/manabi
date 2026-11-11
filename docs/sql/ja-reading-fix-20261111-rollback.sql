-- 복원(오너 확인 뒤에만) — 20261111020000_ja_n5_reading_fix(JA-KANJI-A-001 후속).
-- 백업한 자료(61 · 62)의 processed_json을 통째로 되돌린다(furigana · meaning · metadata 전부 보정 전 그대로). raw_text는 바뀐 적이 없다.
-- furigana · meaning만 바뀐 보정이라 학습 기록(토큰 key · 본문 해시)과는 묶이지 않는다 — 학습 기록 가드는 두지 않는다.
-- 백업 표는 기록으로 남긴다(다시 적용하려면 백업 행을 먼저 비워야 한다). 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.reading_materials m
SET processed_json = b.processed_json
FROM backup_private.ja_reading_fix_20261111 b
WHERE m.id = b.material_id;

-- 확인: 0이어야 한다.
SELECT count(*) AS differs_from_backup FROM backup_private.ja_reading_fix_20261111 b JOIN public.reading_materials m ON m.id = b.material_id
WHERE m.processed_json IS DISTINCT FROM b.processed_json;
COMMIT;

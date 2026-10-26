-- 복원: supabase/migrations/20261026113000_vocab_due_day_boundary_realign.sql(옛 기한을 그 학습일 04:00 KST로 맞춤)을 되돌린다.
-- 맞춘 뒤 다시 채점한 행(next_review_at이 맞춘 값과 다름)은 새 채점이 정본이라 건드리지 않는다.
-- 백업 표는 지우지 않는다(되돌린 뒤에도 증거로 남김 — 정리는 오너 결정).
BEGIN;
SET LOCAL search_path = '';
UPDATE public.user_vocabulary v SET next_review_at = b.old_next_review_at
FROM maintenance_backup.vocab_due_realign_20261026 b
WHERE v.id = b.id AND v.next_review_at = b.new_next_review_at;
-- 확인: 되돌린 수 · 남은(다시 채점한) 수
SELECT count(*) FILTER (WHERE v.next_review_at = b.old_next_review_at) AS restored,
       count(*) FILTER (WHERE v.next_review_at <> b.old_next_review_at) AS regraded_since
FROM maintenance_backup.vocab_due_realign_20261026 b JOIN public.user_vocabulary v ON v.id = b.id;
COMMIT;

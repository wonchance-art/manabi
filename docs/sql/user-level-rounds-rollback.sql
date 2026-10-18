-- 단어 목록 바퀴(user_level_rounds) 되돌리기 — LEVEL-ROUND-001 ②.
-- 바퀴 구분만 사라진다: 화면은 지금까지의 답 전부를 1바퀴로 본다(표가 없으면 조용히 물러서는 코드).
-- 답 기록(review_events source 'level') · 아는 단어 · 단어장 · 탭 표시 · FSRS는 이 표와 무관해 그대로다.
DROP TABLE IF EXISTS public.user_level_rounds;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261019020000';

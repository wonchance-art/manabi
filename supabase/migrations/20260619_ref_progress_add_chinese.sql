-- 레퍼런스 진행 동기화에 중국어(Chinese) 추가.
-- user_ref_progress.lang CHECK 제약이 일본어·영어·프랑스어만 허용해
-- 중국어 진도가 기기 간 동기화되지 못하던 문제를 해결한다.

ALTER TABLE user_ref_progress
  DROP CONSTRAINT IF EXISTS user_ref_progress_lang_check;

ALTER TABLE user_ref_progress
  ADD CONSTRAINT user_ref_progress_lang_check
  CHECK (lang IN ('Japanese', 'English', 'French', 'Chinese'));

-- user_vocabulary에 base_form 컬럼 추가
-- 활용형(食べました) 저장 시 기본형(食べる)도 함께 저장해
-- 다른 자료/활용형에서 같은 단어를 중복 인식 방지

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS base_form text;

CREATE INDEX IF NOT EXISTS user_vocab_base_form_idx
  ON user_vocabulary (user_id, base_form)
  WHERE base_form IS NOT NULL;

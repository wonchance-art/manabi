-- 단어장 어원/한자 노트 — 사전(레퍼런스)에서 저장할 때 어원·한자 "연결 지식"을 함께 담는다.
-- 사전 행의 초록 설명(.fr-vrow__etym = w.etym / w.hanja)을 단어장에서도 보여주기 위함.
-- 사전 소스와 1:1로 미러링: etym(어원), hanja(한자). 둘 다 없으면 표시 안 함.
-- 이 컬럼은 이 변경 이후 사전에서 저장하는 단어부터 채워진다(기존/리더 단어는 NULL).

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS etym text,
  ADD COLUMN IF NOT EXISTS hanja text;

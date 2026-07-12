-- 단어장 "덱" — 레퍼런스(교재)에서 저장한 단어의 출처 라벨.
-- 리더 단어는 source_material_id로 묶이지만, 교재 어휘는 출처가 없어 평면으로 쌓였음.
-- source_ref(예: "중국어 H3 · 동사")로 교재 단어도 덱으로 묶어 집중 복습 가능하게 한다.

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS source_ref text;

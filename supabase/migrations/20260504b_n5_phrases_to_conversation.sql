-- N5 실용 → 문법 강의 본문 안 회화 스크립트로 흡수
-- 강의 리스트는 문법 23편만 노출, 실용 10편은 conversation_script로 통합 후 hide
--
-- 선행 마이그레이션 (20260504_merge_phrases_into_grammar.sql)이 이미 적용된 상태에서 정정.
-- A1은 별도 마이그레이션에서 처리 예정.

BEGIN;

-- 1) conversation_script 컬럼 추가
ALTER TABLE reading_materials
  ADD COLUMN IF NOT EXISTS conversation_script text;

-- 2) 실용 자료의 raw_text → 매핑된 문법 자료의 conversation_script
--   (실용 → 문법 매핑: id → id)
--    68 인사·자기소개      → 45 ~は~です
--    159 직업·자기소개     → 46 ~じゃありません
--    158 가족·관계         → 48 ~の~
--    69 숫자·나이          → 62 조수사
--    70 시간·요일·날짜     → 55 ~ました·~ませんでした
--    71 카페·식당 주문     → 58 ~たいです
--    72 길 묻기            → 59 ~てください
--    160 쇼핑·계산         → 60 의문사 정리
--    162 교통수단          → 61 ~から/~まで
--    161 병원·증상         → 64 ~から (이유)

UPDATE reading_materials AS dst
SET conversation_script = src.raw_text
FROM reading_materials AS src
WHERE
  (dst.id = 45  AND src.id = 68)  OR
  (dst.id = 46  AND src.id = 159) OR
  (dst.id = 48  AND src.id = 158) OR
  (dst.id = 62  AND src.id = 69)  OR
  (dst.id = 55  AND src.id = 70)  OR
  (dst.id = 58  AND src.id = 71)  OR
  (dst.id = 59  AND src.id = 72)  OR
  (dst.id = 60  AND src.id = 160) OR
  (dst.id = 61  AND src.id = 162) OR
  (dst.id = 64  AND src.id = 161);

-- 3) 흡수된 실용 자료 10편은 visibility='private'로 숨김 (보존, 회복 가능)
UPDATE reading_materials SET visibility = 'private'
WHERE id IN (68, 159, 158, 69, 70, 71, 72, 160, 162, 161);

-- 4) 문법 23편 번호 재정렬 (실용 자료 사라진 자리 메우기)
--   임시 prefix로 충돌 회피
UPDATE reading_materials SET title = '__M__' || title
WHERE id IN (45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67);

UPDATE reading_materials SET title = '[N5 문법 #1] ~は~です (기본 단정문)' WHERE id = 45;
UPDATE reading_materials SET title = '[N5 문법 #2] ~じゃありません (명사 부정)' WHERE id = 46;
UPDATE reading_materials SET title = '[N5 문법 #3] これ・それ・あれ (지시 대명사)' WHERE id = 47;
UPDATE reading_materials SET title = '[N5 문법 #4] ~の~ (소유 표현)' WHERE id = 48;
UPDATE reading_materials SET title = '[N5 문법 #5] ここ・そこ・あそこ (장소 지시)' WHERE id = 49;
UPDATE reading_materials SET title = '[N5 문법 #6] あります・います (~있다)' WHERE id = 50;
UPDATE reading_materials SET title = '[N5 문법 #7] ~が好きです (~을 좋아합니다)' WHERE id = 51;
UPDATE reading_materials SET title = '[N5 문법 #8] ~を~ます (목적어 조사)' WHERE id = 52;
UPDATE reading_materials SET title = '[N5 문법 #9] ~に・~で (장소·시간 조사)' WHERE id = 53;
UPDATE reading_materials SET title = '[N5 문법 #10] ~ます (정중한 동사)' WHERE id = 54;
UPDATE reading_materials SET title = '[N5 문법 #11] ~ました・~ませんでした (과거형)' WHERE id = 55;
UPDATE reading_materials SET title = '[N5 문법 #12] い-형용사' WHERE id = 56;
UPDATE reading_materials SET title = '[N5 문법 #13] な-형용사' WHERE id = 57;
UPDATE reading_materials SET title = '[N5 문법 #14] ~たいです (~하고 싶다)' WHERE id = 58;
UPDATE reading_materials SET title = '[N5 문법 #15] ~てください (~해 주세요)' WHERE id = 59;
UPDATE reading_materials SET title = '[N5 문법 #16] 의문사 정리 (何·誰·どこ·いつ·どう·なぜ·どんな)' WHERE id = 60;
UPDATE reading_materials SET title = '[N5 문법 #17] ~から / ~まで (범위)' WHERE id = 61;
UPDATE reading_materials SET title = '[N5 문법 #18] 조수사 (~人·~枚·~本·~冊·~個·~匹)' WHERE id = 62;
UPDATE reading_materials SET title = '[N5 문법 #19] ~ませんか / ~ましょう (제안)' WHERE id = 63;
UPDATE reading_materials SET title = '[N5 문법 #20] ~から (이유)' WHERE id = 64;
UPDATE reading_materials SET title = '[N5 문법 #21] 비교 ~より' WHERE id = 65;
UPDATE reading_materials SET title = '[N5 문법 #22] 종조사 ね / よ (확인·강조)' WHERE id = 66;
UPDATE reading_materials SET title = '[N5 문법 #23] ~でしょう (추측·확인)' WHERE id = 67;

COMMIT;

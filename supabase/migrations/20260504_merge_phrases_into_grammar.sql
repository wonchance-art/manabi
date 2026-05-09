-- 실용/phrases 시리즈를 문법/grammar에 흡수
-- 학습 흐름: 문법 패턴 직후 실제 회화에서 활용 → 통합된 단일 시리즈
-- N5: 23(문법) + 10(실용) = 33편
-- A1: 20(grammar) + 10(phrases) = 30편

BEGIN;

-- N5: 임시 prefix로 UPDATE 충돌 회피
UPDATE reading_materials SET title = '__M__' || title
WHERE id IN (45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,
             68,69,70,71,72,158,159,160,161,162);

-- N5 통합 33편 — 문법 직후 회화 연계
UPDATE reading_materials SET title = '[N5 문법 #1] ~は~です (기본 단정문)' WHERE id = 45;
UPDATE reading_materials SET title = '[N5 문법 #2] 인사·자기소개' WHERE id = 68;
UPDATE reading_materials SET title = '[N5 문법 #3] ~じゃありません (명사 부정)' WHERE id = 46;
UPDATE reading_materials SET title = '[N5 문법 #4] 직업·자기소개' WHERE id = 159;
UPDATE reading_materials SET title = '[N5 문법 #5] これ・それ・あれ (지시 대명사)' WHERE id = 47;
UPDATE reading_materials SET title = '[N5 문법 #6] ~の~ (소유 표현)' WHERE id = 48;
UPDATE reading_materials SET title = '[N5 문법 #7] 가족·관계' WHERE id = 158;
UPDATE reading_materials SET title = '[N5 문법 #8] ここ・そこ・あそこ (장소 지시)' WHERE id = 49;
UPDATE reading_materials SET title = '[N5 문법 #9] 숫자·나이' WHERE id = 69;
UPDATE reading_materials SET title = '[N5 문법 #10] あります・います (~있다)' WHERE id = 50;
UPDATE reading_materials SET title = '[N5 문법 #11] ~が好きです (~을 좋아합니다)' WHERE id = 51;
UPDATE reading_materials SET title = '[N5 문법 #12] ~を~ます (목적어 조사)' WHERE id = 52;
UPDATE reading_materials SET title = '[N5 문법 #13] ~に・~で (장소·시간 조사)' WHERE id = 53;
UPDATE reading_materials SET title = '[N5 문법 #14] ~ます (정중한 동사)' WHERE id = 54;
UPDATE reading_materials SET title = '[N5 문법 #15] ~ました・~ませんでした (과거형)' WHERE id = 55;
UPDATE reading_materials SET title = '[N5 문법 #16] 시간·요일·날짜' WHERE id = 70;
UPDATE reading_materials SET title = '[N5 문법 #17] い-형용사' WHERE id = 56;
UPDATE reading_materials SET title = '[N5 문법 #18] な-형용사' WHERE id = 57;
UPDATE reading_materials SET title = '[N5 문법 #19] ~たいです (~하고 싶다)' WHERE id = 58;
UPDATE reading_materials SET title = '[N5 문법 #20] 카페·식당 주문' WHERE id = 71;
UPDATE reading_materials SET title = '[N5 문법 #21] ~てください (~해 주세요)' WHERE id = 59;
UPDATE reading_materials SET title = '[N5 문법 #22] 길 묻기' WHERE id = 72;
UPDATE reading_materials SET title = '[N5 문법 #23] 의문사 정리 (何·誰·どこ·いつ·どう·なぜ·どんな)' WHERE id = 60;
UPDATE reading_materials SET title = '[N5 문법 #24] ~から / ~まで (범위)' WHERE id = 61;
UPDATE reading_materials SET title = '[N5 문법 #25] 교통수단' WHERE id = 162;
UPDATE reading_materials SET title = '[N5 문법 #26] 조수사 (~人·~枚·~本·~冊·~個·~匹)' WHERE id = 62;
UPDATE reading_materials SET title = '[N5 문법 #27] 쇼핑·계산' WHERE id = 160;
UPDATE reading_materials SET title = '[N5 문법 #28] ~ませんか / ~ましょう (제안)' WHERE id = 63;
UPDATE reading_materials SET title = '[N5 문법 #29] ~から (이유)' WHERE id = 64;
UPDATE reading_materials SET title = '[N5 문법 #30] 병원·증상' WHERE id = 161;
UPDATE reading_materials SET title = '[N5 문법 #31] 비교 ~より' WHERE id = 65;
UPDATE reading_materials SET title = '[N5 문법 #32] 종조사 ね / よ (확인·강조)' WHERE id = 66;
UPDATE reading_materials SET title = '[N5 문법 #33] ~でしょう (추측·확인)' WHERE id = 67;

-- A1: 임시 prefix
UPDATE reading_materials SET title = '__M__' || title
WHERE id IN (113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,
             133,134,135,136,137,163,164,165,166,167);

-- A1 통합 30편
UPDATE reading_materials SET title = '[A1 grammar #1] be 동사 (am / is / are)' WHERE id = 113;
UPDATE reading_materials SET title = '[A1 grammar #2] Greetings & Introductions' WHERE id = 133;
UPDATE reading_materials SET title = '[A1 grammar #3] have / has (소유)' WHERE id = 114;
UPDATE reading_materials SET title = '[A1 grammar #4] there is / there are (존재)' WHERE id = 115;
UPDATE reading_materials SET title = '[A1 grammar #5] Family & Relationships' WHERE id = 163;
UPDATE reading_materials SET title = '[A1 grammar #6] Introductions (school/work)' WHERE id = 164;
UPDATE reading_materials SET title = '[A1 grammar #7] Numbers & Age' WHERE id = 134;
UPDATE reading_materials SET title = '[A1 grammar #8] Time & Days' WHERE id = 135;
UPDATE reading_materials SET title = '[A1 grammar #9] simple present (일상·습관)' WHERE id = 116;
UPDATE reading_materials SET title = '[A1 grammar #10] like + ing (취미)' WHERE id = 131;
UPDATE reading_materials SET title = '[A1 grammar #11] present continuous (~ing, 진행)' WHERE id = 117;
UPDATE reading_materials SET title = '[A1 grammar #12] simple past — regular verbs' WHERE id = 118;
UPDATE reading_materials SET title = '[A1 grammar #13] simple past — irregular verbs' WHERE id = 119;
UPDATE reading_materials SET title = '[A1 grammar #14] can / cannot (능력)' WHERE id = 120;
UPDATE reading_materials SET title = '[A1 grammar #15] want to (~하고 싶다)' WHERE id = 121;
UPDATE reading_materials SET title = '[A1 grammar #16] At a Café / Restaurant' WHERE id = 136;
UPDATE reading_materials SET title = '[A1 grammar #17] yes/no questions' WHERE id = 122;
UPDATE reading_materials SET title = '[A1 grammar #18] wh-questions (who/what/where/when/why/how)' WHERE id = 123;
UPDATE reading_materials SET title = '[A1 grammar #19] Asking for Directions' WHERE id = 137;
UPDATE reading_materials SET title = '[A1 grammar #20] Transportation' WHERE id = 167;
UPDATE reading_materials SET title = '[A1 grammar #21] prepositions of place (in/on/at/under/next to)' WHERE id = 124;
UPDATE reading_materials SET title = '[A1 grammar #22] prepositions of time (in/on/at)' WHERE id = 125;
UPDATE reading_materials SET title = '[A1 grammar #23] this / that / these / those' WHERE id = 126;
UPDATE reading_materials SET title = '[A1 grammar #24] articles a / an / the' WHERE id = 127;
UPDATE reading_materials SET title = '[A1 grammar #25] negative present (don''t / doesn''t)' WHERE id = 128;
UPDATE reading_materials SET title = '[A1 grammar #26] negative past (didn''t)' WHERE id = 129;
UPDATE reading_materials SET title = '[A1 grammar #27] adverbs of frequency (always/usually/often/sometimes/never)' WHERE id = 130;
UPDATE reading_materials SET title = '[A1 grammar #28] imperatives (명령·요청)' WHERE id = 132;
UPDATE reading_materials SET title = '[A1 grammar #29] Shopping & Money' WHERE id = 165;
UPDATE reading_materials SET title = '[A1 grammar #30] Health & Doctor' WHERE id = 166;

-- 캐시된 한국어 설명은 콘텐츠 그대로이므로 보존 (제목만 재정렬됨)

COMMIT;

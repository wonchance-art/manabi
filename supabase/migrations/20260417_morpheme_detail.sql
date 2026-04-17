-- 단어 상세 설명 캐시 (AI 생성 결과 영구 저장)
ALTER TABLE morpheme_dictionary ADD COLUMN IF NOT EXISTS detail_text text;

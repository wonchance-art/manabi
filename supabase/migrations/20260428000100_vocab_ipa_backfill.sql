-- 영어 단어장의 IPA 백필
-- user_vocabulary.furigana가 비어있는 영어 단어를 morpheme_dictionary.reading(IPA)으로 채움
-- IPA가 없는 단어는 그대로 둠 (이후 단어 클릭 시 자연스럽게 분석 캐시 누적)

UPDATE user_vocabulary uv
SET furigana = md.reading
FROM morpheme_dictionary md
WHERE uv.language = 'English'
  AND (uv.furigana IS NULL OR uv.furigana = '')
  AND md.language = 'English'
  AND md.base_form = uv.base_form
  AND md.reading IS NOT NULL
  AND md.reading <> '';

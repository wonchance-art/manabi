-- 영어 Wikinews 분류 3개를 오늘의 소식 원천에 더한다(EN-SOURCE-001 ⓐ — 2026-11-09 KST, 오케스트레이터 04:00 KST 승인: 「설정만, 사후 1일 수확 집계」).
-- 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나. 코드 변경 없음 — 기존 wikinews 수집기(config.category → categorymembers)가 그대로 긷는다.
--
-- 왜: 11/9 영어 소식이 YouTube 2행뿐이었다 — 기존 세 분류(Health · Science and technology · Environment)는 새 글이 드물어
--   재수록 차단(#1750) 뒤 0건(「stale 2」 × 3). 분류를 넓혀 하루 수확을 늘린다.
-- 고른 분류(정치 · 국제는 넣지 않는다 — 하드리밋 ③④와 같은 원칙): Culture and entertainment(2,214쪽) · Sports(2,462쪽) · Weather(534쪽)
--   — 분류 존재는 11/9 04:35 KST en.wikinews.org 분류 페이지로 확인했다. 라이선스 CC BY 2.5(기존 영어 Wikinews와 같다), 수준 B2(기존 행과 같다).
-- 수확 라벨: daily_suggestions.source = wikinews_en_culture_and_entertainment · wikinews_en_sports · wikinews_en_weather.
-- 멱등: 같은 언어 · 종류 · 분류의 활성 행이 이미 있으면 넣지 않는다. 다른 행은 건드리지 않는다.
-- 복원: DELETE FROM content_sources WHERE language = 'English' AND source_type = 'wikinews'
--         AND config->>'category' IN ('Culture and entertainment', 'Sports', 'Weather'); (오너 확인 뒤에만)

SET LOCAL lock_timeout = '5s';

DO $exists$
BEGIN
  IF to_regclass('public.content_sources') IS NULL THEN
    RAISE EXCEPTION 'relation public.content_sources does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

INSERT INTO public.content_sources (language, source_type, name, config, is_active)
SELECT v.language, v.source_type, v.name, v.config, true
FROM (VALUES
  ('English', 'wikinews', 'English Wikinews · Culture and entertainment', '{"category": "Culture and entertainment", "level": "B2 상급"}'::jsonb),
  ('English', 'wikinews', 'English Wikinews · Sports',                    '{"category": "Sports", "level": "B2 상급"}'::jsonb),
  ('English', 'wikinews', 'English Wikinews · Weather',                   '{"category": "Weather", "level": "B2 상급"}'::jsonb)
) v(language, source_type, name, config)
WHERE NOT EXISTS (
  SELECT 1 FROM public.content_sources c
  WHERE c.language = v.language AND c.source_type = v.source_type AND c.is_active
    AND c.config->>'category' = v.config->>'category');

DO $post$
BEGIN
  IF (SELECT count(*) FROM public.content_sources
      WHERE language = 'English' AND source_type = 'wikinews' AND is_active
        AND config->>'category' IN ('Culture and entertainment', 'Sports', 'Weather')) < 3 THEN
    RAISE EXCEPTION 'en wikinews categories: expected the three active rows';
  END IF;
END $post$;

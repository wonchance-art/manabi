-- U R4 소스 확장 — content_sources 행 추가 (v2-U R4, #1077 조사표 5509440618 → 오너 「좋은 안 있으면 그걸로 적용」, 2026-09-05)
--
-- 이 파일은 **코드**다. 운영 DB 적용은 오너 수동(하드리밋). DDL 없음 — 행만 넣는다(스키마 0).
--
-- 왜 행이 필요한가: `resolveActiveSources`는 「DB가 아는 언어는 활성 행만」 규칙이라, Japanese·English에
-- 행이 하나라도 있는 운영 환경에서는 코드 기본값(DEFAULT_SOURCES)이 잠잔다. 즉 배포만으로는 새 소스가
-- 안 켜지고, 이 행들이 켠다. French는 행이 없으면 기본값으로 이미 열린다.
--
-- 주제 태그는 소스 자신의 분류에서 — NHK는 카테고리 피드(URL), Wikinews는 카테고리(categorymembers).
-- 정치(NHK cat4)·국제(cat6)는 코드가 등록하지 않아 넣어도 수집되지 않는다(fail-closed).

-- ① NHK 카테고리 피드 (일본어) — 社会 · 科学・医療 · 文化・エンタメ
INSERT INTO content_sources (language, source_type, name, config, is_active) VALUES
  ('Japanese', 'nhk_rss', 'NHK ニュース（社会）',        '{"feed": "cat1", "level": "N3 중급"}', true),
  ('Japanese', 'nhk_rss', 'NHK ニュース（科学・医療）',   '{"feed": "cat3", "level": "N3 중급"}', true),
  ('Japanese', 'nhk_rss', 'NHK ニュース（文化・エンタメ）', '{"feed": "cat2", "level": "N3 중급"}', true);

-- ② Wikinews 카테고리 (영어) — Health · Science and technology · Environment
INSERT INTO content_sources (language, source_type, name, config, is_active) VALUES
  ('English', 'wikinews', 'English Wikinews · Health',                 '{"category": "Health", "level": "B2 상급"}', true),
  ('English', 'wikinews', 'English Wikinews · Science and technology', '{"category": "Science and technology", "level": "B2 상급"}', true),
  ('English', 'wikinews', 'English Wikinews · Environment',            '{"category": "Environment", "level": "B2 상급"}', true);

-- ③ Wikinews 카테고리 (프랑스어) — 기본값에도 있다. 프랑스어 행을 하나라도 넣는 순간 기본값이 잠자므로,
--    French 행을 두려면 wikinews_fr(카테고리 없음)·youtube 행도 같이 옮겨야 한다. 지금은 넣지 않는다.

-- ④ 본문을 담는 RSS(rss_text) — VOA(퍼블릭 도메인)·service-public.fr(Licence Ouverte 2.0). 이 세션은
--    외부 HTTP가 막혀 **피드 URL을 실측하지 못했다**. 사이트의 RSS 링크에서 섹션 피드 URL을 복사해
--    아래 꼴로 넣는다(계열 family·주제 topic·URL 셋이 다 있어야 수집된다 — 계열 밖 피드는 거부).
--   INSERT INTO content_sources (language, source_type, name, config, is_active) VALUES
--     ('English', 'rss_text', 'VOA Learning English · Health',
--      '{"family": "voa", "topic": "health", "url": "https://learningenglish.voanews.com/…(Health & Lifestyle RSS)", "level": "B1 중급"}', true),
--     ('French',  'rss_text', 'service-public.fr · Actualités',
--      '{"family": "sp", "topic": "admin", "url": "https://www.service-public.fr/…(actualités RSS)", "level": "B1 중급"}', true);

-- ⑤ 정리(선택) — 디스패처에 없는 옛 타입은 수집이 0이라 꺼 두는 편이 로그가 깨끗하다.
--   UPDATE content_sources SET is_active = false WHERE source_type IN ('nhk_easy');

-- 확인: 크론 1회 실행 로그(/api/cron/fetch-suggestions)의 saved.Japanese·saved.English가 늘고,
-- daily_suggestions.source에 'nhk_society' · 'wikinews_en_health' 같은 접미 라벨이 보이면 개통이다.

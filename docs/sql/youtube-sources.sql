-- 유튜브 추천 수집 켜기 — content_sources 행 추가 + 중복 행 끄기 (2026-10-16, 오너 「권장하는대로 ㄱㄱ」)
--
-- 왜 행이 필요한가: `resolveActiveSources`는 「DB가 아는 언어는 활성 행만」 규칙이다. 운영에는
-- Japanese·English 글 소스 행이 있어서 코드 기본값(DEFAULT_SOURCES)의 영상 소스가 잠자 있었다
-- (운영 실측: 일본어·영어 영상 카드 0건). 아래 행이 기본값과 같은 설정으로 그 둘을 켠다.
-- French는 DB 행이 없어 기본값으로 이미 돈다 — 손대지 않는다.
--
-- 비파괴: INSERT(같은 행이 있으면 건너뜀) + 중복 행 is_active=false. DELETE 없음. 되돌리기 = youtube-sources-rollback.sql.

begin;

-- ① 영상 소스 (일본어·영어) — DEFAULT_SOURCES와 같은 설정
insert into content_sources (language, source_type, name, config, is_active)
select v.language, v.source_type, v.name, v.config::jsonb, true
from (values
  ('English',  'youtube_channel', 'YouTube · VOA Learning English', '{"handle": "@VOALearningEnglish", "langCode": "en", "level": "B1 중급", "license": "public-domain"}'),
  ('Japanese', 'youtube_channel', 'YouTube · Comprehensible Japanese', '{"handle": "@cijapanese", "langCode": "ja", "level": "N4 초중급"}'),
  ('Japanese', 'youtube_channel', 'YouTube · Onomappu', '{"handle": "@Onomappu", "langCode": "ja", "level": "N3 중급"}'),
  ('Japanese', 'youtube_cc',      'YouTube CC BY · 日本語 学習', '{"query": "日本語 学習", "langCode": "ja", "level": "N3 중급"}'),
  ('English',  'youtube_cc',      'YouTube CC BY · english lesson', '{"query": "english lesson", "langCode": "en", "level": "B1 중급"}')
) as v(language, source_type, name, config)
where not exists (
  select 1 from content_sources c
  where c.language = v.language and c.source_type = v.source_type and c.config = v.config::jsonb
);

-- ② 중복 행 끄기 — 20260905100000_content_sources_r4.sql이 두 번 적용돼 NHK·Wikinews 6행이 두 벌이다.
--    같은 (언어, 타입, 설정) 중 가장 먼저 만든 행만 남기고 끈다. 수집 결과는 같고(upsert가 겹침을 접는다)
--    크론 시간만 준다.
update content_sources c set is_active = false
where c.is_active
  and exists (
    select 1 from content_sources o
    where o.language = c.language and o.source_type = c.source_type and o.config = c.config
      and (o.created_at, o.id::text) < (c.created_at, c.id::text)
  );

commit;

-- 확인
-- select language, source_type, is_active, config from content_sources order by language, source_type, created_at;
-- 다음 날: select date, language, source, channel_name, title from daily_suggestions
--         where source in ('youtube_ondemand','youtube_cc','youtube_pd') order by date desc;

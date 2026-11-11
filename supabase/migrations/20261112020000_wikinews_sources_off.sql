-- 영어 · 프랑스어 Wikinews 원천을 끈다 — 지우지 않고 is_active = false (오케스트레이터 지시 2026-11-12 KST, 백엔드 자율 범위).
-- 왜: Wikinews가 닫혔다(11/8 수확분 제목 「Wikimedia Foundation closes Wikinews after 21 years」 · en 새 글 목록 빈 목록 · Sports 분류
--   최근 글 2026-03-16 — 11/12 KST 공개 API 확인). 11/9~11/12 KST 크론 4회 동안 영어 Wikinews 6행 · 프랑스어 3개가 매일 0건,
--   빈 호출만 6~9번. 프랑스어 Wikinews는 수확 기록 자체가 0행이다(daily_suggestions 전체).
-- ① 영어: 활성 wikinews 행 6개(아래 id 고정 — 기존 3분류 + #1782의 3분류)를 is_active = false. 이미 꺼진 옛 3행은 그대로.
-- ② 프랑스어: content_sources에 행이 없어 코드 기본값(DEFAULT_SOURCES — wikinews_fr ×3 · youtube_channel @innerFrench · youtube_cc)이 돈다.
--   「DB가 아는 언어는 활성 행만 쓴다」(resolveActiveSources)라서, 기본값과 **같은 설정의 행 5개**를 넣되 wikinews_fr 3개만 끈다 —
--   영상 두 원천은 지금과 같은 설정으로 계속 돈다. 프랑스어 행이 이미 하나라도 있으면 넣지 않고 NOTICE(의도된 설정을 덮지 않는다).
-- 코드 변경 없음. 영어 대체 원천은 VOA #1784 결정 뒤.
-- 복원: docs/sql/wikinews-sources-off-20261112-rollback.sql(영어 6행을 다시 켜고, 여기서 넣은 프랑스어 5행을 지운다 → 기본값 복귀).

SET LOCAL lock_timeout = '5s';

DO $exists$
BEGIN
  IF to_regclass('public.content_sources') IS NULL THEN
    RAISE EXCEPTION 'relation public.content_sources does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

DO $en$
DECLARE n int;
BEGIN
  UPDATE public.content_sources SET is_active = false
   WHERE language = 'English' AND source_type = 'wikinews' AND is_active
     AND id IN ('ae0516b0-9e37-4149-a19d-9022edbbcae2', '852be6ac-6a85-441d-a14a-826eff3bf926', '9845fc32-367e-4a87-b72a-7e2f4241961b',
                '5f1f0bb1-a3a1-456d-8f81-9355849cb9a6', '55874ea2-c256-4758-926c-7b0263869438', '8e82889f-2e5b-4218-b4e9-cae61b830dc4');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'wikinews off: English % of 6 rows switched off', n;
  IF EXISTS (SELECT 1 FROM public.content_sources WHERE language = 'English' AND source_type = 'wikinews' AND is_active) THEN
    RAISE NOTICE 'wikinews off: another active English wikinews row exists (not in the fixed list) — left as is';
  END IF;
END $en$;

DO $fr$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_sources WHERE language = 'French') THEN
    RAISE NOTICE 'wikinews off: French already configured in content_sources — no rows inserted'; RETURN;
  END IF;
  -- 설정은 src/lib/suggestionSources.js DEFAULT_SOURCES의 프랑스어 5개와 같다(계약 supabase/tests/wikinews-sources-off.mjs가 대조).
  INSERT INTO public.content_sources (language, source_type, name, config, is_active) VALUES
    ('French', 'wikinews_fr', 'French Wikinews · récents', '{"level": "B1 중급"}'::jsonb, false),
    ('French', 'wikinews_fr', 'French Wikinews · Santé', '{"category": "Santé", "level": "B1 중급"}'::jsonb, false),
    ('French', 'wikinews_fr', 'French Wikinews · Environnement', '{"category": "Environnement", "level": "B1 중급"}'::jsonb, false),
    ('French', 'youtube_channel', 'YouTube · innerFrench', '{"handle": "@innerFrench", "langCode": "fr", "level": "B1 중급"}'::jsonb, true),
    ('French', 'youtube_cc', 'YouTube CC BY · apprendre le français', '{"query": "apprendre le français", "langCode": "fr", "level": "B1 중급"}'::jsonb, true);
  RAISE NOTICE 'wikinews off: French 5 rows inserted (wikinews_fr 3 off · video 2 on)';
END $fr$;

DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_sources WHERE language = 'English' AND source_type = 'wikinews' AND is_active
             AND id IN ('ae0516b0-9e37-4149-a19d-9022edbbcae2', '852be6ac-6a85-441d-a14a-826eff3bf926', '9845fc32-367e-4a87-b72a-7e2f4241961b',
                        '5f1f0bb1-a3a1-456d-8f81-9355849cb9a6', '55874ea2-c256-4758-926c-7b0263869438', '8e82889f-2e5b-4218-b4e9-cae61b830dc4')) THEN
    RAISE EXCEPTION 'wikinews off: English rows still active';
  END IF;
  IF EXISTS (SELECT 1 FROM public.content_sources WHERE language = 'French' AND source_type = 'wikinews_fr' AND is_active) THEN
    RAISE NOTICE 'wikinews off: an active French wikinews_fr row remains (pre-existing French configuration)';
  END IF;
END $post$;

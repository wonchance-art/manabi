-- 복원(오너 확인 뒤에만) — 20261112020000_wikinews_sources_off. 영어 Wikinews 6행을 다시 켜고, 그 마이그레이션이 넣은 프랑스어 5행을 지운다
-- (프랑스어 행이 0이 되면 코드 기본값 — wikinews_fr ×3 · 영상 2 — 이 다시 돈다). 이름 · 설정이 넣은 그대로인 행만 지운다. 한 트랜잭션.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.content_sources SET is_active = true
 WHERE language = 'English' AND source_type = 'wikinews' AND NOT is_active
   AND id IN ('ae0516b0-9e37-4149-a19d-9022edbbcae2', '852be6ac-6a85-441d-a14a-826eff3bf926', '9845fc32-367e-4a87-b72a-7e2f4241961b',
              '5f1f0bb1-a3a1-456d-8f81-9355849cb9a6', '55874ea2-c256-4758-926c-7b0263869438', '8e82889f-2e5b-4218-b4e9-cae61b830dc4');

DELETE FROM public.content_sources c
 USING (VALUES
   ('wikinews_fr', 'French Wikinews · récents', '{"level": "B1 중급"}'::jsonb),
   ('wikinews_fr', 'French Wikinews · Santé', '{"category": "Santé", "level": "B1 중급"}'::jsonb),
   ('wikinews_fr', 'French Wikinews · Environnement', '{"category": "Environnement", "level": "B1 중급"}'::jsonb),
   ('youtube_channel', 'YouTube · innerFrench', '{"handle": "@innerFrench", "langCode": "fr", "level": "B1 중급"}'::jsonb),
   ('youtube_cc', 'YouTube CC BY · apprendre le français', '{"query": "apprendre le français", "langCode": "fr", "level": "B1 중급"}'::jsonb)) v(st, nm, cfg)
 WHERE c.language = 'French' AND c.source_type = v.st AND c.name = v.nm AND c.config = v.cfg;

COMMIT;

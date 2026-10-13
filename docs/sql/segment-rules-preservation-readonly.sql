-- AD-R3 PR④ 보존 검사 — READ ONLY. segment-rules.sql(또는 롤백) 적용 **직전과 직후**에 같은 세션 권한으로 실행해 두 결과가 같아야 한다.
-- 쓰기 · 잠금 · 설정 변경이 없다(BEGIN READ ONLY). 열 이름은 운영 관측 카탈로그(m09-learning-contracts-20261010.sql)로 확인했다.
-- 기대: 학습 표의 수 · 최신 시각 · 내용 지문이 같고, FSRS 계약 넷 = true(적용 전후 모두).
BEGIN READ ONLY;
SELECT 'user_vocabulary' t, count(*) n, max(coalesce(last_reviewed_at, created_at)) latest,
  md5(coalesce(string_agg(md5(v::text), '' ORDER BY v.id), '')) fingerprint FROM public.user_vocabulary v
UNION ALL SELECT 'vocabulary_contexts', count(*), max(created_at), md5(coalesce(string_agg(md5(c::text), '' ORDER BY c.id), '')) FROM public.vocabulary_contexts c
UNION ALL SELECT 'review_events', count(*), max(created_at), md5(coalesce(string_agg(md5(e::text), '' ORDER BY e.id), '')) FROM public.review_events e
UNION ALL SELECT 'fsrs_cards', count(*), max(enrolled_at), md5(coalesce(string_agg(md5(f::text), '' ORDER BY f.card_id), '')) FROM public.fsrs_cards f
UNION ALL SELECT 'user_known_words', count(*), max(marked_at), md5(coalesce(string_agg(md5(k::text), '' ORDER BY k::text), '')) FROM public.user_known_words k
UNION ALL SELECT 'vocabulary_exclusions', count(*), max(created_at), md5(coalesce(string_agg(md5(x::text), '' ORDER BY x.id), '')) FROM public.vocabulary_exclusions x
UNION ALL SELECT 'reading_materials', count(*), max(created_at), md5(coalesce(string_agg(md5(m.id::text || md5(coalesce(m.processed_json::text, ''))), '' ORDER BY m.id), '')) FROM public.reading_materials m
UNION ALL SELECT 'morpheme_dictionary', count(*), NULL, NULL FROM public.morpheme_dictionary
ORDER BY 1;

-- 지문 철사(아키텍처 §4.9-1): 이 SQL은 철사 범위를 건드리지 않으므로 적용 전후 모두 true여야 한다.
-- 한국어 capability(learning_language_capabilities)는 로그인 사용자 기준 RPC라 SQL 편집기에서는 부르지 않는다 —
-- 적용 뒤 /api/learning/capabilities(정상 계정)로 Korean ready를 확인한다. PGlite 검사(segment-rules.mjs)는 둘 다 본다.
SELECT (SELECT contract_hash FROM fsrs_private.settings) = fsrs_private.contract_hash() core,
  (SELECT contract_hash FROM fsrs_private.manual_save_settings) = fsrs_private.manual_contract_hash() manual,
  (SELECT contract_hash FROM fsrs_private.admission_settings) = fsrs_private.admission_contract_hash() admission,
  (SELECT profile_contract_hash FROM fsrs_private.activity_settings) = fsrs_private.activity_profile_hash() activity;

-- 새 표 상태(적용 전에는 두 줄 모두 NULL, 적용 뒤에는 표 이름).
SELECT to_regclass('public.user_segment_rules') user_rules, to_regclass('public.shared_segment_rules') shared_rules;
COMMIT;

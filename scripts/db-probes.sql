-- Preflight probe — supabase-repair.yml 4단계(repair --status applied) 전에 실행하는 읽기 전용 검증.
--
-- 목적: "20260703 까지는 프로덕션에 적용돼 있다"는 가정을 날짜 추정이 아니라 **증거**로 확인한다.
--   (실사 선례: 20260613000200_dday 는 날짜상 오래됐지만 profiles.dday_date/dday_label 이 실존하지
--    않아 applied 후보에서 제외되고 push 대상으로 옮겨졌다. 같은 함정을 기계적으로 걸러낸다.)
--
-- 형식: applied 후보 52건(개명 후 버전) 각각에 대해 그 파일이 만든 대표 객체 1개를 probe 한다.
--   · 테이블   → to_regclass('public.x') IS NOT NULL
--   · 컬럼     → information_schema.columns
--   · 함수     → pg_proc (public 스키마 한정)
--   · 정책     → pg_policies
--   · 제약     → pg_constraint + pg_get_constraintdef (conrelid 비교에 to_regclass 사용 — 테이블
--                부재 시 NULL 비교로 조용히 MISSING, 오류 없음)
--   · 버킷(행) → storage.buckets 데이터 행
--   · 시드성   → 대상 테이블 존재 + 대표 행(최종 상태). 연속 시드 재작성(20260504~20260511 N5
--                레슨 시리즈)은 "마지막 작성자"의 최종 상태만 남으므로 일부 probe 는 증거를
--                공유한다(주석 명시). 최종 상태가 맞으면 중간 시드 미실행이어도 결과 동치.
--
-- 반환: (version, probe, status) 행 52+ 건. status='MISSING' 이 하나라도 있으면 워크플로가
--   repair 실행 **전에** 실패하고 해당 버전을 출력한다 — 그 버전을 applied 에서 빼고 push 로
--   옮기는 다음 반복의 근거가 된다.

SELECT * FROM (

-- ── 2026-03 ──────────────────────────────────────────────────
SELECT '20260327000100'::text AS version, 'table daily_suggestions'::text AS probe,
       CASE WHEN to_regclass('public.daily_suggestions') IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
UNION ALL
SELECT '20260327000200', 'function add_post_like',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'add_post_like') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260328000100', 'table content_sources',
       CASE WHEN to_regclass('public.content_sources') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000100', 'function is_admin',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'is_admin') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000200', 'table forum_posts',
       CASE WHEN to_regclass('public.forum_posts') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000300', 'table notifications',
       CASE WHEN to_regclass('public.notifications') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000400', 'column profiles.onboarded',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarded') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000500', 'table reading_progress',
       CASE WHEN to_regclass('public.reading_progress') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000600', 'column reading_progress.last_token_idx',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'reading_progress' AND column_name = 'last_token_idx') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000700', 'function update_streak',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'update_streak') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000800', 'column daily_suggestions.material_id',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'daily_suggestions' AND column_name = 'material_id') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260329000900', 'column user_vocabulary.source_sentence',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'user_vocabulary' AND column_name = 'source_sentence') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260330000100', 'table user_achievements',
       CASE WHEN to_regclass('public.user_achievements') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260330000200', 'function award_xp',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'award_xp') THEN 'OK' ELSE 'MISSING' END

-- ── 2026-04 ──────────────────────────────────────────────────
UNION ALL
SELECT '20260405000100', 'column profiles.goal_review',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'goal_review') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260405000200', 'policy owner_delete_material on reading_materials',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'public' AND tablename = 'reading_materials' AND policyname = 'owner_delete_material') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260405000300', 'constraint notifications_type_check includes ''system''',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c
                         WHERE c.conname = 'notifications_type_check'
                           AND c.conrelid = to_regclass('public.notifications')
                           AND pg_get_constraintdef(c.oid) LIKE '%system%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260405000400', 'table material_comments',
       CASE WHEN to_regclass('public.material_comments') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260405000500', 'policy admin_insert_suggestions on daily_suggestions',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'public' AND tablename = 'daily_suggestions' AND policyname = 'admin_insert_suggestions') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260406000100', 'policy owner_update_material on reading_materials',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'public' AND tablename = 'reading_materials' AND policyname = 'owner_update_material') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260408000100', 'column profiles.streak_freeze_count',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'streak_freeze_count') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000100', 'column grammar_notes.ease_factor',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'grammar_notes' AND column_name = 'ease_factor') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000200', 'bucket user-pdfs (private/50MB/pdf) + own-folder policies x3 on storage.objects',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets
                         WHERE id = 'user-pdfs' AND public = false
                           AND file_size_limit = 52428800
                           AND 'application/pdf' = ANY(allowed_mime_types))
             AND (SELECT count(*) FROM pg_policies
                  WHERE schemaname = 'storage' AND tablename = 'objects'
                    AND policyname IN ('user-pdfs select own', 'user-pdfs insert own', 'user-pdfs delete own')) = 3
            THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000300', 'table token_corrections',
       CASE WHEN to_regclass('public.token_corrections') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000400', 'table uploaded_pdfs',
       CASE WHEN to_regclass('public.uploaded_pdfs') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000500', 'column uploaded_pdfs.thumbnail_path',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'uploaded_pdfs' AND column_name = 'thumbnail_path') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000600', 'column vocab_decks.source_material_id',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'vocab_decks' AND column_name = 'source_material_id') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260414000700', 'table writing_practice',
       CASE WHEN to_regclass('public.writing_practice') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 20260415000100 은 20260414000200 과 같은 버킷의 DO-블록 재시도 — 증거 공유(user-pdfs 행).
SELECT '20260415000100', 'bucket user-pdfs settings (shared evidence with 20260414000200 — DO-block retry)',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets
                         WHERE id = 'user-pdfs' AND public = false
                           AND file_size_limit = 52428800
                           AND 'application/pdf' = ANY(allowed_mime_types)) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260415000200', 'table morpheme_dictionary',
       CASE WHEN to_regclass('public.morpheme_dictionary') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260415000300', 'column user_vocabulary.base_form',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'user_vocabulary' AND column_name = 'base_form') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260416000100', 'table content_reports',
       CASE WHEN to_regclass('public.content_reports') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260417000100', 'column morpheme_dictionary.detail_text',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'morpheme_dictionary' AND column_name = 'detail_text') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 시드성(데이터 UPDATE 백필) — 완료 증거: 사전에 IPA(reading)가 있는데도 furigana 가 비어 있는
-- English 단어장 행이 남아 있지 않아야 한다(2026-07-12 프로덕션 실사에서 0행 확인 — Codex).
-- 주의: 백필 이후 신규 저장 행은 앱이 채워 넣으므로(analyze 캐시) 정상 운영에선 재발하지 않는다.
SELECT '20260428000100', 'seed: no English vocab left unfilled where dictionary IPA exists (backfill done)',
       CASE WHEN to_regclass('public.user_vocabulary') IS NOT NULL
             AND to_regclass('public.morpheme_dictionary') IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM user_vocabulary uv
                   JOIN morpheme_dictionary md
                     ON md.language = 'English' AND md.base_form = uv.base_form
                    AND md.reading IS NOT NULL AND md.reading <> ''
                   WHERE uv.language = 'English'
                     AND (uv.furigana IS NULL OR uv.furigana = '')) THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 시드성(구 시드 DELETE) — 삭제 대상 35편 "전체" IN 목록의 부재가 실행 증거
-- (목록은 20260429000100_cleanup_old_seeds.sql 의 IN 목록에서 기계 추출 — 수기 오탈자 배제).
SELECT '20260429000100', 'seed: all 35 old public seed titles deleted',
       CASE WHEN to_regclass('public.reading_materials') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM reading_materials
                             WHERE visibility = 'public' AND title IN (
                               '[N5] 私の一日 (하루 일과)',
                               '[N5] 天気と季節 (날씨와 계절)',
                               '[N5] 家族の紹介 (가족 소개)',
                               '[N5] 学校の一日 (학교 하루)',
                               '[N5] 朝のあいさつ (아침 인사)',
                               '[N5] 食堂で (식당에서)',
                               '[N5] 私の趣味 (나의 취미)',
                               '[N5] 雨の日 (비 오는 날)',
                               '[N4] 休日の過ごし方 (주말 보내기)',
                               '[N4] スーパーでの買い物 (마트에서 장 보기)',
                               '[N4] 日本の四季 (일본의 사계절)',
                               '[N4] 友達と買い物 (친구와 쇼핑)',
                               '[N4] 旅行の計画 (여행 계획)',
                               '[N4] 新しい仕事 (새 직장)',
                               '[N3] インターネットと現代生活 (인터넷과 현대 생활)',
                               '[N3] 日本の伝統文化 (일본의 전통문화)',
                               '[N3] 環境問題への取り組み (환경 문제 대응)',
                               '[N2] 少子高齢化と社会への影響 (저출산 고령화와 사회 영향)',
                               '[N2] 人工知能が変える未来 (AI가 바꾸는 미래)',
                               '[N1] 言語と思考の関係性 (언어와 사고의 관계)',
                               '[A1] My Daily Routine (나의 하루 일과)',
                               '[A1] My Room (나의 방)',
                               '[A1] My Best Friend (나의 가장 친한 친구)',
                               '[A1] Going to School (학교 가기)',
                               '[A1] My Pet (나의 반려동물)',
                               '[A1] Daily Routines (하루 일과)',
                               '[A2] A Visit to My Grandparents (조부모님 방문)',
                               '[A2] My Favorite Season (내가 좋아하는 계절)',
                               '[A2] A Trip to the Beach (해변 여행)',
                               '[A2] Cooking with My Grandma (할머니와 요리하기)',
                               '[A2] My Favorite Holiday (내가 좋아하는 명절)',
                               '[B1] The Benefits of Language Learning (언어 학습의 이점)',
                               '[B1] Urban Farming: Growing Food in the City (도시 농업)',
                               '[B2] The Psychology of Procrastination (미루기의 심리학)',
                               '[C1] Artificial Intelligence and the Question of Consciousness (AI와 의식의 문제)')) THEN 'OK' ELSE 'MISSING' END

-- ── 2026-05 ──────────────────────────────────────────────────
UNION ALL
SELECT '20260501000100', 'column reading_materials.lesson_explanation_ko',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'reading_materials' AND column_name = 'lesson_explanation_ko') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- N5/A1 레슨 시드 시리즈(20260504~20260511)는 같은 행들을 연속 재작성 — 최종 상태가 증거.
-- 20260504000100 고유 증거: A1 통합·재번호(id=113 → '[A1 grammar #1] be 동사')는 이 파일만 수행
-- (20260504000200 은 "A1은 별도 마이그레이션에서 처리 예정" 명시, 20260509+ 는 N5 전용 — grep 검증).
SELECT '20260504000100', 'seed: A1 merged/renumbered — id=113 titled ''[A1 grammar #1]...''',
       CASE WHEN to_regclass('public.reading_materials') IS NOT NULL
             AND EXISTS (SELECT 1 FROM reading_materials WHERE id = 113 AND title LIKE '[A1 grammar #1]%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 20260504000200 고유 증거: conversation_script 컬럼(이 파일만 추가) + 실용 10편 private 전환.
SELECT '20260504000200', 'col conversation_script + 10 practical materials hidden (visibility=private)',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'reading_materials'
                           AND column_name = 'conversation_script')
             AND NOT EXISTS (SELECT 1 FROM reading_materials
                             WHERE id IN (68, 159, 158, 69, 70, 71, 72, 160, 162, 161)
                               AND visibility <> 'private') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 20260509000100(재배열) 고유 증거: id=49 가 '#4 ここ・そこ・あそこ' 로 재배열됨(이전 시드는 #5/#8).
SELECT '20260509000100', 'seed: reading_materials id=49 reordered to ''[N5 문법 #4]...''',
       CASE WHEN to_regclass('public.reading_materials') IS NOT NULL
             AND EXISTS (SELECT 1 FROM reading_materials WHERE id = 49 AND title LIKE '[N5 문법 #4]%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260509000200', 'seed: reading_materials id=45 has lesson_explanation_ko',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'reading_materials' AND column_name = 'lesson_explanation_ko')
             AND EXISTS (SELECT 1 FROM reading_materials WHERE id = 45 AND lesson_explanation_ko IS NOT NULL) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260511000100', 'seed: reading_materials id=45 raw_text starts ''わたしは がくせいです''',
       CASE WHEN to_regclass('public.reading_materials') IS NOT NULL
             AND EXISTS (SELECT 1 FROM reading_materials WHERE id = 45 AND raw_text LIKE 'わたしは がくせいです%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260511000200', 'seed: reading_materials id=45 explanation contains ''오늘의 패턴''',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'reading_materials' AND column_name = 'lesson_explanation_ko')
             AND EXISTS (SELECT 1 FROM reading_materials WHERE id = 45 AND lesson_explanation_ko LIKE '%오늘의 패턴%') THEN 'OK' ELSE 'MISSING' END

-- ── 2026-06 ──────────────────────────────────────────────────
-- (20260613000200_dday 는 applied 후보가 아님 — 프로덕션 실사에서 profiles.dday_date/dday_label
--  부재 확인 → push 대상으로 이동. 여기 probe 없음이 의도임.)
UNION ALL
SELECT '20260612000100', 'table user_ref_progress',
       CASE WHEN to_regclass('public.user_ref_progress') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260613000100', 'table cohorts',
       CASE WHEN to_regclass('public.cohorts') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260618000100', 'table study_plan_progress',
       CASE WHEN to_regclass('public.study_plan_progress') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260619000100', 'constraint user_ref_progress_lang_check includes ''Chinese''',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c
                         WHERE c.conname = 'user_ref_progress_lang_check'
                           AND c.conrelid = to_regclass('public.user_ref_progress')
                           AND pg_get_constraintdef(c.oid) LIKE '%Chinese%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260623000100', 'column user_vocabulary.etym',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'user_vocabulary' AND column_name = 'etym') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260623000200', 'column user_vocabulary.source_ref',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'user_vocabulary' AND column_name = 'source_ref') THEN 'OK' ELSE 'MISSING' END

-- ── 2026-07 (20260703 까지) ──────────────────────────────────
UNION ALL
SELECT '20260701000100', 'tables grammar_review + review_events',
       CASE WHEN to_regclass('public.grammar_review') IS NOT NULL
             AND to_regclass('public.review_events') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260702000100', 'column writing_practice.prompt_type',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'writing_practice' AND column_name = 'prompt_type') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 고유 증거: update_streak 존재 + buy_streak_freeze "부재"(이 파일이 DROP FUNCTION 함).
SELECT '20260703000100', 'function update_streak present AND buy_streak_freeze dropped',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'update_streak')
             AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                             WHERE n.nspname = 'public' AND p.proname = 'buy_streak_freeze') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260703000200', 'table study_paragraphs',
       CASE WHEN to_regclass('public.study_paragraphs') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

) probes
ORDER BY version, probe;

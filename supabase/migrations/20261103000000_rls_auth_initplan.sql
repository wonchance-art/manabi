-- RLS 정책의 auth 함수 호출을 한 번만 계산하게(RLS-INITPLAN-001 — 오너 승인 「1,2번은 진행」 2026-11-03 KST).
-- Supabase 성능 진단(auth_rls_initplan, WARN 95건): 정책 식에 맨 auth.uid() · auth.role()을 쓰면 Postgres가 **행마다** 다시 부른다.
-- (select auth.uid())로 감싸면 질의당 한 번(InitPlan)만 계산한다 — 같은 값이라 결과 행은 같다
-- (https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).
--
-- 범위(1단계): 아래 30개 테이블의 정책 75개 — 식 안의 맨 auth.uid() · auth.role()만 (select …)로 감싼다. 명령 · 역할 · PERMISSIVE ·
--   USING 유무 · WITH CHECK 유무 · 나머지 식은 그대로다(ALTER POLICY는 USING / WITH CHECK만 바꾼다. 원래 없는 절은 쓰지 않는다).
--   기준 = 운영 카탈로그(pg_policies, 2026-11-03 KST 조회) — 맨 호출이 있는 public 정책 92개 중, 아래 2단계 테이블을 뺀 전부.
--   대상 정책에는 이미 감싼 호출이 섞인 것이 없다(조회 0건) — 그래서 되돌리기가 정확하다(아래).
-- 2단계(이 파일 밖 — 별도 승인 · 지문 재게시와 함께): 학습 계약 지문 범위 테이블 6개의 정책 17개.
--   capability(user_vocabulary · user_known_words · review_events · reading_materials · uploaded_pdfs → core 연쇄) ·
--   activity(profiles → admission 연쇄). 정책 문자열이 바뀌면 지문이 바뀌어 운영 학습 기능이 꺼진다(#1504 선례, migrationFingerprintRepin.test.js).
--   이 파일은 그 테이블을 건드리지 않는다 — 계약 테스트가 재게시 누락을 잡는다.
--
-- 적용 경로: PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 적용한다(암묵 트랜잭션 하나 — 검사가 RAISE하면 전부 롤백).
-- 사후 검사(같은 트랜잭션): ⑴ 대상 30개 테이블에 맨 auth 호출 0 ⑵ 정책 수 · 명령 · 역할 · PERMISSIVE 불변 ⑶ 감싼 호출을 맨 호출로 되돌린 식 = 적용 전 식
--   (정책마다, USING · WITH CHECK 각각) ⑷ FSRS 계약 넷(core · manual · admission · activity) 지문 = 게시값(적용 전 운영 넷 다 true 확인).
-- 되돌리기(쓸 일 없음 — 결과가 같다): 같은 75개 정책에 감싼 호출 `( SELECT auth.uid() AS uid)` → `auth.uid()`
--   (`( SELECT auth.role() AS role)` → `auth.role()`)로 ALTER POLICY. 대상 정책에 원래 감싼 호출이 없었으므로 정확히 원래 문자열이 된다.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE rls_initplan_before ON COMMIT DROP AS
SELECT p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check
FROM pg_catalog.pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = ANY (ARRAY[
  'cohort_members','content_reports','conversation_lobby_messages','conversation_lobby_reports','forum_comment_likes','forum_comments',
  'forum_likes','forum_post_likes','forum_posts','grammar_notes','grammar_review','material_comments','morpheme_dictionary','notifications',
  'push_subscriptions','reading_progress','study_group_comments','study_group_members','study_group_snapshots','study_paragraphs',
  'study_plan_progress','token_corrections','user_achievements','user_level_rounds','user_ref_progress','user_vocab_encounters',
  'user_word_facets','vocab_deck_words','vocab_decks','writing_practice']);

ALTER POLICY members_delete_self ON public.cohort_members USING ((user_id = (select auth.uid())));
ALTER POLICY "admins can update reports" ON public.content_reports USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
ALTER POLICY "admins can view all reports" ON public.content_reports USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
ALTER POLICY "users can create reports" ON public.content_reports WITH CHECK ((((select auth.uid()) = reporter_id) AND (NOT (EXISTS ( SELECT 1
   FROM reading_materials m
  WHERE ((m.id = content_reports.material_id) AND (m.owner_id = (select auth.uid()))))))));
ALTER POLICY "users can view own reports" ON public.content_reports USING (((select auth.uid()) = reporter_id));
ALTER POLICY lobby_messages_delete ON public.conversation_lobby_messages USING (((user_id = (select auth.uid())) OR is_admin()));
ALTER POLICY lobby_messages_read ON public.conversation_lobby_messages USING (((hidden_at IS NULL) OR (user_id = (select auth.uid())) OR is_admin()));
ALTER POLICY lobby_messages_write ON public.conversation_lobby_messages WITH CHECK (((user_id = (select auth.uid())) AND (hidden_at IS NULL)));
ALTER POLICY lobby_reports_own ON public.conversation_lobby_reports USING ((reporter_id = (select auth.uid())));
ALTER POLICY lobby_reports_write ON public.conversation_lobby_reports WITH CHECK ((reporter_id = (select auth.uid())));
ALTER POLICY "Auth users can like comments" ON public.forum_comment_likes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can unlike own" ON public.forum_comment_likes USING (((select auth.uid()) = user_id));
ALTER POLICY auth_insert_comments ON public.forum_comments WITH CHECK (((select auth.uid()) = author_id));
ALTER POLICY owner_delete_comments ON public.forum_comments USING (((select auth.uid()) = author_id));
ALTER POLICY auth_delete_likes ON public.forum_likes USING (((select auth.uid()) = user_id));
ALTER POLICY auth_insert_likes ON public.forum_likes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Auth users can like" ON public.forum_post_likes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can unlike own" ON public.forum_post_likes USING (((select auth.uid()) = user_id));
ALTER POLICY delete_own ON public.forum_posts USING (((select auth.uid()) = author_id));
ALTER POLICY insert_auth ON public.forum_posts WITH CHECK (((select auth.uid()) = author_id));
ALTER POLICY own_grammar_notes ON public.grammar_notes USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY grammar_review_delete_own ON public.grammar_review USING (((select auth.uid()) = user_id));
ALTER POLICY grammar_review_insert_own ON public.grammar_review WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY grammar_review_select_own ON public.grammar_review USING (((select auth.uid()) = user_id));
ALTER POLICY grammar_review_update_own ON public.grammar_review USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Auth users can post comments" ON public.material_comments WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "User can delete own comment" ON public.material_comments USING (((select auth.uid()) = user_id));
ALTER POLICY "Authenticated can read dictionary" ON public.morpheme_dictionary USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Auth users insert notifications" ON public.notifications WITH CHECK (((select auth.uid()) = actor_id));
ALTER POLICY "Users read own notifications" ON public.notifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users update own notifications" ON public.notifications USING (((select auth.uid()) = user_id));
ALTER POLICY insert_notifications ON public.notifications WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY read_own_notifications ON public.notifications USING ((user_id = (select auth.uid())));
ALTER POLICY update_own_notifications ON public.notifications USING ((user_id = (select auth.uid())));
ALTER POLICY push_subscriptions_delete_own ON public.push_subscriptions USING (((select auth.uid()) = user_id));
ALTER POLICY push_subscriptions_insert_own ON public.push_subscriptions WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY push_subscriptions_select_own ON public.push_subscriptions USING (((select auth.uid()) = user_id));
ALTER POLICY push_subscriptions_update_own ON public.push_subscriptions USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY own_reading_progress ON public.reading_progress USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY study_group_comments_delete_self ON public.study_group_comments USING ((user_id = (select auth.uid())));
ALTER POLICY study_group_comments_insert_self ON public.study_group_comments WITH CHECK (((user_id = (select auth.uid())) AND is_group_member(group_id)));
ALTER POLICY study_group_members_delete_self ON public.study_group_members USING ((user_id = (select auth.uid())));
ALTER POLICY study_group_snapshots_insert_self ON public.study_group_snapshots WITH CHECK (((user_id = (select auth.uid())) AND is_group_member(group_id)));
ALTER POLICY study_group_snapshots_update_self ON public.study_group_snapshots USING ((user_id = (select auth.uid()))) WITH CHECK (((user_id = (select auth.uid())) AND is_group_member(group_id)));
ALTER POLICY study_paragraphs_delete_own ON public.study_paragraphs USING (((select auth.uid()) = user_id));
ALTER POLICY study_paragraphs_insert_own ON public.study_paragraphs WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY study_paragraphs_select_own ON public.study_paragraphs USING (((select auth.uid()) = user_id));
ALTER POLICY study_paragraphs_update_own ON public.study_paragraphs USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY study_plan_delete_own ON public.study_plan_progress USING (((select auth.uid()) = user_id));
ALTER POLICY study_plan_insert_own ON public.study_plan_progress WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY study_plan_select_own ON public.study_plan_progress USING (((select auth.uid()) = user_id));
ALTER POLICY study_plan_update_own ON public.study_plan_progress USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Authenticated users can insert corrections" ON public.token_corrections WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Owner or author can view corrections" ON public.token_corrections USING ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM reading_materials m
  WHERE ((m.id = token_corrections.material_id) AND (m.owner_id = (select auth.uid())))))));
ALTER POLICY users_own_achievements ON public.user_achievements USING (((select auth.uid()) = user_id));
ALTER POLICY user_level_rounds_delete_own ON public.user_level_rounds USING ((user_id = (select auth.uid())));
ALTER POLICY user_level_rounds_insert_own ON public.user_level_rounds WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY user_level_rounds_select_own ON public.user_level_rounds USING ((user_id = (select auth.uid())));
ALTER POLICY ref_progress_delete_own ON public.user_ref_progress USING (((select auth.uid()) = user_id));
ALTER POLICY ref_progress_insert_own ON public.user_ref_progress WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY ref_progress_select_own ON public.user_ref_progress USING (((select auth.uid()) = user_id));
ALTER POLICY ref_progress_update_own ON public.user_ref_progress USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY vocab_encounters_insert_own ON public.user_vocab_encounters WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY vocab_encounters_select_own ON public.user_vocab_encounters USING (((select auth.uid()) = user_id));
ALTER POLICY user_word_facets_delete_own ON public.user_word_facets USING ((user_id = (select auth.uid())));
ALTER POLICY user_word_facets_insert_own ON public.user_word_facets WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY user_word_facets_select_own ON public.user_word_facets USING ((user_id = (select auth.uid())));
ALTER POLICY user_word_facets_update_own ON public.user_word_facets USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Owner can delete deck words" ON public.vocab_deck_words USING ((EXISTS ( SELECT 1
   FROM vocab_decks
  WHERE ((vocab_decks.id = vocab_deck_words.deck_id) AND (vocab_decks.owner_id = (select auth.uid()))))));
ALTER POLICY "Owner can insert deck words" ON public.vocab_deck_words WITH CHECK ((EXISTS ( SELECT 1
   FROM vocab_decks
  WHERE ((vocab_decks.id = vocab_deck_words.deck_id) AND (vocab_decks.owner_id = (select auth.uid()))))));
ALTER POLICY "Owner can delete deck" ON public.vocab_decks USING (((select auth.uid()) = owner_id));
ALTER POLICY "Owner can insert deck" ON public.vocab_decks WITH CHECK (((select auth.uid()) = owner_id));
ALTER POLICY "Users can delete their own writing practice" ON public.writing_practice USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert their own writing practice" ON public.writing_practice WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own writing practice" ON public.writing_practice USING (((select auth.uid()) = user_id));

-- 사후 검사 — 하나라도 어긋나면 RAISE → 이 파일 전체와 이력 기록이 함께 롤백된다.
DO $check$
DECLARE
  unwrap constant text := '\( SELECT auth\.(uid|role)\(\) AS (uid|role)\)';
  v_bare integer; v_count_before integer; v_count_after integer; v_diff integer; v_changed integer; v_fsrs boolean;
BEGIN
  SELECT count(*) INTO v_count_before FROM rls_initplan_before;
  SELECT count(*) INTO v_count_after FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename IN (SELECT DISTINCT tablename FROM rls_initplan_before);
  IF v_count_before <> v_count_after THEN
    RAISE EXCEPTION 'rls_auth_initplan: policy count changed (% -> %)', v_count_before, v_count_after;
  END IF;

  SELECT count(*) INTO v_bare FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename IN (SELECT DISTINCT tablename FROM rls_initplan_before)
      AND pg_catalog.regexp_replace(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''), unwrap, '', 'g') ~ 'auth\.(uid|role|jwt)\(\)';
  IF v_bare <> 0 THEN
    RAISE EXCEPTION 'rls_auth_initplan: % policies still call auth.* per row', v_bare;
  END IF;

  -- 감싼 호출을 맨 호출로 되돌리면 적용 전 식과 글자 그대로 같아야 한다(명령 · 역할 · PERMISSIVE · 절 유무 포함).
  SELECT count(*) INTO v_diff
  FROM rls_initplan_before b
  LEFT JOIN pg_catalog.pg_policies a ON a.schemaname = 'public' AND a.tablename = b.tablename AND a.policyname = b.policyname
  WHERE a.policyname IS NULL
     OR a.cmd IS DISTINCT FROM b.cmd OR a.permissive IS DISTINCT FROM b.permissive OR a.roles IS DISTINCT FROM b.roles
     OR pg_catalog.regexp_replace(a.qual, unwrap, 'auth.\1()', 'g') IS DISTINCT FROM b.qual
     OR pg_catalog.regexp_replace(a.with_check, unwrap, 'auth.\1()', 'g') IS DISTINCT FROM b.with_check;
  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'rls_auth_initplan: % policies differ from their originals beyond the select-wrap', v_diff;
  END IF;

  SELECT count(*) INTO v_changed
  FROM rls_initplan_before b JOIN pg_catalog.pg_policies a ON a.schemaname = 'public' AND a.tablename = b.tablename AND a.policyname = b.policyname
  WHERE a.qual IS DISTINCT FROM b.qual OR a.with_check IS DISTINCT FROM b.with_check;
  RAISE NOTICE 'rls_auth_initplan: % policies rewritten (75 expected on first apply, 0 on re-apply)', v_changed;

  -- 학습 계약 지문 넷이 그대로 게시값과 같아야 한다(이 파일은 지문 범위 테이블을 건드리지 않는다 — 안전망).
  -- 게시 행이 없는 새 DB(로컬 · 브랜치)는 비교할 게시값이 없어 통과로 본다 — 운영에는 넷 다 있다(적용 전 조회 true).
  IF pg_catalog.to_regclass('fsrs_private.settings') IS NOT NULL THEN
    EXECUTE $q$SELECT coalesce((SELECT s.contract_hash = fsrs_private.contract_hash() FROM fsrs_private.settings s LIMIT 1), true)
       AND coalesce((SELECT s.contract_hash = fsrs_private.manual_contract_hash() FROM fsrs_private.manual_save_settings s LIMIT 1), true)
       AND coalesce((SELECT s.contract_hash = fsrs_private.admission_contract_hash() FROM fsrs_private.admission_settings s LIMIT 1), true)
       AND coalesce((SELECT s.profile_contract_hash = fsrs_private.activity_profile_hash() FROM fsrs_private.activity_settings s LIMIT 1), true)$q$
      INTO v_fsrs;
    IF v_fsrs IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'rls_auth_initplan: an FSRS contract fingerprint no longer matches its published value';
    END IF;
  END IF;
END $check$;

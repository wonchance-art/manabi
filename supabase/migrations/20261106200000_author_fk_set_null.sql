-- 관리자 · 교사 계정 탈퇴가 작성자 기록 FK에 막히던 것 고침(ACCOUNT-DELETE-003 — 발매 준비 점검 6d,
-- 오너 「오류를 잡는 작업은 일단 바로 진행」 2026-11-06 KST · 오너 11/4 「백엔드 · 데이터 자율」).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백).
--
-- 운영 실측(읽기 전용, 2026-11-06 KST): auth.users를 기본값(NO ACTION)으로 참조하는 작성자 열 5개 — 그 사람이 쓴 행이 있으면
-- auth.users 삭제(계정 탈퇴)가 23503으로 막힌다. 교사는 교재 주석 이력(textbook_annotation_revisions.actor_id)만으로도 막힌다.
--   content_overrides.updated_by(NULL 허용) · textbook_book_drafts.updated_by · textbook_book_editions.published_by ·
--   textbook_book_releases.updated_by · textbook_annotation_revisions.actor_id(넷은 NOT NULL). 현재 해당 행 8 · 작성자 1명.
-- 이 파일이 하는 것: 다섯 FK를 ON DELETE SET NULL로(넷은 NOT NULL을 먼저 푼다). 탈퇴해도 교재 판 · 공개 · 주석 이력 · 챕터 수정본은
--   그대로 남고 작성자 칸만 비는다(공개 교재가 한 사람의 탈퇴로 사라지지 않게 — 공개 자료 SET NULL과 같은 방침).
--   쓰기 경로(publish_textbook_book · save_textbook_book_draft · save_textbook_annotation · 정책 WITH CHECK)는 새 행에 언제나
--   auth.uid()를 넣으므로 NOT NULL을 풀어도 새 쓰기가 NULL을 만들지 않는다 — NULL은 탈퇴한 작성자의 옛 행에만 생긴다.
-- 학습 계약 지문(core · manual · admission · activity · capability 9표) 범위 밖 — 사후 검사가 네 지문 불변을 확인한다(로그인 없이 읽힌다).
-- 사전 검사: 다섯 표가 없으면 42P01(로컬 fixture 사슬) · 다섯 FK가 지금 NO ACTION이 아니면 거절(이미 바뀜).
-- 사후 검사: 다섯 FK = SET NULL · 넷 NULL 허용 · 행 수 · 작성자 값 불변 · 지문 불변.
-- 복원: docs/sql/author-fk-set-null-20261106-rollback.sql(NO ACTION · NOT NULL로 — 탈퇴로 NULL이 생긴 뒤에는 그 행을 정리해야 돌아간다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE afk_target (tbl text, col text, con text, was_not_null boolean) ON COMMIT DROP;
INSERT INTO afk_target VALUES
  ('content_overrides', 'updated_by', 'content_overrides_updated_by_fkey', false),
  ('textbook_book_drafts', 'updated_by', 'textbook_book_drafts_updated_by_fkey', true),
  ('textbook_book_editions', 'published_by', 'textbook_book_editions_published_by_fkey', true),
  ('textbook_book_releases', 'updated_by', 'textbook_book_releases_updated_by_fkey', true),
  ('textbook_annotation_revisions', 'actor_id', 'textbook_annotation_revisions_actor_id_fkey', true);

DO $pre$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM pg_temp.afk_target LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN
      RAISE EXCEPTION 'relation public.% does not exist', t.tbl USING ERRCODE = '42P01';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid = to_regclass('public.' || t.tbl) AND c.conname = t.con
                     AND c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND c.confdeltype = 'a') THEN
      RAISE EXCEPTION 'author fk: % is not the expected NO ACTION reference to auth.users (already changed?)', t.con;
    END IF;
  END LOOP;
END $pre$;

-- 행 수 · 작성자 값 지문(사후 비교) · 학습 계약 네 지문(함수가 있을 때만 — 로컬 fixture에서도 계획 단계에서 깨지지 않게 동적 호출).
CREATE TEMP TABLE afk_before (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.afk_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE t record; f record; val text;
BEGIN
  FOR t IN SELECT * FROM pg_temp.afk_target LOOP
    EXECUTE format('SELECT count(*)::text || ''|'' || coalesce(md5(string_agg(coalesce(%I::text, ''-''), '','' ORDER BY %I::text)), '''') FROM public.%I', t.col, t.col, t.tbl) INTO val;
    k := 'rows:' || t.tbl; v := val; RETURN NEXT;
  END LOOP;
  FOR f IN SELECT * FROM (VALUES ('core', 'contract_hash_live'), ('manual', 'manual_contract_hash_live'),
      ('admission', 'admission_contract_hash_live'), ('activity', 'activity_profile_hash_live')) x(k, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'fsrs_private' AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT fsrs_private.%I()::text', f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.afk_before SELECT * FROM pg_temp.afk_measure();

ALTER TABLE public.textbook_book_drafts ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.textbook_book_editions ALTER COLUMN published_by DROP NOT NULL;
ALTER TABLE public.textbook_book_releases ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.textbook_annotation_revisions ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE public.content_overrides DROP CONSTRAINT content_overrides_updated_by_fkey,
  ADD CONSTRAINT content_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.textbook_book_drafts DROP CONSTRAINT textbook_book_drafts_updated_by_fkey,
  ADD CONSTRAINT textbook_book_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.textbook_book_editions DROP CONSTRAINT textbook_book_editions_published_by_fkey,
  ADD CONSTRAINT textbook_book_editions_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.textbook_book_releases DROP CONSTRAINT textbook_book_releases_updated_by_fkey,
  ADD CONSTRAINT textbook_book_releases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.textbook_annotation_revisions DROP CONSTRAINT textbook_annotation_revisions_actor_id_fkey,
  ADD CONSTRAINT textbook_annotation_revisions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

DO $post$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM pg_temp.afk_target LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid = to_regclass('public.' || t.tbl) AND c.conname = t.con
                     AND c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND c.confdeltype = 'n' AND c.convalidated) THEN
      RAISE EXCEPTION 'author fk: % is not ON DELETE SET NULL after change', t.con;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = to_regclass('public.' || t.tbl) AND a.attname = t.col AND a.attnotnull) THEN
      RAISE EXCEPTION 'author fk: %.% still NOT NULL', t.tbl, t.col;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_temp.afk_before b FULL JOIN pg_temp.afk_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'author fk: rows, authors or learning contract fingerprints changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.afk_measure();

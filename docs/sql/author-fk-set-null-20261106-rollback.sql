-- 복원: supabase/migrations/20261106180000_author_fk_set_null.sql → 작성자 FK 5개를 NO ACTION으로, 넷을 NOT NULL로 되돌린다.
-- 되돌리면 관리자 · 교사 계정 탈퇴가 다시 막힌다. 탈퇴로 작성자가 NULL이 된 행이 있으면 SET NOT NULL이 실패한다 — 그 행을 먼저
-- 다른 관리자 id로 채우거나(오너 결정) 이 파일을 쓰지 않는다. 필요할 때만 오너 확인 뒤 실행.
BEGIN;
ALTER TABLE public.content_overrides DROP CONSTRAINT content_overrides_updated_by_fkey,
  ADD CONSTRAINT content_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.textbook_book_drafts DROP CONSTRAINT textbook_book_drafts_updated_by_fkey,
  ADD CONSTRAINT textbook_book_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.textbook_book_editions DROP CONSTRAINT textbook_book_editions_published_by_fkey,
  ADD CONSTRAINT textbook_book_editions_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id);
ALTER TABLE public.textbook_book_releases DROP CONSTRAINT textbook_book_releases_updated_by_fkey,
  ADD CONSTRAINT textbook_book_releases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.textbook_annotation_revisions DROP CONSTRAINT textbook_annotation_revisions_actor_id_fkey,
  ADD CONSTRAINT textbook_annotation_revisions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);
ALTER TABLE public.textbook_book_drafts ALTER COLUMN updated_by SET NOT NULL;
ALTER TABLE public.textbook_book_editions ALTER COLUMN published_by SET NOT NULL;
ALTER TABLE public.textbook_book_releases ALTER COLUMN updated_by SET NOT NULL;
ALTER TABLE public.textbook_annotation_revisions ALTER COLUMN actor_id SET NOT NULL;
COMMIT;

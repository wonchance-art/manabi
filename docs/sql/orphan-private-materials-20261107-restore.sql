-- 복원: docs/sql/orphan-private-materials-20261107-delete.sql로 지운 주인 없는 비공개 자료 10행을 백업에서 같은 id로 되돌린다.
-- 백업 표(backup_private.reading_materials_orphans_20261107)는 20261107030000이 만든다. 이미 있는 id는 건너뛴다(다시 돌려도 안전).
-- 필요할 때만 오너 확인 뒤 실행.
BEGIN;
INSERT INTO public.reading_materials (id, title, raw_text, processed_json, created_at, visibility, owner_id, group_id, source_pdf_id,
  page_start, page_end, lesson_explanation_ko, conversation_script, direction, document_json)
OVERRIDING SYSTEM VALUE
SELECT b.id, b.title, b.raw_text, b.processed_json, b.created_at, b.visibility, b.owner_id, b.group_id, b.source_pdf_id,
  b.page_start, b.page_end, b.lesson_explanation_ko, b.conversation_script, b.direction, b.document_json
  FROM backup_private.reading_materials_orphans_20261107 b
 WHERE NOT EXISTS (SELECT 1 FROM public.reading_materials m WHERE m.id = b.id);
COMMIT;

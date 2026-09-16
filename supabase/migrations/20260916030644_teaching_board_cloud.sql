-- Private teacher board heads. Drawings never enter reading_materials/student feeds.
-- Apply only after review; local SQL tests exercise authenticated and denied roles.
BEGIN;
CREATE TABLE public.class_teaching_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  root_id bigint NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE,
  day date NOT NULL,
  revision uuid,
  manifest jsonb,
  previous_manifest jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,root_id,day),
  CHECK ((revision IS NULL)=(manifest IS NULL))
);
CREATE INDEX class_teaching_boards_root_idx ON public.class_teaching_boards(root_id);
ALTER TABLE public.class_teaching_boards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_teaching_boards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.class_teaching_boards TO authenticated;
CREATE POLICY "teacher board owner read" ON public.class_teaching_boards FOR SELECT TO authenticated USING (
 owner_id=(select auth.uid()) AND EXISTS (
  SELECT 1 FROM public.reading_materials r WHERE r.id=root_id AND r.owner_id=(select auth.uid()) AND r.processed_json->'metadata'->'team'->>'root'='true'
 )
);
-- Deliberate narrow write API: callers cannot reassign ownership, identity or
-- revisions via table updates. Each function authenticates and checks the root.
CREATE FUNCTION public.teaching_board_prepare(p_root bigint,p_day date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=auth.uid(); b public.class_teaching_boards;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.reading_materials WHERE id=p_root AND owner_id=uid AND processed_json->'metadata'->'team'->>'root'='true') THEN RAISE EXCEPTION 'teacher_required' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL OR p_day<'1900-01-01' OR p_day>'2200-12-31' THEN RAISE EXCEPTION 'invalid_day' USING ERRCODE='22023'; END IF;
 INSERT INTO public.class_teaching_boards(owner_id,root_id,day) VALUES(uid,p_root,p_day) ON CONFLICT(owner_id,root_id,day) DO NOTHING;
 SELECT * INTO b FROM public.class_teaching_boards WHERE owner_id=uid AND root_id=p_root AND day=p_day;
 RETURN to_jsonb(b)-'previous_manifest';
END $$;
CREATE FUNCTION public.teaching_board_commit(p_root bigint,p_day date,p_expected uuid,p_operation uuid,p_manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=auth.uid(); b public.class_teaching_boards; p jsonb; total bigint:=0; ids text[]:=ARRAY[]::text[]; count_pages integer;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.reading_materials WHERE id=p_root AND owner_id=uid AND processed_json->'metadata'->'team'->>'root'='true') THEN RAISE EXCEPTION 'teacher_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.class_teaching_boards WHERE owner_id=uid AND root_id=p_root AND day=p_day FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'board_missing' USING ERRCODE='P0002'; END IF;
 IF p_operation IS NULL THEN RAISE EXCEPTION 'operation_required' USING ERRCODE='22023'; END IF;
 IF b.revision=p_operation THEN
  IF b.manifest IS DISTINCT FROM p_manifest THEN RAISE EXCEPTION 'operation_reused' USING ERRCODE='22023'; END IF;
  RETURN to_jsonb(b)-'previous_manifest';
 END IF;
 IF b.revision IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'board_conflict' USING ERRCODE='40001'; END IF;
 IF p_manifest IS NULL OR p_manifest->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(p_manifest->'pages') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_manifest' USING ERRCODE='22023'; END IF;
 count_pages:=jsonb_array_length(p_manifest->'pages');
 IF count_pages<1 OR count_pages>20 OR octet_length(p_manifest::text)>16384 THEN RAISE EXCEPTION 'invalid_manifest' USING ERRCODE='22023'; END IF;
 FOR p IN SELECT * FROM jsonb_array_elements(p_manifest->'pages') LOOP
  IF coalesce(length(p->>'id'),0) NOT BETWEEN 1 AND 200 OR (p->>'id')=ANY(ids) OR coalesce(p->>'hash','')!~'^[a-f0-9]{64}$' OR coalesce(p->>'bytes','')!~'^[1-9][0-9]{0,6}$' THEN RAISE EXCEPTION 'invalid_page' USING ERRCODE='22023'; END IF;
  total:=total+(p->>'bytes')::bigint;ids:=array_append(ids,p->>'id');
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='teaching-board-pages' AND o.name=uid::text||'/'||b.id::text||'/'||(p->>'hash')||'.json' AND (o.metadata->>'size')::bigint=(p->>'bytes')::bigint) THEN RAISE EXCEPTION 'page_upload_missing' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF total>6291456 OR NOT coalesce((p_manifest->>'activePage')=ANY(ids),false) THEN RAISE EXCEPTION 'invalid_manifest' USING ERRCODE='22023'; END IF;
 UPDATE public.class_teaching_boards SET previous_manifest=manifest,manifest=p_manifest,revision=p_operation,updated_at=now() WHERE id=b.id RETURNING * INTO b;
 RETURN to_jsonb(b)-'previous_manifest';
END $$;
REVOKE ALL ON FUNCTION public.teaching_board_prepare(bigint,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.teaching_board_commit(bigint,date,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.teaching_board_prepare(bigint,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaching_board_commit(bigint,date,uuid,uuid,jsonb) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('teaching-board-pages','teaching-board-pages',false,6291456,ARRAY['application/json']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='teaching-board-pages' AND (public IS DISTINCT FROM false OR file_size_limit IS DISTINCT FROM 6291456 OR allowed_mime_types IS DISTINCT FROM ARRAY['application/json'])) THEN RAISE EXCEPTION 'Existing board bucket settings need review'; END IF;
END $$;
CREATE POLICY "teacher board page read" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='teaching-board-pages' AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.class_teaching_boards b WHERE b.id::text=(storage.foldername(name))[2] AND b.owner_id=(select auth.uid()))
);
CREATE POLICY "teacher board page insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='teaching-board-pages' AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND name~'^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9]{64}\.json$'
 AND EXISTS(SELECT 1 FROM public.class_teaching_boards b WHERE b.id::text=(storage.foldername(name))[2] AND b.owner_id=(select auth.uid()))
);
-- No UPDATE/DELETE policy: immutable page objects and retained recovery heads.
COMMIT;

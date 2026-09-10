-- Textbook explanations are deliberately outside dated class notes and personal vocabulary.
CREATE TABLE public.textbook_annotations (
 id uuid PRIMARY KEY, material_id bigint NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE,
 anchor jsonb NOT NULL, body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
 revision integer NOT NULL DEFAULT 1, archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX textbook_annotations_material ON public.textbook_annotations(material_id,created_at);
CREATE TABLE public.textbook_annotation_revisions (
 operation_id uuid PRIMARY KEY, annotation_id uuid NOT NULL REFERENCES public.textbook_annotations(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id), request jsonb NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.textbook_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_annotation_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.textbook_annotations,public.textbook_annotation_revisions FROM anon,authenticated;
GRANT ALL ON public.textbook_annotations,public.textbook_annotation_revisions TO service_role;
-- Reads are permission checked through the material RLS or current class capability in the API.
CREATE FUNCTION public.save_textbook_annotation(p_actor uuid,p_material bigint,p_operation uuid,p_request jsonb,p_expected_text jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE m public.reading_materials; a public.textbook_annotations; prior public.textbook_annotation_revisions; aid uuid; expected integer;
BEGIN
 SELECT * INTO m FROM public.reading_materials WHERE id=p_material AND owner_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION '교재 편집 권한이 필요해요.' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM public.textbook_annotation_revisions WHERE operation_id=p_operation;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.request<>p_request OR (prior.snapshot->>'material_id')::bigint<>p_material THEN RAISE EXCEPTION '저장 요청이 달라졌어요.' USING ERRCODE='22023'; END IF;
  RETURN prior.snapshot;
 END IF;
 IF jsonb_build_object('sequence',m.processed_json->'sequence','dictionary',m.processed_json->'dictionary') IS DISTINCT FROM p_expected_text THEN RAISE EXCEPTION '교재가 변경됐어요. 위치를 다시 확인해 주세요.' USING ERRCODE='40001'; END IF;
 IF length(btrim(p_request->>'body')) NOT BETWEEN 1 AND 2000 OR p_request->>'body' IS NULL OR jsonb_typeof(p_request->'anchor')<>'object' THEN RAISE EXCEPTION '주의점을 확인해 주세요.' USING ERRCODE='22023'; END IF;
 aid:=(p_request->>'id')::uuid; expected:=(p_request->>'revision')::integer;
 PERFORM pg_advisory_xact_lock(hashtextextended(aid::text,0));
 -- Recheck after serialization, including response-loss retries from a second tab.
 SELECT * INTO prior FROM public.textbook_annotation_revisions WHERE operation_id=p_operation;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.request<>p_request THEN RAISE EXCEPTION '저장 요청이 달라졌어요.' USING ERRCODE='22023'; END IF;
  RETURN prior.snapshot;
 END IF;
 SELECT * INTO a FROM public.textbook_annotations WHERE id=aid FOR UPDATE;
 IF FOUND THEN
  IF a.material_id<>p_material THEN RAISE EXCEPTION '교재가 달라요.' USING ERRCODE='42501'; END IF;
  IF a.revision<>expected THEN RAISE EXCEPTION '다른 창에서 수정됐어요. 최신 주의점을 확인해 주세요.' USING ERRCODE='40001'; END IF;
  UPDATE public.textbook_annotations SET body=btrim(p_request->>'body'),anchor=p_request->'anchor',revision=revision+1,archived=coalesce((p_request->>'archived')::boolean,false),updated_at=now() WHERE id=aid RETURNING * INTO a;
 ELSE
  IF expected<>0 THEN RAISE EXCEPTION '주의점이 변경됐어요.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.textbook_annotations(id,material_id,anchor,body) VALUES(aid,p_material,p_request->'anchor',btrim(p_request->>'body')) RETURNING * INTO a;
 END IF;
 INSERT INTO public.textbook_annotation_revisions(operation_id,annotation_id,actor_id,request,snapshot) VALUES(p_operation,aid,p_actor,p_request,to_jsonb(a));
 RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.save_textbook_annotation(uuid,bigint,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_textbook_annotation(uuid,bigint,uuid,jsonb,jsonb) TO service_role;

CREATE TABLE public.class_teaching_coverage (
 root_id bigint NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE, day date NOT NULL,
 material_ids jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_id,day)
);
ALTER TABLE public.class_teaching_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY coverage_owner_read ON public.class_teaching_coverage FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.reading_materials m WHERE m.id=root_id AND m.owner_id=(select auth.uid())));
REVOKE ALL ON public.class_teaching_coverage FROM anon,authenticated;
GRANT SELECT ON public.class_teaching_coverage TO authenticated;
GRANT ALL ON public.class_teaching_coverage TO service_role;
CREATE FUNCTION public.confirm_class_chapter(p_root bigint,p_day date,p_material bigint,p_include boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.reading_materials; c public.class_teaching_coverage;
BEGIN
 SELECT * INTO r FROM public.reading_materials WHERE id=p_root AND owner_id=auth.uid() AND processed_json#>>'{metadata,team,root}'='true' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '이 수업의 선생님만 확인할 수 있어요.' USING ERRCODE='42501'; END IF;
 IF p_day IS NULL OR NOT EXISTS(SELECT 1 FROM public.reading_materials WHERE id=p_material AND owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}') THEN RAISE EXCEPTION '수업 교재를 확인해 주세요.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.class_teaching_coverage(root_id,day,material_ids) VALUES(p_root,p_day,CASE WHEN p_include THEN jsonb_build_array(p_material::text) ELSE '[]'::jsonb END)
 ON CONFLICT(root_id,day) DO UPDATE SET material_ids=CASE WHEN NOT p_include THEN class_teaching_coverage.material_ids-p_material::text WHEN class_teaching_coverage.material_ids ? p_material::text THEN class_teaching_coverage.material_ids ELSE class_teaching_coverage.material_ids||jsonb_build_array(p_material::text) END,
 revision=class_teaching_coverage.revision+1,updated_at=now() RETURNING * INTO c;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.confirm_class_chapter(bigint,date,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_class_chapter(bigint,date,bigint,boolean) TO authenticated;

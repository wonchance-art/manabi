-- Owner-only chapter entry. No rewrite of existing books, editions or learning records.
BEGIN;

-- Analysis clients can submit an older processed_json snapshot. Keep only the
-- managed book identity/order and replay receipt; accept their new analysis.
CREATE FUNCTION public.library_book_preserve_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.processed_json#>>'{metadata,book,orderRevision}' IS NOT NULL
  AND coalesce(current_setting('manabi.book_reorder',true),'')<>OLD.id::text THEN
  NEW.processed_json:=jsonb_set(coalesce(NEW.processed_json,'{}'),'{metadata}',
   coalesce(NEW.processed_json->'metadata','{}')||
   jsonb_build_object('book',OLD.processed_json#>'{metadata,book}')||
   CASE WHEN OLD.processed_json#>'{metadata,bookEntry}' IS NOT NULL
    THEN jsonb_build_object('bookEntry',OLD.processed_json#>'{metadata,bookEntry}') ELSE '{}'::jsonb END);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER library_book_preserve_metadata BEFORE UPDATE OF processed_json ON public.reading_materials
 FOR EACH ROW EXECUTE FUNCTION public.library_book_preserve_metadata();
REVOKE ALL ON FUNCTION public.library_book_preserve_metadata() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.library_book_chapters(p_key text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'book_forbidden' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.library_item_state WHERE owner_id=auth.uid() AND target_kind='book' AND target_id=p_key AND state<>'active') THEN
  RAISE EXCEPTION 'book_unavailable' USING ERRCODE='42501';
 END IF;
 WITH chapters AS (
  SELECT id,title,processed_json#>'{metadata,book}' book,
   processed_json#>>'{metadata,language}' language,processed_json#>>'{metadata,level}' level,
   CASE WHEN coalesce(processed_json#>>'{metadata,book,order}','') ~ '^[0-9]+([.][0-9]+)?$' THEN (processed_json#>>'{metadata,book,order}')::numeric END ord
  FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key
 ), page AS (SELECT * FROM chapters ORDER BY ord NULLS LAST,id OFFSET greatest(0,coalesce(p_offset,0)) LIMIT least(100,greatest(1,coalesce(p_limit,20))))
 SELECT jsonb_build_object('title',(SELECT book->>'title' FROM chapters ORDER BY ord NULLS LAST,id LIMIT 1),
  'total',(SELECT count(*) FROM chapters),'nextOrder',(SELECT coalesce(floor(max(ord)),0)+1 FROM chapters),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'title',title,'order',ord,'chapterTitle',book->>'chapterTitle') ORDER BY ord NULLS LAST,id) FROM page),'[]')) INTO result;
 IF (result->>'total')::int=0 THEN RAISE EXCEPTION 'book_unavailable' USING ERRCODE='42501'; END IF;
 RETURN result;
END;
$$;

CREATE FUNCTION public.library_book_add_chapters(p_key text,p_request uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE source public.reading_materials; item jsonb; ordinal integer; label text; body text;
 fingerprint text; result jsonb; conflict_id bigint; count_old integer; record_id bigint; out_items jsonb:='[]'; pos integer:=0;
BEGIN
 IF auth.uid() IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'book_forbidden' USING ERRCODE='42501'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 OR octet_length(p_items::text)>1048576 THEN
  RAISE EXCEPTION 'book_invalid_items' USING ERRCODE='22023';
 END IF;
 -- Match library_private.lock_owner: serialize against trash/restore as well.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9127));
 PERFORM public.library_book_chapters(p_key,0,1);
 SELECT * INTO source FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key ORDER BY id LIMIT 1;
 fingerprint:=md5(p_items::text);
 -- The same operation recovers its IDs even after a lost response or later renumbering.
 SELECT jsonb_agg(jsonb_build_object('id',id::text,'order',processed_json#>'{metadata,book,order}') ORDER BY (processed_json#>>'{metadata,bookEntry,index}')::int)
 INTO result FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key AND processed_json#>>'{metadata,bookEntry,request}'=p_request::text;
 IF result IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key AND processed_json#>>'{metadata,bookEntry,request}'=p_request::text AND processed_json#>>'{metadata,bookEntry,fingerprint}' IS DISTINCT FROM fingerprint)
  THEN RAISE EXCEPTION 'book_request_changed' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('items',result);
 END IF;
 SELECT count(*) INTO count_old FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item)<>'object' OR coalesce(item->>'order','') !~ '^[1-9][0-9]{0,3}$' THEN RAISE EXCEPTION 'book_invalid_order' USING ERRCODE='22023'; END IF;
  ordinal:=(item->>'order')::int; label:=btrim(coalesce(item->>'title','')); body:=coalesce(item->>'text','');
  IF jsonb_typeof(item->'text') IS DISTINCT FROM 'string' OR (item ? 'title' AND jsonb_typeof(item->'title')<>'string') OR length(label)>200 OR length(body)>200000 OR btrim(body)='' OR (item ? 'translations' AND jsonb_typeof(item->'translations')<>'object') THEN RAISE EXCEPTION 'book_invalid_items' USING ERRCODE='22023'; END IF;
  SELECT id INTO conflict_id FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key
   AND CASE WHEN coalesce(processed_json#>>'{metadata,book,order}','') ~ '^[0-9]+([.][0-9]+)?$' THEN (processed_json#>>'{metadata,book,order}')::numeric END=ordinal LIMIT 1;
  IF conflict_id IS NOT NULL THEN RAISE EXCEPTION 'book_order_exists' USING ERRCODE='23505',DETAIL=jsonb_build_object('id',conflict_id::text,'order',ordinal)::text; END IF;
  INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
  VALUES(auth.uid(),'private',coalesce(source.processed_json#>>'{metadata,book,title}','')||' — '||ordinal||'과'||CASE WHEN label='' THEN '' ELSE ' · '||label END,body,
   jsonb_build_object('status','pending','sequence','[]'::jsonb,'dictionary','{}'::jsonb,'last_idx',-1,'metadata',
    jsonb_build_object('language',source.processed_json#>>'{metadata,language}','level',source.processed_json#>>'{metadata,level}',
     'book',jsonb_build_object('key',p_key,'title',source.processed_json#>>'{metadata,book,title}','order',ordinal,'total',count_old+jsonb_array_length(p_items),'chapterTitle',label,'orderRevision',p_request),
     'bookEntry',jsonb_build_object('request',p_request,'index',pos,'fingerprint',fingerprint),
     'translations',coalesce(item->'translations','{}'::jsonb),'updated_at',clock_timestamp()))) RETURNING id INTO record_id;
  out_items:=out_items||jsonb_build_array(jsonb_build_object('id',record_id::text,'order',ordinal));pos:=pos+1;
 END LOOP;
 RETURN jsonb_build_object('items',out_items);
END;
$$;

CREATE FUNCTION public.library_book_set_order(p_key text,p_id bigint,p_order integer,p_expected numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_row public.reading_materials; previous numeric; conflict_id bigint; label text; next_title text; prior_guard text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'book_forbidden' USING ERRCODE='42501'; END IF;
 IF p_order IS NULL OR p_order NOT BETWEEN 1 AND 9999 OR p_expected IS NULL THEN RAISE EXCEPTION 'book_invalid_order' USING ERRCODE='22023'; END IF;
 -- Match library_private.lock_owner: serialize against trash/restore as well.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9127));
 PERFORM public.library_book_chapters(p_key,0,1);
 SELECT * INTO current_row FROM public.reading_materials WHERE id=p_id AND owner_id=auth.uid() AND processed_json#>>'{metadata,book,key}'=p_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'book_forbidden' USING ERRCODE='42501'; END IF;
 previous:=(current_row.processed_json#>>'{metadata,book,order}')::numeric;
 IF previous=p_order THEN RETURN jsonb_build_object('id',p_id::text,'order',p_order); END IF;
 IF previous IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'book_order_changed' USING ERRCODE='40001'; END IF;
 SELECT id INTO conflict_id FROM public.reading_materials WHERE owner_id=auth.uid() AND id<>p_id AND processed_json#>>'{metadata,book,key}'=p_key
  AND CASE WHEN coalesce(processed_json#>>'{metadata,book,order}','') ~ '^[0-9]+([.][0-9]+)?$' THEN (processed_json#>>'{metadata,book,order}')::numeric END=p_order LIMIT 1;
 IF conflict_id IS NOT NULL THEN RAISE EXCEPTION 'book_order_exists' USING ERRCODE='23505',DETAIL=jsonb_build_object('id',conflict_id::text,'order',p_order)::text; END IF;
 next_title:=current_row.title;
 IF current_row.processed_json#>'{metadata,book}' ? 'chapterTitle' THEN
  label:=current_row.processed_json#>>'{metadata,book,chapterTitle}';
  next_title:=(current_row.processed_json#>>'{metadata,book,title}')||' — '||p_order||'과'||CASE WHEN coalesce(label,'')='' THEN '' ELSE ' · '||label END;
 ELSIF current_row.title=(current_row.processed_json#>>'{metadata,book,title}')||' — '||previous||'과' THEN
  next_title:=(current_row.processed_json#>>'{metadata,book,title}')||' — '||p_order||'과';
 END IF;
 prior_guard:=current_setting('manabi.book_reorder',true);
 PERFORM set_config('manabi.book_reorder',p_id::text,true);
 UPDATE public.reading_materials SET title=next_title,processed_json=jsonb_set(processed_json,'{metadata,book}',
  processed_json#>'{metadata,book}'||jsonb_build_object('order',p_order,'orderRevision',gen_random_uuid())) WHERE id=p_id AND owner_id=auth.uid();
 PERFORM set_config('manabi.book_reorder',coalesce(prior_guard,''),true);
 RETURN jsonb_build_object('id',p_id::text,'order',p_order);
END;
$$;
REVOKE ALL ON FUNCTION public.library_book_chapters(text,integer,integer),public.library_book_add_chapters(text,uuid,jsonb),public.library_book_set_order(text,bigint,integer,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.library_book_chapters(text,integer,integer),public.library_book_add_chapters(text,uuid,jsonb),public.library_book_set_order(text,bigint,integer,numeric) TO authenticated;
COMMIT;

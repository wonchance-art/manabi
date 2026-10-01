-- 검수용 SQL 후보. 운영 적용/마이그레이션 편입은 별도 승인 대상이다.
BEGIN;
CREATE TABLE public.vocabulary_exclusions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 language text NOT NULL CHECK(language IN ('Japanese','Chinese','English','French','Unknown')),
 word_text text NOT NULL CHECK(length(word_text) BETWEEN 1 AND 300),
 vocabulary_id uuid REFERENCES public.user_vocabulary(id) ON DELETE SET NULL,
 retired_vocabulary_ids uuid[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,vocabulary_id)
);
CREATE UNIQUE INDEX vocabulary_exclusion_unsaved_key ON public.vocabulary_exclusions(user_id,language,word_text) WHERE vocabulary_id IS NULL;
CREATE INDEX vocabulary_exclusion_word_key ON public.vocabulary_exclusions(user_id,language,word_text);
ALTER TABLE public.vocabulary_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_exclusions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vocabulary_exclusions TO authenticated;
CREATE POLICY vocabulary_exclusion_owner ON public.vocabulary_exclusions FOR ALL TO authenticated
 USING ((SELECT auth.uid())=user_id)
 WITH CHECK ((SELECT auth.uid())=user_id AND (vocabulary_id IS NULL OR EXISTS (
  SELECT 1 FROM public.user_vocabulary v WHERE v.id=vocabulary_id AND v.user_id=(SELECT auth.uid()))));

-- 기존의 전체 행은 보존. active view는 WHERE가 LIMIT 앞에서 적용되는 출제 경로다.
CREATE VIEW public.vocabulary_with_exclusions WITH (security_invoker=true) AS
 SELECT v.*, EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=v.user_id AND (
  e.vocabulary_id=v.id OR (e.language=v.language AND
   e.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)))) AS is_excluded
 FROM public.user_vocabulary v;
CREATE VIEW public.active_vocabulary WITH (security_invoker=true) AS
 SELECT * FROM public.vocabulary_with_exclusions WHERE NOT is_excluded;
REVOKE ALL ON public.vocabulary_with_exclusions,public.active_vocabulary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vocabulary_with_exclusions,public.active_vocabulary TO authenticated;

CREATE FUNCTION public.set_vocabulary_exclusion(p_language text,p_word text,p_vocabulary_id uuid,p_excluded boolean,p_exclusion_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE who uuid:=auth.uid(); v public.user_vocabulary%rowtype; e public.vocabulary_exclusions%rowtype;
 lang text:=p_language; word text:=normalize(btrim(p_word),NFC); matches integer;
BEGIN
 IF who IS NULL OR p_excluded IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 -- 같은 계정의 저장/제외는 행 잠금 전에 직렬화한다(새 단어 저장과 미저장 제외 경쟁 포함).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,731));
 IF p_exclusion_id IS NOT NULL THEN
  IF p_excluded THEN RAISE EXCEPTION 'invalid_exclusion'; END IF;
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE id=p_exclusion_id AND user_id=who;
  IF e.id IS NULL THEN RAISE EXCEPTION 'exclusion_not_available' USING ERRCODE='42501'; END IF;
  IF e.vocabulary_id IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE id=e.vocabulary_id AND user_id=who FOR UPDATE; END IF;
  DELETE FROM public.vocabulary_exclusions WHERE id=e.id AND user_id=who;
  RETURN jsonb_build_object('excluded',false,'entry',to_jsonb(e));
 END IF;
 IF p_vocabulary_id IS NOT NULL THEN
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_vocabulary_id AND user_id=who FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 ELSE
  IF lang IS NULL OR lang NOT IN ('Japanese','Chinese','English','French') OR word IS NULL OR length(word) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_word'; END IF;
  SELECT count(*) INTO matches FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word);
  IF matches>1 THEN RAISE EXCEPTION 'vocabulary_ambiguous_match'; END IF;
  IF matches=1 THEN SELECT * INTO v FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word) FOR UPDATE; END IF;
 END IF;
 IF v.id IS NOT NULL THEN
  lang:=coalesce(v.language,'Unknown'); word:=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC);
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND vocabulary_id=v.id;
  IF e.id IS NULL THEN SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 ELSE SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 IF p_excluded THEN
  IF e.id IS NULL THEN
   IF v.id IS NULL THEN
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text) VALUES(who,lang,word)
     ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL DO UPDATE SET word_text=EXCLUDED.word_text RETURNING * INTO e;
   ELSE
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id) VALUES(who,lang,word,v.id)
     ON CONFLICT(user_id,vocabulary_id) DO UPDATE SET vocabulary_id=EXCLUDED.vocabulary_id RETURNING * INTO e;
   END IF;
  ELSIF v.id IS NOT NULL AND e.vocabulary_id IS NULL THEN
   UPDATE public.vocabulary_exclusions SET vocabulary_id=v.id WHERE id=e.id RETURNING * INTO e;
  END IF;
 ELSE
  IF e.id IS NULL THEN
   SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word;
  END IF;
  IF e.id IS NOT NULL THEN DELETE FROM public.vocabulary_exclusions WHERE id=e.id AND user_id=who;
  ELSE e.id:=gen_random_uuid();e.language:=lang;e.word_text:=word;e.vocabulary_id:=v.id; END IF;
 END IF;
 RETURN jsonb_build_object('excluded',p_excluded,'entry',to_jsonb(e));
END $$;
REVOKE ALL ON FUNCTION public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid) TO authenticated;

-- 행 잠금 전에 같은 계정의 짧은 어휘 쓰기 트랜잭션을 직렬화한다.
-- 다른 계정은 각자의 키를 쓴다. 인증 없는 유지보수는 기존 권한/절차를 따른다.
CREATE FUNCTION public.lock_vocabulary_exclusion_owner() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.lock_vocabulary_exclusion_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lock_vocabulary_exclusion_owner BEFORE INSERT OR UPDATE OR DELETE ON public.user_vocabulary
 FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();
CREATE TRIGGER lock_exclusion_owner BEFORE INSERT OR UPDATE OR DELETE ON public.vocabulary_exclusions
 FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

-- 카드 삭제는 제외 해제가 아니다. 같은 키가 이미 남아 있으면 하나로 보존한다.
CREATE FUNCTION public.preserve_deleted_vocabulary_exclusion() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.vocabulary_exclusions%rowtype;
BEGIN
 SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=OLD.user_id AND (vocabulary_id=OLD.id OR (language=OLD.language AND word_text=normalize(btrim(coalesce(nullif(OLD.base_form,''),OLD.word_text)),NFC))) ORDER BY (vocabulary_id=OLD.id) DESC NULLS LAST LIMIT 1;
 IF e.id IS NOT NULL AND NOT OLD.id=ANY(e.retired_vocabulary_ids) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=array_append(retired_vocabulary_ids,OLD.id) WHERE id=e.id RETURNING * INTO e;
 END IF;
 IF e.id IS NULL OR e.vocabulary_id IS DISTINCT FROM OLD.id THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=ARRAY(SELECT DISTINCT unnest(retired_vocabulary_ids||e.retired_vocabulary_ids))
   WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL;
  DELETE FROM public.vocabulary_exclusions WHERE id=e.id;
 ELSE UPDATE public.vocabulary_exclusions SET vocabulary_id=NULL WHERE id=e.id;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.preserve_deleted_vocabulary_exclusion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_deleted_vocabulary_exclusion BEFORE DELETE ON public.user_vocabulary
 FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_vocabulary_exclusion();

-- 오래된 탭/다른 저장 경로도 제외된 단어를 채점하거나 SRS 카드로 생성하지 않는다.
CREATE FUNCTION public.guard_excluded_vocabulary() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.interval,NEW.ease_factor,NEW.repetitions,NEW.next_review_at,NEW.last_reviewed_at)
  IS NOT DISTINCT FROM ROW(OLD.interval,OLD.ease_factor,OLD.repetitions,OLD.next_review_at,OLD.last_reviewed_at) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id=NEW.id OR (e.language=NEW.language AND
   e.word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_excluded_vocabulary() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_excluded_vocabulary BEFORE INSERT OR UPDATE ON public.user_vocabulary
 FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_vocabulary();

CREATE FUNCTION public.guard_excluded_review_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.source<>'vocab' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 -- 기존 카드의 제외 조작과 평가 이벤트를 같은 행 잠금으로 직렬화한다.
 IF NEW.detail->>'word_id' IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE user_id=NEW.user_id AND id::text=NEW.detail->>'word_id' FOR UPDATE; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id::text=NEW.detail->>'word_id' OR EXISTS(SELECT 1 FROM unnest(e.retired_vocabulary_ids) retired WHERE retired::text=NEW.detail->>'word_id') OR (e.language=NEW.lang AND e.word_text=normalize(btrim(NEW.item_key),NFC)) OR
  EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.user_id=NEW.user_id AND v.id::text=NEW.detail->>'word_id' AND
   e.language=v.language AND e.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)) OR
  (NEW.detail->>'word_id' IS NULL AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id=e.vocabulary_id AND v.language=NEW.lang AND
   (normalize(btrim(v.word_text),NFC)=normalize(btrim(NEW.item_key),NFC) OR normalize(btrim(v.base_form),NFC)=normalize(btrim(NEW.item_key),NFC))))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_excluded_review_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_excluded_review_event BEFORE INSERT ON public.review_events FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_review_event();
-- 표기를 고쳐도 제외 항목의 표기/언어는 해당 카드와 함께 이동한다. FSRS는 손대지 않는다.
CREATE FUNCTION public.sync_vocabulary_exclusion_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.vocabulary_exclusions SET language=coalesce(NEW.language,'Unknown'),
  word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC) WHERE vocabulary_id=NEW.id AND user_id=NEW.user_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_vocabulary_exclusion_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_vocabulary_exclusion_identity AFTER UPDATE OF word_text,base_form,language ON public.user_vocabulary
 FOR EACH ROW EXECUTE FUNCTION public.sync_vocabulary_exclusion_identity();
COMMIT;

-- 검수 후보. 운영 적용은 별도 승인한다. user_known_words의 원래 행/시각은 보존한다.
BEGIN;
-- 기본형 연결을 보존해야 카드 삭제 뒤에도 옛 표기(books)를 해제할 수 있다.
ALTER TABLE public.vocabulary_exclusions ADD COLUMN known_word_keys text[] NOT NULL DEFAULT '{}';
CREATE TRIGGER lock_known_word_owner BEFORE INSERT OR DELETE ON public.user_known_words
 FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

CREATE FUNCTION public.sync_known_word_review_exclusion() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE who uuid; code text; original text; lang text; key text; affected text[];
BEGIN
 IF TG_OP='INSERT' THEN who:=NEW.user_id;code:=NEW.lang;original:=NEW.word_text;
 ELSE who:=OLD.user_id;code:=OLD.lang;original:=OLD.word_text; END IF;
 lang:=CASE code WHEN 'ja' THEN 'Japanese' WHEN 'zh' THEN 'Chinese' WHEN 'en' THEN 'English' WHEN 'fr' THEN 'French' END;
 IF lang IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='INSERT' THEN
  FOR key IN
   SELECT normalize(btrim(original),NFC)
   UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
    FROM public.user_vocabulary v WHERE v.user_id=who AND v.language=lang
    AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(original),NFC)
     OR normalize(btrim(v.base_form),NFC)=normalize(btrim(original),NFC))
  LOOP
   IF length(key) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_known_word'; END IF;
   INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
    VALUES(who,lang,key,ARRAY[original])
    ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL
    DO UPDATE SET known_word_keys=ARRAY(SELECT DISTINCT unnest(public.vocabulary_exclusions.known_word_keys||EXCLUDED.known_word_keys));
  END LOOP;
 ELSE
  SELECT array_agg(word_text) INTO affected FROM public.vocabulary_exclusions
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  UPDATE public.vocabulary_exclusions SET known_word_keys=array_remove(known_word_keys,original)
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  -- 해제는 새 평가가 아니다. 같은 키의 과거 '제외'도 해제하되 다른 known 표시는 보존한다.
  DELETE FROM public.vocabulary_exclusions e WHERE e.user_id=who AND e.language=lang AND e.word_text=ANY(affected)
   AND NOT EXISTS(SELECT 1 FROM public.vocabulary_exclusions other WHERE other.user_id=who AND other.language=lang
    AND other.word_text=e.word_text AND cardinality(other.known_word_keys)>0);
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sync_known_word_review_exclusion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_known_word_review_exclusion AFTER INSERT OR DELETE ON public.user_known_words
 FOR EACH ROW EXECUTE FUNCTION public.sync_known_word_review_exclusion();

-- 옛 탭의 '제외 해제'는 아는 단어 표시를 그대로 둔 채 보호 상태만 지울 수 없다.
CREATE FUNCTION public.guard_known_word_review_exclusion() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE active_keys text[];
BEGIN
 SELECT array_agg(k.word_text) INTO active_keys FROM public.user_known_words k WHERE k.user_id=OLD.user_id
  AND k.lang=CASE OLD.language WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
  AND k.word_text=ANY(OLD.known_word_keys);
 -- 신뢰된 FK cascade/known 동기화는 사용자·표시 자체를 지운다. 일반 RPC 삭제는 depth=1.
 IF TG_OP='DELETE' AND pg_catalog.pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF cardinality(active_keys)>0 AND (TG_OP='DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.language IS DISTINCT FROM OLD.language OR NEW.word_text IS DISTINCT FROM OLD.word_text
  OR NEW.vocabulary_id IS DISTINCT FROM OLD.vocabulary_id
  OR NOT active_keys <@ NEW.known_word_keys)
 THEN RAISE EXCEPTION 'known_word_active' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.guard_known_word_review_exclusion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_known_word_review_exclusion BEFORE UPDATE OR DELETE ON public.vocabulary_exclusions
 FOR EACH ROW EXECUTE FUNCTION public.guard_known_word_review_exclusion();

-- 기존 known 표시도 같은 규칙으로 복습에서 빠진다. SRS/뜻/출처/이벤트 UPDATE는 없다.
INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
 SELECT k.user_id,l.language,keys.word,array_agg(DISTINCT k.word_text)
 FROM public.user_known_words k
 JOIN (VALUES('ja','Japanese'),('zh','Chinese'),('en','English'),('fr','French')) l(code,language) ON l.code=k.lang
 CROSS JOIN LATERAL (
  SELECT normalize(btrim(k.word_text),NFC) AS word
  UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC) FROM public.user_vocabulary v
   WHERE v.user_id=k.user_id AND v.language=l.language
   AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(k.word_text),NFC)
    OR normalize(btrim(v.base_form),NFC)=normalize(btrim(k.word_text),NFC))
 ) keys
 GROUP BY k.user_id,l.language,keys.word
 ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL
 DO UPDATE SET known_word_keys=ARRAY(SELECT DISTINCT unnest(public.vocabulary_exclusions.known_word_keys||EXCLUDED.known_word_keys));
COMMIT;

-- Korean learning support v1; explicit reviewed application, not a migration.
-- No existing vocabulary/context/known/event row is updated. Existing ko known
-- markers acquire exclusion rows through the same committed synchronization rule.
-- Unknown installed function bodies, language checks, or unsafe prerequisites abort.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
-- Stabilize concurrent writes while checking and widening this bounded contract.
LOCK TABLE public.user_vocabulary,public.vocabulary_contexts,public.user_known_words,
 public.vocabulary_exclusions,public.review_events IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE r record; installed_proc pg_catalog.pg_proc%rowtype; language_check record; expr text; before_expr text; after_expr text;
owner_expr text; def text; known_check_count integer;
BEGIN
 IF EXISTS(WITH RECURSIVE roles(oid) AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon') UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN roles rr ON rr.oid=m.member)
  SELECT 1 FROM pg_catalog.pg_roles p JOIN roles rr ON p.oid=rr.oid WHERE p.rolsuper OR p.rolbypassrls)
 THEN RAISE EXCEPTION 'korean_support_unsafe_role_membership'; END IF;
 IF pg_catalog.to_regprocedure('public.guard_korean_learning_contract()') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
  AND pg_catalog.md5(prosrc)='4d76f715e7ff2f0a11bfd507cd99e0a2' AND NOT prosecdef AND proconfig=ARRAY['search_path=""']::text[])
 THEN RAISE EXCEPTION 'korean_support_unexpected_contract_guard'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::pg_catalog.regnamespace
  AND t.tgname='guard_korean_learning_contract' AND (c.relname NOT IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events')
   OR t.tgenabled<>'O' OR t.tgtype<>31 OR t.tgfoid IS DISTINCT FROM pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
   OR t.tgqual IS NOT NULL OR t.tgnargs<>0 OR t.tgattr<>''::pg_catalog.int2vector OR t.tgisinternal))
 THEN RAISE EXCEPTION 'korean_support_unexpected_contract_trigger'; END IF;
 IF pg_catalog.to_regprocedure('public.learning_language_capabilities()') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.learning_language_capabilities()')
  AND NOT prosecdef AND proconfig=ARRAY['search_path=""']::text[]
  AND (pg_catalog.md5(pg_catalog.regexp_replace(prosrc,'''[0-9a-f]{32}''','''CONTRACT_HASH''','g'))='ebeef1bf6f66890a38e8a594491619d6'
   OR pg_catalog.md5(prosrc)='da8712353cfbe1668741183d5fd8d650'))
 THEN RAISE EXCEPTION 'korean_support_unexpected_capability_rpc'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('reading_materials','id','bigint',false),
   ('reading_materials','owner_id','uuid',false),
   ('reading_materials','visibility','text',false),
   ('reading_materials','title','text',false),
   ('review_events','user_id','uuid',false),
   ('review_events','lang','text',false),
   ('review_events','source','text',false),
   ('review_events','item_key','text',false),
   ('review_events','correct','boolean',false),
   ('review_events','detail','jsonb',false),
   ('review_events','created_at','timestamp with time zone',false),
   ('uploaded_pdfs','id','uuid',false),
   ('uploaded_pdfs','owner_id','uuid',false),
   ('uploaded_pdfs','title','text',false),
   ('user_known_words','user_id','uuid',true),
   ('user_known_words','lang','text',true),
   ('user_known_words','word_text','text',true),
   ('user_known_words','marked_at','timestamp with time zone',true),
   ('user_vocabulary','id','uuid',false),
   ('user_vocabulary','user_id','uuid',false),
   ('user_vocabulary','word_text','text',false),
   ('user_vocabulary','base_form','text',false),
   ('user_vocabulary','meaning','text',false),
   ('user_vocabulary','furigana','text',false),
   ('user_vocabulary','pos','text',false),
   ('user_vocabulary','language','text',false),
   ('user_vocabulary','source_sentence','text',false),
   ('user_vocabulary','source_material_id','bigint',false),
   ('user_vocabulary','interval','real',false),
   ('user_vocabulary','ease_factor','real',false),
   ('user_vocabulary','repetitions','integer',false),
   ('user_vocabulary','next_review_at','timestamp with time zone',false),
   ('user_vocabulary','last_reviewed_at','timestamp with time zone',false),
   ('vocabulary_contexts','id','uuid',true),
   ('vocabulary_contexts','user_id','uuid',true),
   ('vocabulary_contexts','vocabulary_id','uuid',true),
   ('vocabulary_contexts','kind','text',true),
   ('vocabulary_contexts','lang','text',true),
   ('vocabulary_contexts','chapter_slug','text',false),
   ('vocabulary_contexts','material_id','bigint',false),
   ('vocabulary_contexts','pdf_id','uuid',false),
   ('vocabulary_contexts','locator','jsonb',true),
   ('vocabulary_contexts','quote','text',true),
   ('vocabulary_contexts','translation','text',true),
   ('vocabulary_contexts','source_key','text',true),
   ('vocabulary_contexts','created_at','timestamp with time zone',true),
   ('vocabulary_exclusions','id','uuid',true),
   ('vocabulary_exclusions','user_id','uuid',true),
   ('vocabulary_exclusions','language','text',true),
   ('vocabulary_exclusions','word_text','text',true),
   ('vocabulary_exclusions','vocabulary_id','uuid',false),
   ('vocabulary_exclusions','retired_vocabulary_ids','uuid[]',true),
   ('vocabulary_exclusions','created_at','timestamp with time zone',true),
   ('vocabulary_exclusions','known_word_keys','text[]',true)
 ) expected(tab,col,type,required_not_null) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.'||r.tab) AND a.attname=r.col AND NOT a.attisdropped
   AND (pg_catalog.format_type(a.atttypid,a.atttypmod)=r.type
    OR (r.tab='user_vocabulary' AND r.col IN ('interval','ease_factor') AND pg_catalog.format_type(a.atttypid,a.atttypmod) IN ('real','double precision','numeric')))
   AND (NOT r.required_not_null OR a.attnotnull))
  THEN RAISE EXCEPTION 'korean_support_unexpected_column: %.%',r.tab,r.col; END IF;
 END LOOP;
 -- The committed dependent tables have fully known constraints. Match semantic
 -- definitions rather than catalog OIDs or user-selected constraint names.
 FOR r IN SELECT * FROM (VALUES
   ('user_known_words','CHECK ((lang ~ ''^[a-z]{2}$''::text))','CHECK ((lang ~ ''^[a-z]{2}$''::text))'),
   ('user_known_words','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))'),
   ('user_known_words','PRIMARY KEY (user_id, lang, word_text)','PRIMARY KEY (user_id, lang, word_text)'),
   ('user_known_words','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))','CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))'),
   ('vocabulary_contexts','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text])))','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text])))'),
   ('vocabulary_contexts','CHECK ((jsonb_typeof(locator) = ''object''::text))','CHECK ((jsonb_typeof(locator) = ''object''::text))'),
   ('vocabulary_contexts','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))'),
   ('vocabulary_contexts','CHECK ((length(translation) <= 2000))','CHECK ((length(translation) <= 2000))'),
   ('vocabulary_contexts','CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))','CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))'),
   ('vocabulary_contexts','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_contexts','UNIQUE (user_id, vocabulary_id, source_key)','UNIQUE (user_id, vocabulary_id, source_key)'),
   ('vocabulary_contexts','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Unknown''::text])))','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text, ''Unknown''::text])))'),
   ('vocabulary_exclusions','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))'),
   ('vocabulary_exclusions','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_exclusions','UNIQUE (user_id, vocabulary_id)','UNIQUE (user_id, vocabulary_id)'),
   ('vocabulary_exclusions','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL')
 ) expected(tab,legacy_def,korean_def) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND c.convalidated
   AND pg_catalog.pg_get_constraintdef(c.oid) IN (r.legacy_def,r.korean_def))
  THEN RAISE EXCEPTION 'korean_support_missing_constraint: %: %',r.tab,r.legacy_def; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::pg_catalog.regnamespace
  AND t.relname IN ('vocabulary_contexts','user_known_words','vocabulary_exclusions') AND c.contype<>'n'
  AND NOT EXISTS(SELECT 1 FROM (VALUES ('user_known_words','CHECK ((lang ~ ''^[a-z]{2}$''::text))','CHECK ((lang ~ ''^[a-z]{2}$''::text))'),
   ('user_known_words','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))'),
   ('user_known_words','PRIMARY KEY (user_id, lang, word_text)','PRIMARY KEY (user_id, lang, word_text)'),
   ('user_known_words','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))','CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))'),
   ('vocabulary_contexts','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text])))','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text])))'),
   ('vocabulary_contexts','CHECK ((jsonb_typeof(locator) = ''object''::text))','CHECK ((jsonb_typeof(locator) = ''object''::text))'),
   ('vocabulary_contexts','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))'),
   ('vocabulary_contexts','CHECK ((length(translation) <= 2000))','CHECK ((length(translation) <= 2000))'),
   ('vocabulary_contexts','CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))','CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))'),
   ('vocabulary_contexts','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_contexts','UNIQUE (user_id, vocabulary_id, source_key)','UNIQUE (user_id, vocabulary_id, source_key)'),
   ('vocabulary_contexts','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Unknown''::text])))','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text, ''Unknown''::text])))'),
   ('vocabulary_exclusions','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))'),
   ('vocabulary_exclusions','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_exclusions','UNIQUE (user_id, vocabulary_id)','UNIQUE (user_id, vocabulary_id)'),
   ('vocabulary_exclusions','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL')) reviewed(tab,legacy_def,korean_def) WHERE reviewed.tab=t.relname AND pg_catalog.pg_get_constraintdef(c.oid) IN (reviewed.legacy_def,reviewed.korean_def)))
 THEN RAISE EXCEPTION 'korean_support_unexpected_constraint'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)','a31150064cf6db9288565e0c65844725','80acfe9427930f945f9ca0b07dbe8605','jsonb',2,ARRAY['p_word','p_source','p_confirm_id','p_confirm_meaning']::text[]),
   ('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)','ab2fbcdce90647f4b36360c004aa50e0','026a8d6e4463b0b202bf0a6acb3fa65a','jsonb',1,ARRAY['p_language','p_word','p_vocabulary_id','p_excluded','p_exclusion_id']::text[]),
   ('public.lock_vocabulary_exclusion_owner()','0d6c6b7886c4264a3eea0310d4449e41','0d6c6b7886c4264a3eea0310d4449e41','trigger',0,NULL::text[]),
   ('public.preserve_deleted_vocabulary_exclusion()','79f0ef445d24e92c15fff8f4c179a629','79f0ef445d24e92c15fff8f4c179a629','trigger',0,NULL::text[]),
   ('public.guard_excluded_vocabulary()','ace98b29ea4c10a4d8b8950deda96bd7','ace98b29ea4c10a4d8b8950deda96bd7','trigger',0,NULL::text[]),
   ('public.guard_excluded_review_event()','69b5b53f1cc47887c81e8f4b9a70c06c','69b5b53f1cc47887c81e8f4b9a70c06c','trigger',0,NULL::text[]),
   ('public.sync_vocabulary_exclusion_identity()','8f484084d6216ba1bd6c1a1b0185d447','8f484084d6216ba1bd6c1a1b0185d447','trigger',0,NULL::text[]),
   ('public.sync_known_word_review_exclusion()','ced5892a8eb03cff1645d997dfca890e','fce35cab736c4986913d0e07043d67ce','trigger',0,NULL::text[]),
   ('public.guard_known_word_review_exclusion()','71ab352aa46bf375c16b2627c7dfbf0d','70d0bab5521ce7afa3956dc12bd60f10','trigger',0,NULL::text[])
 ) expected(signature,legacy_hash,korean_hash,return_type,default_count,argnames) LOOP
  SELECT * INTO installed_proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(r.signature);
  IF installed_proc.oid IS NULL OR pg_catalog.md5(installed_proc.prosrc) NOT IN (r.legacy_hash,r.korean_hash)
   OR installed_proc.prosecdef OR installed_proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
   OR installed_proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
   OR installed_proc.prorettype<>r.return_type::pg_catalog.regtype OR installed_proc.proretset OR installed_proc.proisstrict
   OR installed_proc.prokind<>'f' OR installed_proc.provolatile<>'v' OR installed_proc.pronargdefaults<>r.default_count
   OR installed_proc.proargnames IS DISTINCT FROM r.argnames
  THEN RAISE EXCEPTION 'korean_support_unexpected_function: %',r.signature; END IF;
  IF r.return_type='trigger' AND (pg_catalog.has_function_privilege('authenticated',r.signature,'EXECUTE') OR pg_catalog.has_function_privilege('anon',r.signature,'EXECUTE'))
  THEN RAISE EXCEPTION 'korean_support_unsafe_trigger_function_privileges: %',r.signature; END IF;
 END LOOP;
 -- Known/context/exclusion policies are the committed, owner-scoped contract.
 FOR r IN SELECT * FROM (VALUES
   ('user_known_words','user_known_words_delete_own','5aa1b76c7db798b1bc076c00da396b1a'),
   ('user_known_words','user_known_words_insert_own','c6131b84cf0c36af6d1d5d57c382bc5a'),
   ('user_known_words','user_known_words_select_own','8a1b3dbbadb76db8dce6ed89b7d3c309'),
   ('vocabulary_contexts','vocabulary_contexts_delete','5e89a55d2e8264026e0036cdf41cb39a'),
   ('vocabulary_contexts','vocabulary_contexts_insert','075762a417947f450b5d0dd424bf2a50'),
   ('vocabulary_contexts','vocabulary_contexts_read','54bd0bdce05f500318e95579dde19bc2'),
   ('vocabulary_exclusions','vocabulary_exclusion_owner','8ecc1c8016ca2dc921fbb085fcfafd2a')
 ) expected(tab,name,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
   WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname=r.tab AND p.polname=r.name
   AND pg_catalog.md5(row(p.polcmd,p.polpermissive,ARRAY(SELECT rolname::text FROM pg_catalog.pg_roles WHERE oid=ANY(p.polroles) ORDER BY rolname),pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))::text)=r.hash)
  THEN RAISE EXCEPTION 'korean_support_unexpected_policy: %.%',r.tab,r.name; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('vocabulary_contexts','user_known_words','vocabulary_exclusions'))<>7
 THEN RAISE EXCEPTION 'korean_support_additional_policy'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('review_events','guard_excluded_review_event','guard_excluded_review_event',7,'1496652189ebc1244abc11d64cec7da5'),
   ('user_known_words','lock_known_word_owner','lock_vocabulary_exclusion_owner',14,'c1bf2ffe619e2a44b2020ff79458dda9'),
   ('user_known_words','sync_known_word_review_exclusion','sync_known_word_review_exclusion',13,'49169c8042b4d2cf79b8895c5aa6c9b9'),
   ('user_vocabulary','guard_excluded_vocabulary','guard_excluded_vocabulary',23,'2ce904f752143cd6f2ac8ab6fc2b2259'),
   ('user_vocabulary','lock_vocabulary_exclusion_owner','lock_vocabulary_exclusion_owner',30,'a7450562eb615509d831e1f7ce431bed'),
   ('user_vocabulary','preserve_deleted_vocabulary_exclusion','preserve_deleted_vocabulary_exclusion',11,'e69871d5647f21b6d5eb2717da254370'),
   ('user_vocabulary','sync_vocabulary_exclusion_identity','sync_vocabulary_exclusion_identity',17,'7162279ca343e26a0aaf5f6df7847b91'),
   ('vocabulary_exclusions','guard_known_word_review_exclusion','guard_known_word_review_exclusion',27,'5808df33cb4c3b478bbc031d40c6577b'),
   ('vocabulary_exclusions','lock_exclusion_owner','lock_vocabulary_exclusion_owner',30,'3c0d6d56b2ef1f6f3fdbfa0874f4f1d6')
 ) expected(tab,name,fn,type,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
   WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname=r.tab AND t.tgname=r.name
   AND p.pronamespace='public'::pg_catalog.regnamespace AND p.proname=r.fn AND t.tgtype=r.type AND t.tgenabled='O' AND t.tgqual IS NULL
   AND pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid))=r.hash)
  THEN RAISE EXCEPTION 'korean_support_missing_guard: %.%',r.tab,r.name; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events') AND NOT t.tgisinternal
  AND NOT EXISTS(SELECT 1 FROM (VALUES ('review_events','guard_excluded_review_event'),('user_known_words','lock_known_word_owner'),('user_known_words','sync_known_word_review_exclusion'),('user_vocabulary','guard_excluded_vocabulary'),('user_vocabulary','lock_vocabulary_exclusion_owner'),('user_vocabulary','preserve_deleted_vocabulary_exclusion'),('user_vocabulary','sync_vocabulary_exclusion_identity'),('vocabulary_exclusions','guard_known_word_review_exclusion'),('vocabulary_exclusions','lock_exclusion_owner')) reviewed(tab,name) WHERE reviewed.tab=c.relname AND reviewed.name=t.tgname)
  AND t.tgname<>'guard_korean_learning_contract')
 THEN RAISE EXCEPTION 'korean_support_unexpected_trigger'; END IF;
 FOR r IN SELECT * FROM (VALUES ('active_vocabulary','13c5a7ace84559e11eb69b4a34cd0c07'),('vocabulary_with_exclusions','b93ad83e32686013f426dad9e646600f')) expected(name,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
   AND c.relname=r.name AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true']
   AND pg_catalog.md5(pg_catalog.pg_get_viewdef(c.oid,true))=r.hash)
  THEN RAISE EXCEPTION 'korean_support_unexpected_view: %',r.name; END IF;
 END LOOP;
 -- Original user_vocabulary/review_events DDL is absent from the repository.
 -- Accept only a simple authenticated owner predicate (both equality orders and
 -- the committed scalar SELECT auth.uid form); reject extra permissive policies.
 FOR r IN SELECT c.relname,p.polname,p.polcmd,p.polroles,p.polpermissive,
  pg_catalog.pg_get_expr(p.polqual,p.polrelid) qual,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) chk
  FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('user_vocabulary','review_events') LOOP
  IF NOT r.polpermissive THEN RAISE EXCEPTION 'korean_support_unreviewed_restrictive_policy: %.%',r.relname,r.polname; END IF;
  IF r.polpermissive THEN
   IF r.polroles IS DISTINCT FROM ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')]::oid[]
    THEN RAISE EXCEPTION 'korean_support_unexpected_owner_roles: %.%',r.relname,r.polname; END IF;
   FOREACH owner_expr IN ARRAY ARRAY[r.qual,r.chk] LOOP
    IF owner_expr IS NOT NULL AND pg_catalog.regexp_replace(owner_expr,'[()\s]','','g') NOT IN
     ('user_id=auth.uid','auth.uid=user_id','user_id=SELECTauth.uidASuid','SELECTauth.uidASuid=user_id')
    THEN RAISE EXCEPTION 'korean_support_unexpected_owner_policy: %.%',r.relname,r.polname; END IF;
   END LOOP;
   IF (r.polcmd IN ('*','r','w','d') AND r.qual IS NULL) OR (r.polcmd='a' AND r.chk IS NULL)
   THEN RAISE EXCEPTION 'korean_support_missing_owner_predicate: %.%',r.relname,r.polname; END IF;
  END IF;
 END LOOP;
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','r'),('user_vocabulary','a'),('user_vocabulary','w'),('review_events','r'),('review_events','a')) required(tab,cmd) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass('public.'||r.tab)
   AND p.polpermissive AND p.polcmd::text IN ('*',r.cmd)
   AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')]::oid[])
  THEN RAISE EXCEPTION 'korean_support_missing_owner_policy: %.%',r.tab,r.cmd; END IF;
 END LOOP;
 FOR r IN SELECT unnest(ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events']) tab LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.'||r.tab) AND relrowsecurity AND relkind='r')
   OR NOT pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'SELECT')
   OR NOT pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'INSERT')
   OR pg_catalog.has_table_privilege('anon','public.'||r.tab,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'TRUNCATE')
  THEN RAISE EXCEPTION 'korean_support_unsafe_table_privileges_or_rls: %',r.tab; END IF;
 END LOOP;
 IF NOT pg_catalog.has_table_privilege('authenticated','public.user_vocabulary','UPDATE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.user_known_words','DELETE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.vocabulary_exclusions','UPDATE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.vocabulary_exclusions','DELETE')
 THEN RAISE EXCEPTION 'korean_support_missing_write_privileges'; END IF;
 FOR r IN SELECT unnest(ARRAY['public.save_vocabulary_context(jsonb,jsonb,uuid,text)','public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)']) signature LOOP
  IF NOT pg_catalog.has_function_privilege('authenticated',r.signature,'EXECUTE') OR pg_catalog.has_function_privilege('anon',r.signature,'EXECUTE')
  THEN RAISE EXCEPTION 'korean_support_unsafe_rpc_privileges: %',r.signature; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.user_vocabulary'::pg_catalog.regclass AND indisunique AND indisvalid AND indpred IS NULL
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','word_text'])
 THEN RAISE EXCEPTION 'korean_support_missing_vocabulary_uniqueness'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.vocabulary_contexts'::pg_catalog.regclass AND indisunique AND indisvalid AND indpred IS NULL
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','vocabulary_id','source_key'])
 THEN RAISE EXCEPTION 'korean_support_missing_context_uniqueness'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.vocabulary_exclusions'::pg_catalog.regclass AND indisunique AND indisvalid
  AND pg_catalog.pg_get_expr(indpred,indrelid)='(vocabulary_id IS NULL)'
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','language','word_text'])
 THEN RAISE EXCEPTION 'korean_support_missing_exclusion_uniqueness'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
  WHERE t.relnamespace='public'::pg_catalog.regnamespace AND t.relname IN ('user_vocabulary','review_events') AND c.contype='c'
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.conrelid AND a.attname=CASE t.relname WHEN 'user_vocabulary' THEN 'language' ELSE 'lang' END AND a.attnum=ANY(c.conkey)))
 THEN RAISE EXCEPTION 'korean_support_unreviewed_original_table_check'; END IF;
 -- Only understood text-language checks are widened. Complex/unknown checks fail.
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','language',false,false),('vocabulary_contexts','lang',true,false),('vocabulary_exclusions','language',true,true),('review_events','lang',false,false)) spec(tab,col,required,unknown_allowed) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass('public.'||r.tab) AND attname=r.col AND atttypid='text'::pg_catalog.regtype AND NOT attisdropped)
  THEN RAISE EXCEPTION 'korean_support_unexpected_language_type: %.%',r.tab,r.col; END IF;
  known_check_count:=0;
  FOR language_check IN SELECT con.*,pg_catalog.pg_get_expr(con.conbin,con.conrelid) expr FROM pg_catalog.pg_constraint con
   JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attname=r.col
   WHERE con.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND con.contype='c' AND a.attnum=ANY(con.conkey) LOOP
   expr:=language_check.expr;
   before_expr:='('||r.col||' = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text'||CASE WHEN r.unknown_allowed THEN ', ''Unknown''::text' ELSE '' END||']))';
   after_expr:=replace(before_expr,'''French''::text','''French''::text, ''Korean''::text');
   IF NOT language_check.convalidated OR expr NOT IN (before_expr,after_expr)
   THEN RAISE EXCEPTION 'korean_support_unexpected_language_check: %.%: %',r.tab,language_check.conname,expr; END IF;
   known_check_count:=known_check_count+1;
  END LOOP;
  IF r.required AND known_check_count<>1 THEN RAISE EXCEPTION 'korean_support_missing_language_check: %',r.tab; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.user_known_words'::pg_catalog.regclass AND contype='c' AND convalidated AND pg_catalog.pg_get_expr(conbin,conrelid)='(lang ~ ''^[a-z]{2}$''::text)')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname='lang' WHERE c.conrelid='public.user_known_words'::pg_catalog.regclass AND c.contype='c' AND a.attnum=ANY(c.conkey) AND pg_catalog.pg_get_expr(c.conbin,c.conrelid)<>'(lang ~ ''^[a-z]{2}$''::text)')
 THEN RAISE EXCEPTION 'korean_support_unexpected_known_language_check'; END IF;
END $preflight$;

-- Existing verified v1 contract guards would reject administrative re-enable
-- after rollback. Suspend only these guards while all affected writes are locked;
-- the transaction restores them before publishing a fresh catalog fingerprint.
DO $suspend$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract')
  THEN EXECUTE pg_catalog.format('ALTER TABLE public.%I DISABLE TRIGGER guard_korean_learning_contract',tab); END IF;
 END LOOP;
END $suspend$;

DO $extend$
DECLARE r record; definition text; before_hash text; after_hash text; body text;
BEGIN
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','language'),('vocabulary_contexts','lang'),('vocabulary_exclusions','language'),('review_events','lang')) spec(tab,col) LOOP
  FOR definition IN SELECT pg_catalog.format('ALTER TABLE public.%I DROP CONSTRAINT %I; ALTER TABLE public.%I ADD CONSTRAINT %I %s',r.tab,c.conname,r.tab,c.conname,
   replace(pg_catalog.pg_get_constraintdef(c.oid),'''French''::text','''French''::text, ''Korean''::text'))
   FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname=r.col
   WHERE c.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND c.contype='c' AND a.attnum=ANY(c.conkey)
   AND position('''Korean''' in pg_catalog.pg_get_constraintdef(c.oid))=0
  LOOP EXECUTE definition; END LOOP;
 END LOOP;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.save_vocabulary_context(jsonb,jsonb,uuid,text)')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.save_vocabulary_context(jsonb,jsonb,uuid,text)');
 IF pg_catalog.md5(body)='a31150064cf6db9288565e0c65844725' THEN
  definition:=replace(definition,body,'
declare
  v public.user_vocabulary%rowtype;
  who uuid := auth.uid();
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>''word_text'');
  meaning text := btrim(p_word->>''meaning'');
begin
  if who is null then raise exception ''login_required'' using errcode=''42501''; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>''language'' is null or p_word->>''language'' not in (''Japanese'',''Chinese'',''English'',''French'',''Korean'')
    or (p_word->>''language''=''Korean'' and p_source->>''kind''<>''reading'')
    or p_source->>''kind'' is null or p_source->>''kind'' not in (''textbook'',''reading'',''pdf'')
    then raise exception ''invalid_context'' using errcode=''22023''; end if;

  if p_word->>''language''=''Korean'' then
    if (public.learning_language_capabilities()->''languages''->''Korean''->>''save'')::boolean is distinct from true
      then raise exception ''korean_learning_not_ready'' using errcode=''55000''; end if;
    if p_word ?| array[''interval'',''ease_factor'',''repetitions'',''next_review_at''] then
      if jsonb_typeof(p_word->''interval'') is distinct from ''number''
        or jsonb_typeof(p_word->''ease_factor'') is distinct from ''number''
        or jsonb_typeof(p_word->''repetitions'') is distinct from ''number''
        or jsonb_typeof(p_word->''next_review_at'') is distinct from ''string''
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
      if (p_word->>''interval'')::numeric not between 0 and 36500
        or (p_word->>''ease_factor'')::numeric not between 1 and 10
        or (p_word->>''repetitions'')::numeric not between 0 and 100000
        or (p_word->>''repetitions'')::numeric<>trunc((p_word->>''repetitions'')::numeric)
        or not isfinite((p_word->>''next_review_at'')::timestamptz)
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
    end if;
  end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word;
    if matches > 1 then raise exception ''vocabulary_ambiguous_match''; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>''furigana'',''''),coalesce(p_word->>''pos'',''''),p_word->>''language'',p_source->>''quote'',
      case when p_source->>''kind''=''reading'' then (p_source->>''materialId'')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
    if created and p_word->>''language''=''Korean'' and p_word ? ''interval'' then
      update public.user_vocabulary set interval=(p_word->>''interval'')::real,
        ease_factor=(p_word->>''ease_factor'')::real,repetitions=(p_word->>''repetitions'')::integer,
        next_review_at=(p_word->>''next_review_at'')::timestamptz where id=v.id and user_id=who returning * into v;
    end if;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception ''word_not_available''; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>''language'' then raise exception ''vocabulary_language_conflict''; end if;
    if btrim(coalesce(v.meaning,'''')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception ''vocabulary_meaning_conflict'' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>''kind'',p_word->>''language'',p_source->>''chapterSlug'',
    (p_source->>''materialId'')::bigint,(p_source->>''pdfId'')::uuid,coalesce(p_source->''locator'',''{}''::jsonb),
    p_source->>''quote'',coalesce(p_source->>''translation'',''''),
    md5((p_source - ''translation'')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object(''vocabularyId'',v.id,''created'',created,''contextAdded'',added>0);
end ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)');
 IF pg_catalog.md5(body)='ab2fbcdce90647f4b36360c004aa50e0' THEN
  definition:=replace(definition,body,'
DECLARE who uuid:=auth.uid(); v public.user_vocabulary%rowtype; e public.vocabulary_exclusions%rowtype;
 lang text:=p_language; word text:=normalize(btrim(p_word),NFC); matches integer;
BEGIN
 IF who IS NULL OR p_excluded IS NULL THEN RAISE EXCEPTION ''login_required'' USING ERRCODE=''42501''; END IF;
 IF p_language=''Korean'' AND (public.learning_language_capabilities()->''languages''->''Korean''->>''exclude'')::boolean IS DISTINCT FROM true
  THEN RAISE EXCEPTION ''korean_learning_not_ready'' USING ERRCODE=''55000''; END IF;
 -- 같은 계정의 저장/제외는 행 잠금 전에 직렬화한다(새 단어 저장과 미저장 제외 경쟁 포함).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,731));
 IF p_exclusion_id IS NOT NULL THEN
  IF p_excluded THEN RAISE EXCEPTION ''invalid_exclusion''; END IF;
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE id=p_exclusion_id AND user_id=who;
  IF e.id IS NULL THEN RAISE EXCEPTION ''exclusion_not_available'' USING ERRCODE=''42501''; END IF;
  IF e.vocabulary_id IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE id=e.vocabulary_id AND user_id=who FOR UPDATE; END IF;
  DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') AND language=e.language AND word_text=e.word_text));
  RETURN jsonb_build_object(''excluded'',false,''entry'',to_jsonb(e));
 END IF;
 IF p_vocabulary_id IS NOT NULL THEN
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_vocabulary_id AND user_id=who FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION ''word_not_available'' USING ERRCODE=''42501''; END IF;
 ELSE
  IF lang IS NULL OR lang NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') OR word IS NULL OR length(word) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION ''invalid_word''; END IF;
  SELECT count(*) INTO matches FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word);
  IF matches>1 THEN RAISE EXCEPTION ''vocabulary_ambiguous_match''; END IF;
  IF matches=1 THEN SELECT * INTO v FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word) FOR UPDATE; END IF;
 END IF;
 IF v.id IS NOT NULL THEN
  lang:=coalesce(v.language,''Unknown''); word:=normalize(btrim(coalesce(nullif(v.base_form,''''),v.word_text)),NFC);
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
  IF e.id IS NOT NULL THEN DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') AND language=e.language AND word_text=e.word_text));
  ELSE e.id:=gen_random_uuid();e.language:=lang;e.word_text:=word;e.vocabulary_id:=v.id; END IF;
 END IF;
 RETURN jsonb_build_object(''excluded'',p_excluded,''entry'',to_jsonb(e));
END ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.sync_known_word_review_exclusion()')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.sync_known_word_review_exclusion()');
 IF pg_catalog.md5(body)='ced5892a8eb03cff1645d997dfca890e' THEN
  definition:=replace(definition,body,'
DECLARE who uuid; code text; original text; lang text; key text; affected text[];
BEGIN
 IF TG_OP=''INSERT'' THEN who:=NEW.user_id;code:=NEW.lang;original:=NEW.word_text;
 ELSE who:=OLD.user_id;code:=OLD.lang;original:=OLD.word_text; END IF;
 lang:=CASE code WHEN ''ja'' THEN ''Japanese'' WHEN ''zh'' THEN ''Chinese'' WHEN ''en'' THEN ''English'' WHEN ''fr'' THEN ''French'' WHEN ''ko'' THEN ''Korean'' END;
 IF lang IS NULL THEN RETURN NULL; END IF;
 IF TG_OP=''INSERT'' THEN
  FOR key IN
   SELECT normalize(btrim(original),NFC)
   UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''''),v.word_text)),NFC)
    FROM public.user_vocabulary v WHERE v.user_id=who AND v.language=lang
    AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(original),NFC)
     OR normalize(btrim(v.base_form),NFC)=normalize(btrim(original),NFC))
  LOOP
   IF length(key) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION ''invalid_known_word''; END IF;
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
  -- 해제는 새 평가가 아니다. 같은 키의 과거 ''제외''도 해제하되 다른 known 표시는 보존한다.
  DELETE FROM public.vocabulary_exclusions e WHERE e.user_id=who AND e.language=lang AND e.word_text=ANY(affected)
   AND NOT EXISTS(SELECT 1 FROM public.vocabulary_exclusions other WHERE other.user_id=who AND other.language=lang
    AND other.word_text=e.word_text AND cardinality(other.known_word_keys)>0);
 END IF;
 RETURN NULL;
END ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.guard_known_word_review_exclusion()')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.guard_known_word_review_exclusion()');
 IF pg_catalog.md5(body)='71ab352aa46bf375c16b2627c7dfbf0d' THEN
  definition:=replace(definition,body,'
DECLARE active_keys text[];
BEGIN
 SELECT array_agg(k.word_text) INTO active_keys FROM public.user_known_words k WHERE k.user_id=OLD.user_id
  AND k.lang=CASE OLD.language WHEN ''Japanese'' THEN ''ja'' WHEN ''Chinese'' THEN ''zh'' WHEN ''English'' THEN ''en'' WHEN ''French'' THEN ''fr'' WHEN ''Korean'' THEN ''ko'' END
  AND k.word_text=ANY(OLD.known_word_keys);
 -- 신뢰된 FK cascade/known 동기화는 사용자·표시 자체를 지운다. 일반 RPC 삭제는 depth=1.
 IF TG_OP=''DELETE'' AND pg_catalog.pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF cardinality(active_keys)>0 AND (TG_OP=''DELETE'' OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.language IS DISTINCT FROM OLD.language OR NEW.word_text IS DISTINCT FROM OLD.word_text
  OR NEW.vocabulary_id IS DISTINCT FROM OLD.vocabulary_id
  OR NOT active_keys <@ NEW.known_word_keys)
 THEN RAISE EXCEPTION ''known_word_active'' USING ERRCODE=''55000''; END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END ');
  EXECUTE definition;
 END IF;
END $extend$;

INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
 SELECT k.user_id,l.language,keys.word,array_agg(DISTINCT k.word_text)
 FROM public.user_known_words k
 JOIN (VALUES('ko','Korean')) l(code,language) ON l.code=k.lang
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


CREATE OR REPLACE FUNCTION public.guard_korean_learning_contract() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE old_korean boolean:=false; new_korean boolean:=false; ready boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN old_korean:=coalesce(to_jsonb(OLD)->>'language',to_jsonb(OLD)->>'lang') IN ('Korean','ko'); END IF;
 IF TG_OP<>'DELETE' THEN new_korean:=coalesce(to_jsonb(NEW)->>'language',to_jsonb(NEW)->>'lang') IN ('Korean','ko'); END IF;
 IF TG_TABLE_NAME='review_events' AND TG_OP<>'DELETE' AND EXISTS(
  SELECT 1 FROM public.user_vocabulary v WHERE v.user_id=NEW.user_id AND v.language='Korean' AND v.id::text=to_jsonb(NEW)->'detail'->>'word_id') THEN new_korean:=true; END IF;
 IF TG_TABLE_NAME IN ('vocabulary_exclusions','vocabulary_contexts') THEN
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id::text=to_jsonb(OLD)->>'vocabulary_id' AND v.user_id=OLD.user_id AND v.language='Korean') THEN old_korean:=true; END IF;
  IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id::text=to_jsonb(NEW)->>'vocabulary_id' AND v.user_id=NEW.user_id AND v.language='Korean') THEN new_korean:=true; END IF;
 END IF;
 IF old_korean OR new_korean THEN
  ready:=(public.learning_language_capabilities()->'languages'->'Korean'->>'save')::boolean;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'korean_learning_not_ready' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $guard$;
REVOKE ALL ON FUNCTION public.guard_korean_learning_contract() FROM PUBLIC,anon,authenticated;
DO $guards$
DECLARE tab text; trigger_def text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events'] LOOP
  trigger_def:=pg_catalog.format('CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract()',tab);
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract') THEN
   EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE TRIGGER guard_korean_learning_contract',tab);
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract'
    AND tgenabled='O' AND tgtype=31 AND tgfoid=pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
    AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::pg_catalog.int2vector AND NOT tgisinternal)
   THEN RAISE EXCEPTION 'korean_support_unexpected_contract_trigger: %',tab; END IF;
  ELSE EXECUTE trigger_def; END IF;
 END LOOP;
END $guards$;

-- The expected installed catalog fingerprint is private implementation data.
-- No table or readiness flag can be used to claim support after a regression.
DO $capability$
DECLARE contract_hash text;
BEGIN
 WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects INTO contract_hash;
 EXECUTE pg_catalog.format($definition$
 CREATE OR REPLACE FUNCTION public.learning_language_capabilities()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $body$
 DECLARE live_hash text; ready boolean:=false;
 BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
  WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects INTO live_hash;
  ready:=live_hash= %L;
  RETURN pg_catalog.jsonb_build_object('version',1,'languages',pg_catalog.jsonb_build_object('Korean',
   pg_catalog.jsonb_build_object('save',ready,'review',ready,'known',ready,'exclude',ready)));
 END $body$;
 $definition$,contract_hash);
END $capability$;
REVOKE ALL ON FUNCTION public.learning_language_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.learning_language_capabilities() TO authenticated;
COMMIT;

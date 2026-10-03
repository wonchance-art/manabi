-- Safe capability rollback; retain widened CHECKs, rows, functions, and protection.
-- Restoring four-language CHECKs would reject new Korean data and is forbidden.
-- Korean writes freeze; legacy-language writes retain the installed behavior.
-- Retain the reviewed anonymous/TRUNCATE privilege reductions; never regrant.
-- Re-enable only with the reviewed support SQL and verification matrix.
BEGIN;
CREATE OR REPLACE FUNCTION public.learning_language_capabilities()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $rollback$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 RETURN pg_catalog.jsonb_build_object('version',1,'languages',pg_catalog.jsonb_build_object('Korean',
  pg_catalog.jsonb_build_object('save',false,'review',false,'known',false,'exclude',false)));
END $rollback$;
REVOKE ALL ON FUNCTION public.learning_language_capabilities() FROM PUBLIC,anon,authenticated;
DO $rollback_acl$
DECLARE grantee_name text;
BEGIN
 FOR grantee_name IN SELECT DISTINCT pg_catalog.pg_get_userbyid(acl.grantee) FROM pg_catalog.pg_proc p
  CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) acl WHERE p.oid=pg_catalog.to_regprocedure('public.learning_language_capabilities()') AND acl.grantee<>0 AND acl.grantee<>p.proowner
 LOOP EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.learning_language_capabilities() FROM %I',grantee_name); END LOOP;
END $rollback_acl$;
GRANT EXECUTE ON FUNCTION public.learning_language_capabilities() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

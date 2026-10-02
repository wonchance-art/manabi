-- Safe capability rollback; retain widened CHECKs, rows, functions, and protection.
-- Restoring four-language CHECKs would reject new Korean data and is forbidden.
-- Korean writes freeze; legacy-language writes retain the installed behavior.
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
GRANT EXECUTE ON FUNCTION public.learning_language_capabilities() TO authenticated;
COMMIT;

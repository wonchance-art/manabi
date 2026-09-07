ALTER TABLE public.reading_materials ADD COLUMN IF NOT EXISTS document_json jsonb;
ALTER TABLE public.reading_materials ADD CONSTRAINT reading_materials_document_private_v1 CHECK (
  document_json IS NULL OR (
    COALESCE(visibility = 'private', false) AND owner_id IS NOT NULL
    AND COALESCE(processed_json->'metadata'->'composer'->>'version' = '1', false)
    AND COALESCE(document_json->>'version' = '1', false)
    AND COALESCE(jsonb_typeof(document_json->'body') = 'string', false)
    AND COALESCE(document_json->>'revision' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$', false)
  )
);

-- Older open viewers also share this database. Enforce source identity there,
-- while allowing analysis dictionaries/status and the new document to change.
CREATE OR REPLACE FUNCTION public.protect_composer_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->>'version' = '1' AND (
    NEW.raw_text IS DISTINCT FROM OLD.raw_text
    OR NEW.processed_json->'metadata'->'composer' IS DISTINCT FROM OLD.processed_json->'metadata'->'composer'
    OR NEW.processed_json->'metadata'->'importAttempt' IS DISTINCT FROM OLD.processed_json->'metadata'->'importAttempt'
  ) THEN
    RAISE EXCEPTION 'composer_source_is_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_composer_source
BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials
FOR EACH ROW EXECUTE FUNCTION public.protect_composer_source();

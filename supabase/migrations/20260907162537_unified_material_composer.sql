-- Unified private materials. Existing PDF storage, materials and learning records
-- are not migrated or rewritten. Apply before enabling the new attachment flow.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('material-originals', 'material-originals', false, 52428800,
  ARRAY['application/pdf', 'application/epub+zip'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "material originals owner read" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'material-originals' AND (storage.foldername(name))[1] = (select auth.uid())::text
);
CREATE POLICY "material originals owner insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'material-originals' AND (storage.foldername(name))[1] = (select auth.uid())::text
);
CREATE POLICY "material originals owner delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'material-originals' AND (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Immutable originals: deliberately no UPDATE policy / no client upsert.

-- A retry/refresh/two tabs can resolve only one material for one account+attempt.
-- Limit the index to this new version, so historical imports need no cleanup.
CREATE UNIQUE INDEX reading_materials_composer_attempt_unique
ON public.reading_materials (owner_id, ((processed_json->'metadata'->>'importAttempt')))
WHERE processed_json->'metadata'->'composer'->>'version' = '1';

ALTER TABLE public.reading_materials ADD CONSTRAINT composer_material_is_private
CHECK (processed_json->'metadata'->'composer'->>'version' IS DISTINCT FROM '1'
  OR (visibility IS NOT DISTINCT FROM 'private' AND owner_id IS NOT NULL
    AND coalesce(processed_json->'metadata'->>'importAttempt', '') <> ''));

COMMIT;

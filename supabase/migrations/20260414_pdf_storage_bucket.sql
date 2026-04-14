-- user-pdfs 프라이빗 버킷 생성 + RLS
-- 경로 구조: {user_id}/{pdf_id}.pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-pdfs',
  'user-pdfs',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 정책: 본인 폴더에만 업로드/조회/삭제
DROP POLICY IF EXISTS "user-pdfs select own" ON storage.objects;
CREATE POLICY "user-pdfs select own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "user-pdfs insert own" ON storage.objects;
CREATE POLICY "user-pdfs insert own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "user-pdfs delete own" ON storage.objects;
CREATE POLICY "user-pdfs delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

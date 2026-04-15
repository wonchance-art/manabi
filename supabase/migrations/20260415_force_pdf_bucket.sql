-- user-pdfs 버킷 강제 생성 (이전 마이그레이션이 버킷 생성에 실패한 경우 대비)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('user-pdfs', 'user-pdfs', false, 52428800, ARRAY['application/pdf'])
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf'];
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'storage.buckets INSERT 권한 부족 — Dashboard에서 수동 생성 필요';
END $$;

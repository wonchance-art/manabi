-- 사용자가 업로드한 PDF 원본 + 분석 범위(reading_materials) 연결
-- 저작권 자료 보호를 위해 PDF 원본은 private bucket, reading_materials는 source_pdf_id 있으면 강제 private

CREATE TABLE IF NOT EXISTS uploaded_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  page_count int,
  language text,
  level text,
  last_page_read int DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uploaded_pdfs_owner_idx
  ON uploaded_pdfs (owner_id, created_at DESC);

ALTER TABLE uploaded_pdfs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access" ON uploaded_pdfs;
CREATE POLICY "Owner full access"
  ON uploaded_pdfs FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- reading_materials에 PDF 출처 연결 컬럼
ALTER TABLE reading_materials
  ADD COLUMN IF NOT EXISTS source_pdf_id uuid REFERENCES uploaded_pdfs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_start int,
  ADD COLUMN IF NOT EXISTS page_end int;

CREATE INDEX IF NOT EXISTS materials_source_pdf_idx
  ON reading_materials (source_pdf_id, page_start)
  WHERE source_pdf_id IS NOT NULL;

-- PDF 출처 자료는 비공개 강제 (저작권 보호)
-- 앱 레벨에서도 체크하지만 DB 제약으로 2중 방어
ALTER TABLE reading_materials
  DROP CONSTRAINT IF EXISTS reading_materials_pdf_source_private;
ALTER TABLE reading_materials
  ADD CONSTRAINT reading_materials_pdf_source_private
  CHECK (source_pdf_id IS NULL OR visibility = 'private');

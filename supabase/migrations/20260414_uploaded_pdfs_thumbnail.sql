-- PDF 썸네일 저장 경로
ALTER TABLE uploaded_pdfs
  ADD COLUMN IF NOT EXISTS thumbnail_path text;

-- 중국어 공개 시드 366의 시리즈 번호를 레벨 안 번호로 바로잡는다(ZH-SEED-TITLE-001 — 2026-11-08 KST, 디자인 세션 발견 · 오케스트레이터 06:15).
-- 「[H3 여행 #2] 问路 (길 묻기)」 → 「[H3 여행 #1] 问路 (길 묻기)」. 번호를 레벨 안이 아니라 주제 전체로 매겨(H2 여행 #1 去上海旅游 → H3 여행 #2)
-- 레벨별 시리즈 표지(n/총)와 어긋났다. 운영 SQL 전수 점검(06:20 KST): 번호 빠짐은 이 하나뿐이다. 비공개 「N5 문법」 10편은 주인 없는 정리 대상이라 제외.
-- 바꾸는 칸: 366의 title 하나. 원문 · 분석 · 공개 범위 · 소유권 · 다른 자료 그대로. 고치기 전 제목은 backup_private.seed_titles_20261108에.
-- 사전 검사: 366 제목이 고치기 전 값 그대로 · 「[H3 여행 #1]」 제목 0편. 이미 적용(새 제목 · 백업 1) 또는 자료 없음(fixture)이면 무변경. 그 밖은 RAISE.
-- 복원: docs/sql/zh-seed-title-fix-20261108-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.seed_titles_20261108 (
  material_id bigint PRIMARY KEY,
  title text NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.seed_titles_20261108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.seed_titles_20261108 FROM PUBLIC, anon, authenticated;

DO $fix$
DECLARE cur text; n_backup int; n_one int;
BEGIN
  SELECT title INTO cur FROM public.reading_materials WHERE id = 366;
  SELECT count(*) INTO n_backup FROM backup_private.seed_titles_20261108;
  SELECT count(*) INTO n_one FROM public.reading_materials WHERE title LIKE '[H3 여행 #1]%';
  IF cur IS NULL AND n_backup = 0 THEN
    RAISE NOTICE 'zh seed title: material 366 absent — nothing to change';
    RETURN;
  END IF;
  IF cur = '[H3 여행 #1] 问路 (길 묻기)' AND n_backup = 1 THEN
    RAISE NOTICE 'zh seed title: already applied — no change';
    RETURN;
  END IF;
  IF cur IS DISTINCT FROM '[H3 여행 #2] 问路 (길 묻기)' OR n_backup <> 0 OR n_one <> 0 THEN
    RAISE EXCEPTION 'zh seed title: unexpected state (title %, backup %, existing #1 %) — stop', cur, n_backup, n_one;
  END IF;
  INSERT INTO backup_private.seed_titles_20261108 (material_id, title) VALUES (366, cur);
  UPDATE public.reading_materials SET title = '[H3 여행 #1] 问路 (길 묻기)' WHERE id = 366;
  IF (SELECT title FROM public.reading_materials WHERE id = 366) IS DISTINCT FROM '[H3 여행 #1] 问路 (길 묻기)' THEN
    RAISE EXCEPTION 'zh seed title: post-check failed';
  END IF;
END $fix$;

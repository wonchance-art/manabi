-- 학습 그룹 R2 — 같이 읽기 + 진도 게이트 토론 (rfc-study-groups §4.3, §9-1 승인 방향의 2단계).
--
-- 배경: 그룹이 이번 주 자료 1개를 지정해 나란히 읽고(진도 바 — 스냅샷 material_pct 재사용),
--   토론은 각자 읽은 데까지만 열린다(진도 게이트 — 코멘트에 작성 시점 진도 기록, 표시는
--   클라이언트 UX 게이트: 자료 원문은 어차피 공개 자료라 보안 게이트가 아니다).
--   같이 읽기 자료는 **공개(visibility='public') 자료만** — 비공개 자료는 그룹원이 읽을 수
--   없으므로 서버 계약(WITH CHECK)으로 차단한다. 자료·원장 테이블의 RLS는 무변경.
--
-- 이 파일이 더하는 것:
--   · study_group_reads — 주당 1자료 지정(PK group_id, week_start). 멤버 누구나 지정·재지정
--     (소그룹 신뢰 모델 — 마지막 지정이 이긴다, set_by 기록).
--   · study_group_comments — 그룹 토론(≤500자, progress_pct = 작성 시점 진도). user_id는
--     material_comments 관례대로 profiles 참조(작성자 이름 중첩 조인).
--   · study_group_members.user_id → profiles FK 추가(멤버 이름 표시용 — auth.users FK와 병존).
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(전면 멱등).
--   · 롤백: DROP TABLE study_group_comments/study_group_reads + members의 profiles FK DROP.
--   · 무해성: 미적용이어도 클라이언트가 조회 실패를 조용히 삼켜 같이 읽기 블록만 비활성.
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.study_group_reads'), to_regclass('public.study_group_comments');
--   2) 비공개 자료 지정 시도 → new row violates row-level security (WITH CHECK 차단).
--   3) 비멤버 계정 토론 select → 0행.

-- ── 1. 이번 주 같이 읽기 지정 ──
CREATE TABLE IF NOT EXISTS public.study_group_reads (
  group_id    uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  material_id bigint NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE,
  set_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, week_start)
);

-- ── 2. 그룹 토론 — 진도 게이트용 작성 시점 진도 동봉 ──
CREATE TABLE IF NOT EXISTS public.study_group_comments (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id     uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  material_id  bigint NOT NULL REFERENCES public.reading_materials(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content      text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_group_comments_group_idx
  ON public.study_group_comments (group_id, material_id, created_at);

-- ── 3. 멤버 이름 표시용 profiles FK(중첩 조인 경로 — material_comments 관례) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_group_members_user_profile_fk'
  ) THEN
    ALTER TABLE public.study_group_members
      ADD CONSTRAINT study_group_members_user_profile_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 4. RLS — 조회는 멤버만, 지정은 멤버(공개 자료만), 토론 쓰기는 본인·삭제는 본인 ──
ALTER TABLE public.study_group_reads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_group_reads_select_member" ON public.study_group_reads;
CREATE POLICY "study_group_reads_select_member" ON public.study_group_reads
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_reads_insert_member" ON public.study_group_reads;
CREATE POLICY "study_group_reads_insert_member" ON public.study_group_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(group_id)
    AND EXISTS (
      SELECT 1 FROM public.reading_materials m
      WHERE m.id = material_id AND m.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "study_group_reads_update_member" ON public.study_group_reads;
CREATE POLICY "study_group_reads_update_member" ON public.study_group_reads
  FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (
    public.is_group_member(group_id)
    AND EXISTS (
      SELECT 1 FROM public.reading_materials m
      WHERE m.id = material_id AND m.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "study_group_comments_select_member" ON public.study_group_comments;
CREATE POLICY "study_group_comments_select_member" ON public.study_group_comments
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_comments_insert_self" ON public.study_group_comments;
CREATE POLICY "study_group_comments_insert_self" ON public.study_group_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_comments_delete_self" ON public.study_group_comments;
CREATE POLICY "study_group_comments_delete_self" ON public.study_group_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 5. 권한 — anon 전면 차단 ──
REVOKE ALL ON public.study_group_reads    FROM anon;
REVOKE ALL ON public.study_group_comments FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.study_group_reads    TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.study_group_comments TO authenticated;

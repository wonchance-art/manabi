-- 학습 그룹 R1 — 함께 읽는 소그룹 (rfc-study-groups §4.2·§6, 오너 §9 전 항목 권고안 승인 2026-08-23).
--
-- 배경: 초대 코드 전용 소그룹(정원 기본 8·상한 15, 1인 3그룹 상한)이 주간 거울을 합계로
--   나란히 본다(등수 없음). 개인 학습 원장(review_events 등)의 RLS는 일절 건드리지 않고,
--   공유되는 것은 각자 스스로 밀어 넣는 주간 스냅샷 숫자뿐이다(§3-3 원장 비공개 원칙).
--   cohorts(기수제)는 존치(§9-4) — 이 파일은 그 테이블을 건드리지 않고 패턴 3종(join_code·
--   참가 RPC·SECURITY DEFINER 멤버십 헬퍼)만 차용한다.
--
-- 이 파일이 더하는 것:
--   · study_groups — 그룹(이름 ≤40·언어·초대 코드·정원). 쓰기는 RPC 전용.
--   · study_group_members — 멤버십. 참가는 RPC 전용, 나가기는 본인 행 delete.
--   · study_group_snapshots — 주간 스냅샷(복습·정답·담은 말·만난 말·완독 + R2 예비
--     material_pct). PK(group_id, user_id, week_start)로 주당 1행, 본인 행만 upsert.
--   · is_group_member 헬퍼 + create_group / join_group RPC(코드 생성·정원·3그룹 상한 검사).
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 .github/workflows/supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS 뒤 CREATE ·
--     CREATE OR REPLACE FUNCTION · REVOKE/GRANT).
--   · 롤백: 역방향 파일로 DROP FUNCTION create_group/join_group/is_group_member,
--     DROP TABLE study_group_snapshots/study_group_members/study_groups (스냅샷은 주간 재계산
--     가능한 파생 숫자라 유실 없음 — 그룹·멤버십만 사라진다).
--   · 무해성: 미적용이어도 클라이언트(studyGroups.js)가 조회·RPC 실패를 조용히 삼켜
--     그룹 표면만 비활성으로 남는다(개인 학습 무영향).
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.study_groups');  → 'public.study_groups' (members·snapshots 동일)
--   2) RLS: select count(*) from pg_policies where tablename in
--        ('study_groups','study_group_members','study_group_snapshots');  → 6
--   3) 왕복(로그인 세션): select create_group('테스트','Japanese') → (id, 6자 코드);
--      다른 계정에서 join_group(코드) → 같은 id; 스냅샷 upsert 후 두 계정 모두 select 가능,
--      비멤버 계정은 0행.

-- ── 1. 그룹 ──
CREATE TABLE IF NOT EXISTS public.study_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  lang       text NOT NULL CHECK (lang IN ('Japanese', 'English', 'French', 'Chinese')),
  join_code  text NOT NULL UNIQUE,
  capacity   int  NOT NULL DEFAULT 8 CHECK (capacity BETWEEN 2 AND 15),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. 멤버십 ──
CREATE TABLE IF NOT EXISTS public.study_group_members (
  group_id  uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS study_group_members_user_idx ON public.study_group_members (user_id);

-- ── 3. 주간 스냅샷 — 본인이 계산해 밀어 넣는 합계 숫자(원장 비공개, §3-3) ──
CREATE TABLE IF NOT EXISTS public.study_group_snapshots (
  group_id     uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   date NOT NULL,
  reviews      int  NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  correct      int  NOT NULL DEFAULT 0 CHECK (correct >= 0),
  added        int  NOT NULL DEFAULT 0 CHECK (added >= 0),
  met          int  NOT NULL DEFAULT 0 CHECK (met >= 0),
  reads        int  NOT NULL DEFAULT 0 CHECK (reads >= 0),
  -- R2(같이 읽기) 예비 — 이번 주 지정 자료에 대한 내 진도(%). R1은 쓰지 않는다.
  material_pct int CHECK (material_pct BETWEEN 0 AND 100),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id, week_start)
);

-- ── 4. 멤버십 헬퍼 (SECURITY DEFINER — RLS 정책 간 재귀 참조 방지, cohorts 관례) ──
CREATE OR REPLACE FUNCTION public.is_group_member(g uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM study_group_members WHERE group_id = g AND user_id = auth.uid());
$$;

-- ── 5. RLS — 조회는 멤버만, 쓰기는 본인 행(스냅샷)·본인 탈퇴(멤버십)·RPC(그 외) ──
ALTER TABLE public.study_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_groups_select_member" ON public.study_groups;
CREATE POLICY "study_groups_select_member" ON public.study_groups
  FOR SELECT TO authenticated USING (public.is_group_member(id));

DROP POLICY IF EXISTS "study_group_members_select_member" ON public.study_group_members;
CREATE POLICY "study_group_members_select_member" ON public.study_group_members
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_members_delete_self" ON public.study_group_members;
CREATE POLICY "study_group_members_delete_self" ON public.study_group_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "study_group_snapshots_select_member" ON public.study_group_snapshots;
CREATE POLICY "study_group_snapshots_select_member" ON public.study_group_snapshots
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_snapshots_insert_self" ON public.study_group_snapshots;
CREATE POLICY "study_group_snapshots_insert_self" ON public.study_group_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_snapshots_update_self" ON public.study_group_snapshots;
CREATE POLICY "study_group_snapshots_update_self" ON public.study_group_snapshots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));

-- ── 6. 권한 — anon 전면 차단, authenticated는 RLS 안에서만 ──
REVOKE ALL ON public.study_groups          FROM anon;
REVOKE ALL ON public.study_group_members   FROM anon;
REVOKE ALL ON public.study_group_snapshots FROM anon;
GRANT SELECT                         ON public.study_groups          TO authenticated;
GRANT SELECT, DELETE                 ON public.study_group_members   TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.study_group_snapshots TO authenticated;

-- ── 7. 그룹 만들기 RPC — 코드 서버 생성(혼동 글자 제외 6자)·3그룹 상한·개설자 자동 가입 ──
CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_lang text)
RETURNS TABLE (group_id uuid, join_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_id uuid;
  i int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'login required';
  END IF;
  -- 1인 3그룹 상한(§9-2 오너 확정)
  IF (SELECT count(*) FROM study_group_members WHERE user_id = auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'group limit';
  END IF;
  -- 초대 코드: I·L·O·0·1 제외 31자 알파벳으로 6자 — 충돌 시 재시도
  FOR i IN 1..20 LOOP
    SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      INTO v_code FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM study_groups WHERE study_groups.join_code = v_code);
  END LOOP;
  INSERT INTO study_groups (name, lang, join_code, created_by)
  VALUES (trim(p_name), p_lang, v_code, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO study_group_members (group_id, user_id) VALUES (v_id, auth.uid());
  RETURN QUERY SELECT v_id, v_code;
END;
$$;

-- ── 8. 참가 RPC — 코드 검증·정원·3그룹 상한(그룹 행 잠금으로 정원 경쟁 직렬화) ──
CREATE OR REPLACE FUNCTION public.join_group(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g study_groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'login required';
  END IF;
  SELECT * INTO g FROM study_groups
   WHERE study_groups.join_code = upper(trim(p_code))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid code';
  END IF;
  IF EXISTS (SELECT 1 FROM study_group_members WHERE group_id = g.id AND user_id = auth.uid()) THEN
    RETURN g.id; -- 이미 멤버 — 멱등
  END IF;
  IF (SELECT count(*) FROM study_group_members WHERE user_id = auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'group limit';
  END IF;
  IF (SELECT count(*) FROM study_group_members WHERE group_id = g.id) >= g.capacity THEN
    RAISE EXCEPTION 'group full';
  END IF;
  INSERT INTO study_group_members (group_id, user_id) VALUES (g.id, auth.uid());
  RETURN g.id;
END;
$$;

REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_group(text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.join_group(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;

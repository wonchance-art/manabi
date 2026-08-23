-- 학습 그룹 R3 — 주간 공동 목표 (rfc-study-groups §4.4, §9-1 승인 방향의 마지막 단계).
--
-- 배경: Duolingo Friends Quest 구조의 협동판 — 주간 그룹 목표 1개(축은 주간 거울의
--   4축: 복습·담은 말·만난 말·완독), 기여 비율 자유. **보상·페널티 없음**(§9-6 오너
--   확정) — 달성은 카드의 조용한 체크뿐. 진행도는 이미 있는 스냅샷 합계에서 계산하므로
--   이 파일은 목표 지정 1테이블만 더한다(새 기록 이벤트·원장 접촉 0).
--
-- 이 파일이 더하는 것:
--   · study_group_goals — 주당 1목표(PK group_id, week_start). 지정·재지정은 멤버
--     누구나(같이 읽기 지정과 같은 신뢰 모델 — 마지막 지정이 이긴다, set_by 기록).
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(전면 멱등).
--   · 롤백: DROP TABLE IF EXISTS public.study_group_goals; (목표는 파생 없는 지정값 —
--     유실은 그 주 목표 설정뿐).
--   · 무해성: 미적용이어도 클라이언트가 조회 실패를 조용히 삼켜 목표 줄만 비활성.
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.study_group_goals');
--   2) 비멤버 계정 select → 0행, insert → RLS 거부.

CREATE TABLE IF NOT EXISTS public.study_group_goals (
  group_id   uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  axis       text NOT NULL CHECK (axis IN ('reviews', 'added', 'met', 'reads')),
  target     int  NOT NULL CHECK (target BETWEEN 1 AND 100000),
  set_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, week_start)
);

ALTER TABLE public.study_group_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_group_goals_select_member" ON public.study_group_goals;
CREATE POLICY "study_group_goals_select_member" ON public.study_group_goals
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_goals_insert_member" ON public.study_group_goals;
CREATE POLICY "study_group_goals_insert_member" ON public.study_group_goals
  FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS "study_group_goals_update_member" ON public.study_group_goals;
CREATE POLICY "study_group_goals_update_member" ON public.study_group_goals
  FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

REVOKE ALL ON public.study_group_goals FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.study_group_goals TO authenticated;

-- 학습 월드 여행 스탬프(world_stamps) — 노드(도시·명산·항구 등) 첫 방문 수집 기록.
--
-- 배경: "함께 여행" 월드에 방문 스탬프를 붙인다. 플레이어가 노드에 A(말 걸기)로 상호작용하면
--   첫 방문 시 그 노드의 스탬프를 수집한다(중복 없음). 본인만 읽고 쓰며(RLS own-only), 스탬프는
--   불변이라 update/delete 정책은 두지 않는다(계정 삭제는 FK CASCADE 로 정리). 좌표 영속화
--   테이블(20260712c world_positions)의 own-only 관례를 그대로 따른다.
--
-- 이 파일이 더하는 것:
--   · world_stamps 신규 테이블 — PK(user_id, node_id) 로 노드당 1행(첫 방문 시각 at 보존).
--   · own-only RLS 2종(select/insert) + REVOKE anon / GRANT authenticated.
--   node_id 는 WORLD_NODES 의 id(text) — 서버 라우트(/api/world/stamps)가 실존 노드만 upsert 한다.
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 .github/workflows/supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS 뒤 CREATE · REVOKE/GRANT).
--   · 롤백: 역방향 마이그레이션 파일로 `DROP TABLE IF EXISTS public.world_stamps;`.
--   · 무해성: 미적용이어도 라우트 GET/POST 가 실패(관계 없음)하면 stamps.js 가 조용히 삼켜 빈 목록으로
--            동작한다(스탬프만 비활성 — 월드 자체는 정상).
--
-- ── 검증(적용 후) ──
--   1) 테이블: select to_regclass('public.world_stamps');  → 'public.world_stamps'.
--   2) RLS 활성 + own 정책 2종:
--        select relrowsecurity from pg_class where oid='public.world_stamps'::regclass;  → t
--        select count(*) from pg_policies where tablename='world_stamps';                → 2
--   3) 왕복(로그인 세션): insert 후 select 로 본인 행만 보인다(타 계정 행 비노출).

-- ── 1. 테이블 — PK(user_id, node_id) 로 노드당 1행(첫 방문 at 보존) ──
CREATE TABLE IF NOT EXISTS public.world_stamps (
  user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id text        NOT NULL,               -- WORLD_NODES.id (서버 검증)
  at      timestamptz NOT NULL DEFAULT now(), -- 첫 방문 시각(중복 upsert 시 유지)
  PRIMARY KEY (user_id, node_id)
);

ALTER TABLE public.world_stamps ENABLE ROW LEVEL SECURITY;

-- own-only 정책 2종: 본인 행만 select/insert. update/delete 는 필요 없음(스탬프 불변 · 계정 삭제는 FK CASCADE).
DROP POLICY IF EXISTS "world_stamps_select_own" ON public.world_stamps;
CREATE POLICY "world_stamps_select_own"
ON public.world_stamps FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "world_stamps_insert_own" ON public.world_stamps;
CREATE POLICY "world_stamps_insert_own"
ON public.world_stamps FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- 명시 GRANT — authenticated 만(anon 불필요).
REVOKE ALL ON TABLE public.world_stamps FROM anon;
GRANT SELECT, INSERT ON TABLE public.world_stamps TO authenticated;

-- 롤백(역방향 마이그레이션 파일로):
--   DROP TABLE IF EXISTS public.world_stamps;

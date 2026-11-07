-- Supabase 어드바이저 재점검(ADVISOR-RECHECK-002 — 오케스트레이터 순회 2026-11-07 16:40 KST, 오너 11/4 「백엔드 · 데이터 자율(RLS · 인덱스 포함)」).
-- 학습 계약 지문 범위 밖에서 비파괴로 고칠 수 있는 것만 한다. 지문 범위(capability 9표 · fsrs_* · profiles) 항목은 목록만
-- 갱신한다(docs/verification/advisor-recheck-20261107.md — 다음 지문 재게시 때 묶는다).
--
-- ⑴ notifications 중복 PERMISSIVE 정책 3개 정리(multiple_permissive_policies WARN 3건).
--    같은 명령에 두 벌(옛 마이그레이션 20260329000300 + 대시보드에서 만든 벌)이 있어 질의마다 둘 다 평가한다.
--    - SELECT · UPDATE: read_own_notifications ≡ "Users read own notifications", update_own_notifications ≡ "Users update own notifications"
--      (식이 피연산자 순서만 다르다 — user_id = uid) → 옛 벌을 지운다. 보이는 행 · 고칠 수 있는 행이 같다.
--    - INSERT: insert_notifications(uid IS NOT NULL)가 "Auth users insert notifications"(uid = actor_id)를 덮어, 로그인한 누구나
--      남의 이름(actor_id)으로 알림을 넣을 수 있었다(발신자 위조). 넓은 쪽을 지운다 → 알림은 「내가 보낸 사람」일 때만 넣는다.
--      남에게 보내는 것(user_id = 받는 사람)은 그대로 된다 — 옛 주석 「다른 사람에게 알림 발송 가능」의 뜻은 지킨다.
--      앱 영향 0: src에 notifications 읽기 · 쓰기가 없다(#1340 이후) · 운영 14행 마지막 쓰기 2026-05-14 KST · 쓰는 함수 · 트리거 없음.
--      줄어드는 것은 위조(actor_id ≠ 나)와 발신자 없는(actor_id NULL) 클라이언트 삽입뿐이다(계약 테스트가 행렬로 확인).
-- ⑵ 지문 밖 FK 덮개 인덱스 2개(unindexed_foreign_keys INFO) — reading_materials 행을 지울 때(계정 삭제 · 고아 정리) 참조 쪽을
--    순차 탐색하던 표: daily_suggestions(material_id, 1,056행 · 매일 늘어남) · reading_progress(material_id).
--    user_vocabulary · vocabulary_exclusions · fsrs_operations · fsrs_new_receipts의 FK는 capability · core 지문이 인덱스를 품어
--    여기서 만들면 학습 계약이 깨진다 → 목록만(다음 재게시).
-- 하지 않는 것: 미사용 인덱스 22개 삭제(합계 ≈ 400 kB, 다수가 FK 덮개 · 새 기능 · 통계 초기화 이력 없음 — 지우면 ⑵ 같은 경고가 생긴다).
--
-- 적용 경로: main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백).
-- 사전 검사: notifications 정책이 정확히 아래 6개 · 식 그대로 → 아니면 RAISE(이미 적용 · 다른 상태). 두 인덱스 대상 표 · 열이 있다.
-- 사후 검사(같은 트랜잭션): 정책 3개 · 식 그대로 · 명령/역할/PERMISSIVE 불변 · 두 인덱스 유효 · 지문 넷(_live) + capability 함수 정의 불변.
-- 되돌리기: docs/sql/advisor-notifications-fk-indexes-20261107-rollback.sql(옛 정책 3개를 운영 식 그대로 다시 만들고 두 인덱스를 지운다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE anf_expected (pol text PRIMARY KEY, cmd text NOT NULL, qual text, with_check text, keep boolean NOT NULL) ON COMMIT DROP;
INSERT INTO pg_temp.anf_expected VALUES
  ('Auth users insert notifications', 'INSERT', NULL, '(( SELECT auth.uid() AS uid) = actor_id)', true),
  ('Users read own notifications', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL, true),
  ('Users update own notifications', 'UPDATE', '(( SELECT auth.uid() AS uid) = user_id)', NULL, true),
  ('insert_notifications', 'INSERT', NULL, '(( SELECT auth.uid() AS uid) IS NOT NULL)', false),
  ('read_own_notifications', 'SELECT', '(user_id = ( SELECT auth.uid() AS uid))', NULL, false),
  ('update_own_notifications', 'UPDATE', '(user_id = ( SELECT auth.uid() AS uid))', NULL, false);

-- 지문 넷 + capability 정의를 적용 전에 잰다(20261106140000 · 180000 선례 — capability는 부르지 않고 정의를 잰다, 로그인 맥락 없음).
CREATE TEMP TABLE anf_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.anf_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
  k := 'capability';
  SELECT md5(pg_catalog.pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '') || '|' || p.proowner::text
           || '|' || p.provolatile::text || '|' || p.prosecdef::text || '|' || coalesce(p.proconfig::text, '')
    INTO v FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'learning_language_capabilities' AND p.pronargs = 0;
  RETURN NEXT;
END $m$;
INSERT INTO pg_temp.anf_pins SELECT * FROM pg_temp.anf_measure();

DO $pre$
BEGIN
  IF to_regclass('public.notifications') IS NULL OR to_regclass('public.daily_suggestions') IS NULL OR to_regclass('public.reading_progress') IS NULL THEN
    RAISE EXCEPTION 'relation public.notifications does not exist' USING ERRCODE = '42P01';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'notifications') <> 6
     OR EXISTS (SELECT 1 FROM pg_temp.anf_expected e LEFT JOIN pg_catalog.pg_policies p
                  ON p.schemaname = 'public' AND p.tablename = 'notifications' AND p.policyname = e.pol
                WHERE p.policyname IS NULL OR p.cmd <> e.cmd OR p.permissive <> 'PERMISSIVE' OR p.roles::text <> '{public}'
                   OR p.qual IS DISTINCT FROM e.qual OR p.with_check IS DISTINCT FROM e.with_check) THEN
    RAISE EXCEPTION 'advisor notifications: unexpected notifications policies (already applied or drifted) — stop';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.daily_suggestions'::regclass AND attname = 'material_id' AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.reading_progress'::regclass AND attname = 'material_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'advisor notifications: material_id column missing — stop';
  END IF;
END $pre$;

DROP POLICY insert_notifications ON public.notifications;
DROP POLICY read_own_notifications ON public.notifications;
DROP POLICY update_own_notifications ON public.notifications;

CREATE INDEX IF NOT EXISTS daily_suggestions_material_id_idx ON public.daily_suggestions (material_id);
CREATE INDEX IF NOT EXISTS reading_progress_material_id_idx ON public.reading_progress (material_id);

DO $post$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'notifications') <> 3
     OR EXISTS (SELECT 1 FROM pg_temp.anf_expected e LEFT JOIN pg_catalog.pg_policies p
                  ON p.schemaname = 'public' AND p.tablename = 'notifications' AND p.policyname = e.pol
                WHERE e.keep AND (p.policyname IS NULL OR p.cmd <> e.cmd OR p.permissive <> 'PERMISSIVE' OR p.roles::text <> '{public}'
                   OR p.qual IS DISTINCT FROM e.qual OR p.with_check IS DISTINCT FROM e.with_check)) THEN
    RAISE EXCEPTION 'advisor notifications: post-check failed (policy set or expression changed)';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('daily_suggestions_material_id_idx', 'reading_progress_material_id_idx') AND i.indisvalid AND i.indisready) <> 2 THEN
    RAISE EXCEPTION 'advisor notifications: FK indexes missing or invalid';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.anf_pins b FULL JOIN pg_temp.anf_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'advisor notifications: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.anf_measure();

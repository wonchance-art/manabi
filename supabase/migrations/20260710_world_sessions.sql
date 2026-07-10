-- 학습 월드 세션 임대(world_sessions) — 동일 계정 단일 접속의 서버 권위 판정.
--
-- 배경(PR #70 Codex 배치 리뷰 P1-2): 지금까지 중복 접속 판정은 Realtime presence 의
--   클라이언트 제공값(sessionId·joinedAt)에만 의존했다. 변조 클라이언트가 sessionId 를
--   생략/복제하거나 더 이른 joinedAt 을 게시하면 판정을 뒤집을 수 있고, 기기 시계
--   오차만으로도 먼저 접속한 세션이 질 수 있다 — 신원과 시각을 클라이언트가 통제하므로
--   보안 집행으로 쓸 수 없었다. 이 테이블은 "계정당 임대 1행"을 DB 가 소유하게 해
--   판정 신원(auth.uid() 기반 RLS)과 시각(DB 에 기록된 heartbeat_at)을 서버로 옮긴다.
--
-- net.js 임대 프로토콜(src/lib/world/net.js · createSessionLease):
--   · join   → UPDATE ... WHERE user_id = 나 AND (session_id = 내것 OR heartbeat_at 만료)
--              한 문장으로 원자적 획득(살아있는 타 세션 행은 rowcount 0 — 탈취 불가).
--              행이 없으면 INSERT, unique 충돌(23505)이면 SELECT 로 사유 판별.
--   · 유지   → 25초 간격으로 자기 행(heartbeat_at) 갱신.
--   · leave  → 자기 세션의 행만 DELETE (user_id + session_id 조건).
--   presence 휴리스틱은 보조 방어로 유지하되, 판정 소유는 이 테이블이다.
--
-- 만료 판정은 조회측(청소 잡 불필요 — 계정당 최대 1행):
--   heartbeat_at < now() - interval '40 seconds' 면 만료로 간주하고 새 세션이 인수한다.
--   (net.js 의 UPDATE WHERE 절이 이 기준으로 만료 행만 덮어쓴다.)
--
-- ⚠️ 이 리포는 마이그레이션 자동 적용 CI가 없습니다.
--    Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 붙여넣고 직접 실행하세요.
--
-- ⚠️ 무해성(fallback) 보장: 이 파일을 적용하지 않아도 앱은 깨지지 않는다.
--    테이블 부재/권한 오류 시 net.js 가 현행 presence 휴리스틱으로 강등해 동작한다
--    (UX 가드 — 보안 집행 아님). 적용하면 별도 배포 없이 자동으로 서버 권위가 켜진다.
--
-- 검증 방법:
--   1) 테이블·정책 존재 확인:
--        select policyname, cmd from pg_policies where tablename = 'world_sessions';
--      → select/insert/update/delete "own" 4건.
--   2) 기기 A 로 /world 접속 → 행 1개 생성(session_id·heartbeat_at). 기기 B 로 같은
--      계정 접속 → B 는 'duplicate' 배너(솔로), A 는 계속 정상.
--   3) A 를 leave 없이 강제 종료(탭 킬) → 40초 뒤 B 의 "다시 시도" → B 가 임대 인수.
--   4) 접속 유지 중 heartbeat_at 이 약 25초 간격으로 갱신되는지 확인.
--   5) 타 계정 토큰으로 select/update/delete 시 0 행(RLS — 타인 퇴장 불가).

CREATE TABLE IF NOT EXISTS world_sessions (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL,                       -- 임대 보유 세션(브라우저 탭)의 로컬 ID
  heartbeat_at timestamptz NOT NULL DEFAULT now(),  -- 마지막 생존 신호 — 만료 판정 기준
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE world_sessions ENABLE ROW LEVEL SECURITY;

-- 본인 행만 — 같은 계정의 다른 기기/탭은 같은 user_id 행을 보고 임대 경합하지만,
-- 타 계정의 행은 읽지도 쓰지도 못한다(위조 세션으로 타인을 퇴장시킬 수 없음).
CREATE POLICY "world_sessions_select_own" ON world_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "world_sessions_insert_own" ON world_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "world_sessions_update_own" ON world_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "world_sessions_delete_own" ON world_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 롤백:
--   DROP TABLE IF EXISTS world_sessions;
--   (정책은 테이블과 함께 삭제된다. 롤백 후에도 net.js 는 테이블 부재를 감지해
--    presence 휴리스틱으로 강등 동작하므로 별도 코드 되돌림이 필요 없다.)

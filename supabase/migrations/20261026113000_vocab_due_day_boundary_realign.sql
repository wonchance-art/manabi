-- REVIEW-DAY-BOUNDARY 후속 — #1561(04:00 KST 학습일 경계) 전에 저장된 옛 방식 단어의 복습 기한을 그 학습일의 04:00으로 한 번 맞춘다.
--   오너 승인 2026-10-26 KST 「맞추고」 · 「허용」(카드 「옛 시각에 저장된 복습 일정 109개를 그날 04:00으로 맞출까요?」 → 맞추기).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
--   db push는 파일 전체 + 이력 INSERT를 암묵 트랜잭션 하나로 보낸다 → 어느 검사든 RAISE하면 백업 · 변경 · 이력이 함께 롤백된다.
-- 대상: user_vocabulary 중 FSRS 카드로 옮기지 않은 행(fsrs_cards에 없음 — 등록 카드는 fsrs_guard_legacy_vocabulary가 쓰기를 막는다)으로
--   ⑴ 기한이 아직 오지 않았고 ⑵ 간격 ≥ 0.5일(분 단위 학습 단계 제외) ⑶ 기한이 그 학습일 04:00 KST가 아닌 것.
--   새 기한 = 기한이 속한 학습일(Asia/Seoul, 04:00에 넘어감)의 시작 = fsrsScheduler learningDayStart(learningDay(due)).
--   그날 안에서 시각만 앞당긴다(날짜 = 학습일은 그대로). 간격 · 마지막 채점 · 상태 · 판본 · 출처는 건드리지 않는다.
--   운영 사전 조회(2026-10-26 11:0x KST, 읽기 전용): 115행(Chinese 114 · Japanese 1), 그중 29행은 오늘 학습일이라 적용 즉시 열린다.
-- 백업: 새 비공개 스키마 maintenance_backup(API 미노출 · anon/authenticated 권한 없음)의 표에 바꾸기 전 값을 먼저 남긴다.
--   fsrs_private · public.fsrs_*는 core 계약 지문 범위라 거기에 표를 만들면 FSRS RPC가 막힌다 → 범위 밖 스키마. 지문 넷이 적용 전과
--   같은지 아래에서 확인한다.
-- 복원: docs/sql/vocab-due-day-boundary-realign-rollback.sql — 이 뒤로 다시 채점하지 않은 행만 옛 기한으로 되돌린다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

CREATE TEMP TABLE realign_pins ON COMMIT DROP AS
SELECT fsrs_private.contract_hash_live() core, fsrs_private.manual_contract_hash_live() manual,
       fsrs_private.admission_contract_hash_live() admission, fsrs_private.activity_profile_hash_live() activity;

CREATE SCHEMA IF NOT EXISTS maintenance_backup;
REVOKE ALL ON SCHEMA maintenance_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE maintenance_backup.vocab_due_realign_20261026 (
  id uuid PRIMARY KEY,
  old_next_review_at timestamptz NOT NULL,
  new_next_review_at timestamptz NOT NULL,
  last_reviewed_at timestamptz,
  "interval" real,
  backed_up_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
REVOKE ALL ON maintenance_backup.vocab_due_realign_20261026 FROM PUBLIC, anon, authenticated;

INSERT INTO maintenance_backup.vocab_due_realign_20261026 (id, old_next_review_at, new_next_review_at, last_reviewed_at, "interval")
SELECT v.id, v.next_review_at, x.target, v.last_reviewed_at, v."interval"
FROM public.user_vocabulary v
CROSS JOIN LATERAL (SELECT (pg_catalog.date_trunc('day', (v.next_review_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')
                            + interval '4 hours') AT TIME ZONE 'Asia/Seoul' AS target) x
WHERE v.next_review_at > pg_catalog.now() AND v."interval" >= 0.5 AND v.next_review_at <> x.target
  AND NOT EXISTS (SELECT 1 FROM public.fsrs_cards f WHERE f.card_id = v.id);

DO $realign$
DECLARE n_backup int; n_upd int;
BEGIN
 SELECT count(*) INTO n_backup FROM maintenance_backup.vocab_due_realign_20261026;
 -- 새 기한은 마지막 채점 뒤 · 옛 기한 앞이어야 한다(그날 안에서 앞당김만).
 IF EXISTS (SELECT 1 FROM maintenance_backup.vocab_due_realign_20261026
            WHERE new_next_review_at <= coalesce(last_reviewed_at, '-infinity') OR new_next_review_at >= old_next_review_at
               OR pg_catalog.to_char(new_next_review_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS.US') <> '04:00:00.000000')
 THEN RAISE EXCEPTION 'vocab_due_realign: unsafe target'; END IF;
 UPDATE public.user_vocabulary v SET next_review_at = b.new_next_review_at
 FROM maintenance_backup.vocab_due_realign_20261026 b
 WHERE v.id = b.id AND v.next_review_at = b.old_next_review_at;
 GET DIAGNOSTICS n_upd = ROW_COUNT;
 IF n_upd <> n_backup THEN RAISE EXCEPTION 'vocab_due_realign: updated % of %', n_upd, n_backup; END IF;
 IF EXISTS (SELECT 1 FROM realign_pins p WHERE (p.core, p.manual, p.admission, p.activity) IS DISTINCT FROM
            (fsrs_private.contract_hash_live(), fsrs_private.manual_contract_hash_live(),
             fsrs_private.admission_contract_hash_live(), fsrs_private.activity_profile_hash_live()))
 THEN RAISE EXCEPTION 'vocab_due_realign: FSRS contract fingerprint changed'; END IF;
 RAISE NOTICE 'vocab_due_realign: % rows moved to 04:00 KST', n_upd;
END $realign$;

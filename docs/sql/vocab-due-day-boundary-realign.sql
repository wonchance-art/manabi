-- REVIEW-DAY-BOUNDARY 후속 — #1561(04:00 KST 학습일 경계) 전에 저장된 옛 방식 단어의 복습 기한을 그 학습일의 04:00으로 한 번 맞춘다.
--   오너 승인 2026-10-26 KST 「맞추고」 · 「허용」(카드 「옛 시각에 저장된 복습 일정 109개를 그날 04:00으로 맞출까요?」 → 맞추기).
-- 적용 = 2026-10-26 11:4x KST, 오너 「다시 시도」 → Supabase MCP 한 요청(한 트랜잭션)으로 운영에 직접 적용(SET LOCAL 세 줄 없이 같은 본문).
--   결과 114행(Chinese 113 · Japanese 1, 29행 즉시 열림) · 지문 넷 게시 = 계산 · 백업 스키마 anon/authenticated USAGE 없음.
--   첫 시도는 제외한 단어 1행을 guard_excluded_vocabulary가 막아 전체 롤백 → 제외 단어(복습에 안 나옴)를 대상에서 뺐다.
--   마이그레이션이 아니라 docs/sql 기록이다(다시 실행하면 백업 표 CREATE에서 멈춘다).
-- 대상: user_vocabulary 중 FSRS 카드로 옮기지 않은 행(fsrs_cards에 없음 — 등록 카드는 fsrs_guard_legacy_vocabulary가 쓰기를 막는다)으로
--   ⑴ 기한이 아직 오지 않았고 ⑵ 간격 ≥ 0.5일(분 단위 학습 단계 제외) ⑶ 기한이 그 학습일 04:00 KST가 아닌 것
--   ⑷ 제외한 단어가 아닌 것(vocabulary_exclusions — guard_excluded_vocabulary와 같은 판정).
--   새 기한 = 기한이 속한 학습일(Asia/Seoul, 04:00에 넘어감)의 시작 = fsrsScheduler learningDayStart(learningDay(due)).
--   그날 안에서 시각만 앞당긴다(날짜 = 학습일은 그대로). 간격 · 마지막 채점 · 상태 · 판본 · 출처는 건드리지 않는다.
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
  AND NOT EXISTS (SELECT 1 FROM public.fsrs_cards f WHERE f.card_id = v.id)
  AND NOT EXISTS (SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id = v.user_id AND (e.vocabulary_id = v.id OR
      (e.language = v.language AND e.word_text = normalize(pg_catalog.btrim(coalesce(nullif(v.base_form, ''), v.word_text)), NFC))));

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

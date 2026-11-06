-- 원문만 바뀌고 분석은 옛 원문 그대로인 공개 N5 문법 시드 45~49를 서버 시드 작업으로 다시 분석한다(EN-TOKEN-COVER-001 후속 감사 —
-- 2026-11-07 KST, 오너 11/4 「백엔드 · 데이터 자율」). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용): completed 자료 전체에 완료 판정(줄마다 토큰을 이으면 공백 빼고 원문과 같은가)을 SQL로 돌렸더니 공개 자료 중
--   45 · 46 · 47 · 48 · 49만 모든 줄이 어긋났다. 20260509000100 · 20260511000100(N5 재설계)이 raw_text를 히라가나 띄어쓰기 본문으로
--   바꾸면서 processed_json을 되돌리지 않아, 뷰어가 6개월째 옛 문장(私は学生です。…)의 토큰을 보여 주고 있다. 학습 기록 영향: 단어장 ·
--   문맥 · 교정 0행(reading_progress 1행 — 줄 위치와 무관). 재분석은 starter 작업의 전체 분석(fullReset)이 맡는다 — 어긋난 줄의 옛 토큰은
--   보존 단계(preserveReanalysisTokens)가 이미 건너뛴다.
-- 이 파일이 하는 것: 위 다섯 자료 중 「관리자(작업 주인) 소유 · 공개 · completed · 실제로 줄이 어긋남」인 것만 processed_json.status를
--   'idle'로 바꾸고(sequence · dictionary · metadata는 그대로 — 다음 분석이 저장될 때 바뀐다) starter 작업의 material_ids 끝에 붙인다.
--   원문 · 다른 자료 · 작업의 진행 · 사용량 · 시도 수 · 정책 · 함수 · 학습 계약 지문은 그대로. 다음 깨우기는 기존 하루 한 번 예약 실행(02:45 KST).
--   비용: 짧은 자료 5편(줄 8~10) — 승인된 시드 분석 범위의 일부(같은 공개 N5 시드).
-- 조건이 맞지 않으면(starter 작업 1줄 아님 · running/paused 아님 · 어긋난 completed 자료 없음) 아무것도 바꾸지 않고 알린다 — 다시 돌려도 무변경.
-- 복원(분석이 저장되기 전에만 의미 있음):
--   update public.reading_materials set processed_json = jsonb_set(processed_json, '{status}', '"completed"')
--     where id in (45,46,47,48,49) and processed_json->>'status' = 'idle';
--   update public.canonical_analysis_jobs set material_ids = array(select x from unnest(material_ids) x where x not in (45,46,47,48,49))
--     where kind = 'starter';

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $stale$
DECLARE j public.canonical_analysis_jobs%rowtype; n int; stale bigint[]; reset int;
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
  SELECT count(*) INTO n FROM public.canonical_analysis_jobs WHERE kind = 'starter';
  IF n <> 1 THEN
    RAISE NOTICE 'stale n5 seeds: expected exactly 1 starter job, found % — nothing changed', n;
    RETURN;
  END IF;
  SELECT * INTO j FROM public.canonical_analysis_jobs WHERE kind = 'starter' FOR UPDATE;
  IF j.status NOT IN ('running', 'paused') THEN
    RAISE NOTICE 'stale n5 seeds: starter job is % — nothing changed', j.status;
    RETURN;
  END IF;

  -- 줄마다: 원문(공백 제외) = 그 줄 토큰(개행 제외)을 순서대로 이은 값(공백 제외)인가. 빈 줄은 보지 않는다.
  WITH m AS (
    SELECT id, raw_text, processed_json AS pj FROM public.reading_materials
     WHERE id IN (45, 46, 47, 48, 49) AND owner_id = j.owner_id AND visibility = 'public'
       AND processed_json ->> 'status' = 'completed' AND jsonb_typeof(processed_json -> 'sequence') = 'array'
  ), seq AS (
    SELECT m.id, s.ord, (regexp_match(s.sid, '^(?:id|br|failed)_(\d+)_'))[1]::int AS line, m.pj -> 'dictionary' -> s.sid AS tok
      FROM m, jsonb_array_elements_text(m.pj -> 'sequence') WITH ORDINALITY s(sid, ord)
  ), built AS (
    SELECT id, line, string_agg(CASE WHEN tok ->> 'pos' = '개행' THEN '' ELSE coalesce(tok ->> 'text', '') END, '' ORDER BY ord) AS txt
      FROM seq WHERE line IS NOT NULL GROUP BY id, line
  ), raw AS (
    SELECT m.id, l.n - 1 AS line, l.t FROM m, unnest(string_to_array(m.raw_text, E'\n')) WITH ORDINALITY l(t, n)
  )
  SELECT array_agg(DISTINCT r.id ORDER BY r.id) INTO stale
    FROM raw r LEFT JOIN built b USING (id, line)
   WHERE btrim(r.t, E' \t\r　') <> ''
     AND regexp_replace(r.t, '[[:space:]　﻿]', '', 'g') <> regexp_replace(coalesce(b.txt, ''), '[[:space:]　﻿]', '', 'g');

  IF stale IS NULL THEN
    RAISE NOTICE 'stale n5 seeds: no completed seed among 45..49 is out of date — nothing changed';
    RETURN;
  END IF;
  IF cardinality(j.material_ids) + cardinality(stale) > 200 THEN
    RAISE EXCEPTION 'stale n5 seeds: starter job would exceed 200 materials';
  END IF;

  UPDATE public.reading_materials SET processed_json = jsonb_set(processed_json, '{status}', '"idle"')
   WHERE id = ANY (stale);
  GET DIAGNOSTICS reset = ROW_COUNT;
  UPDATE public.canonical_analysis_jobs
     SET material_ids = material_ids || array(SELECT x FROM unnest(stale) x WHERE x <> ALL (material_ids) ORDER BY x),
         updated_at = now()
   WHERE id = j.id;
  RAISE NOTICE 'stale n5 seeds: % reset to idle and queued: %', reset, stale;
END $stale$;

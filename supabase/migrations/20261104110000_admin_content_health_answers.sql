-- EVENT-SOURCE-001 후속(2026-11-04 KST, 오너 상시 방침 「백엔드 데이터 관련 개선은 알아서」 · CLAUDE.md) —
-- 관리자 지표 「콘텐츠 건강」(admin_content_health)이 답 아닌 기록까지 오답률에 넣던 것을 정답률 정본과 같은 출처로 좁힌다.
--   예전: source <> 'ui'만 뺐다 → 단어 목록 바퀴(level) · 한자 탭(hanzi)의 「몰라요」 자기 확인, 집중 연습(practice — item_key가 단어 id),
--         사전 자가 확인(dict), /study 도움 요청(assist, 늘 correct:false)이 「고장 난 콘텐츠」 후보로 섞였다.
--   운영 읽기 실측(같은 날, 지난 30일): 지금 상위 10개가 전부 level 자기 확인(오답률 0.80 ~ 0.86) — 진짜 채점 문항은 하나도 안 보였다.
--   지금: 정답률 정본(weeklyReport.isGradedReviewEvent)이 빼는 출처를 그대로 뺀다 —
--         reviewEventSources.NON_ANSWER_SOURCES(ui · dict · assist) ∪ ACTIVITY_ONLY_SOURCES(hanzi · level) ∪ practice.
--         같은 목록인지는 계약 adminContentHealth.migration.test.js가 코드 상수와 대조한다.
-- 바꾸지 않는 것: 서명 · 반환 열 · SECURITY DEFINER · search_path · 관리자 검사 · 실행권(CREATE OR REPLACE는 proacl을 지킨다) · 최소 노출 3 · 정렬.
-- 학습 계약 지문(core · manual · admission · profile)에 들지 않는 함수다 — 앞뒤 검사가 네 계약 동치를 확인하고, 어긋나면 전체가 롤백된다.
-- 실행 형태: db push가 파일 전체를 한 트랜잭션으로 보낸다(BEGIN/COMMIT 없음).
-- 복원: docs/sql/admin-content-health-rollback.sql(예전 본문 그대로, 같은 검사).
do $pre$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_content_health: learning contracts already drifted — stop';
  end if;
end $pre$;

-- 적용 전 속성(있을 때만 — 운영에는 있다. 관측 fixture처럼 없는 바탕에서는 새로 만들고 운영과 같은 실행권을 준다).
create temporary table ach_before on commit drop as
  select p.prosecdef, p.proacl::text as acl, p.provolatile, p.proconfig::text as config, p.prorettype, p.proowner
  from pg_proc p where p.oid = to_regprocedure('public.admin_content_health(integer,integer)');

CREATE OR REPLACE FUNCTION public.admin_content_health(days integer DEFAULT 30, top_n integer DEFAULT 10)
 RETURNS TABLE(item_key text, exposures bigint, wrong_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    r.item_key,
    count(*)::bigint AS exposures,
    round((count(*) FILTER (WHERE NOT r.correct))::numeric / count(*), 4) AS wrong_rate
  FROM review_events r
  WHERE r.created_at >= now() - (days::text || ' days')::interval
    AND r.source NOT IN ('ui', 'dict', 'assist', 'practice', 'hanzi', 'level')
    AND r.item_key <> '-'
  GROUP BY r.item_key
  HAVING count(*) >= 3
  ORDER BY wrong_rate DESC, exposures DESC
  LIMIT top_n;
END;
$function$;

-- 실행권은 운영 그대로(20260708000100 · 20261016165745): public · anon 회수, authenticated · service_role. 이미 그 상태면 바뀌지 않는다.
revoke execute on function public.admin_content_health(integer, integer) from public, anon;
grant execute on function public.admin_content_health(integer, integer) to authenticated, service_role;

do $post$
declare b record; a record;
begin
  select p.prosecdef, p.proacl::text as acl, p.provolatile, p.proconfig::text as config, p.prorettype, p.proowner, p.prosrc
    into strict a from pg_proc p where p.oid = to_regprocedure('public.admin_content_health(integer,integer)');
  select * into b from pg_temp.ach_before;
  if found and (a.prosecdef is distinct from b.prosecdef or a.acl is distinct from b.acl or a.provolatile is distinct from b.provolatile
     or a.config is distinct from b.config or a.prorettype is distinct from b.prorettype or a.proowner is distinct from b.proowner) then
    raise exception 'admin_content_health: function attributes or grants changed';
  end if;
  if not a.prosecdef or a.config is distinct from '{search_path=public}'
     or not has_function_privilege('authenticated', 'public.admin_content_health(integer,integer)', 'EXECUTE') then
    raise exception 'admin_content_health: security definer · search_path · authenticated execute expected';
  end if;
  if position($q$r.source NOT IN ('ui', 'dict', 'assist', 'practice', 'hanzi', 'level')$q$ in a.prosrc) = 0
     or position($q$role = 'admin'$q$ in a.prosrc) = 0 then
    raise exception 'admin_content_health: body differs from the reviewed change';
  end if;
  if has_function_privilege('anon', 'public.admin_content_health(integer,integer)', 'EXECUTE') then
    raise exception 'admin_content_health: anon must not execute';
  end if;
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_content_health: learning contract drift after change — rolled back';
  end if;
end $post$;

DROP TABLE pg_temp.ach_before;

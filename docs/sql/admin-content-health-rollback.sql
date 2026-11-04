-- 복원: 20261104110000_admin_content_health_answers.sql → 예전 본문(source <> 'ui'만 뺀다) 그대로.
-- 서명 · 반환 열 · SECURITY DEFINER · search_path · 관리자 검사 · 실행권은 그대로 남는다(CREATE OR REPLACE).
-- 앞뒤로 학습 계약 넷의 동치를 확인한다 — 어긋나면 예외로 전체가 롤백된다. 실행은 오너 확인 뒤(운영 SQL 편집기 · 한 트랜잭션).
do $pre$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_content_health rollback: learning contracts already drifted — stop';
  end if;
end $pre$;

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
    AND r.source <> 'ui'
    AND r.item_key <> '-'
  GROUP BY r.item_key
  HAVING count(*) >= 3
  ORDER BY wrong_rate DESC, exposures DESC
  LIMIT top_n;
END;
$function$;

do $post$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_content_health rollback: learning contract drift — rolled back';
  end if;
end $post$;

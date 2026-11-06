-- 비싼 AI 경로의 사용자별 일일 상한을 DB에(AI-QUOTA-001 — 발매 준비 점검 1 · 2, 오케스트레이터 판정 2026-11-06 KST,
-- 오너 11/4 「백엔드 · 데이터 자율」). 무료 발매에서 분석 · 첨삭 · 설명 · 음성 호출이 상한 없이 열려 있었다:
-- 분당 제한(src/lib/server/rateLimit.js 등)은 서버 인스턴스마다 따로인 메모리 Map이라 Vercel 다중 인스턴스에서 합쳐지지 않고,
-- 하루 · 한 달 상한은 대화(150턴/일, DB 행 수) 하나뿐이었다.
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 이 파일이 하는 것:
--   usage_private.ai_daily_usage(subject, day, kind, units) — 주체(`u:<uid>` · `ip:<sha256>`)별 · 학습일(KST 04시 경계)별 · 종류별 사용량.
--     anon · authenticated는 스키마부터 닫힌다(권한 0). 상한값은 서버 코드(src/lib/server/dailyQuota.js)가 정본 — 근거를 거기 둔다.
--   public.consume_ai_daily_quota(text, text, integer, integer) — service_role 전용. 한도 안이면 원자적으로 더하고 {ok:true, used},
--     넘으면 더하지 않고 {ok:false, used}. 동시 요청은 행 잠금(ON CONFLICT DO UPDATE … WHERE)으로 줄을 서서 상한을 넘지 않는다.
--   30일 지난 행은 하루 첫 호출이 지운다(작은 표 — 사용자 × 종류 × 30일).
-- 학습 계약 지문(core · manual · admission · activity · capability 9표) 범위 밖 — 새 스키마 · 새 표 · 새 함수만, 기존 객체 무변경.
-- 복원: docs/sql/ai-daily-quota-20261106-rollback.sql(함수 · 스키마 삭제 — 서버 코드는 RPC 실패 시 열어 둔다(fail-open)).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

create schema if not exists usage_private;
revoke all on schema usage_private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema usage_private from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema usage_private from authenticated'; end if;
end $$;

create table if not exists usage_private.ai_daily_usage (
  subject text not null check (subject ~ '^(u:[0-9a-f-]{36}|ip:[0-9a-f]{64})$'),
  day date not null,
  kind text not null check (kind ~ '^[a-z_]{1,24}$'),
  units integer not null default 0 check (units >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, day, kind)
);
create index if not exists ai_daily_usage_day on usage_private.ai_daily_usage (day);
alter table usage_private.ai_daily_usage enable row level security;
revoke all on table usage_private.ai_daily_usage from public;

create or replace function public.consume_ai_daily_quota(p_subject text, p_kind text, p_units integer, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare d date := ((now() at time zone 'Asia/Seoul') - interval '4 hours')::date; used integer;
begin
  if p_subject is null or p_kind is null or p_units is null or p_units < 1 or p_limit is null or p_limit < 1 then
    raise exception 'ai_quota_invalid' using errcode = '22023';
  end if;
  if p_units > p_limit then
    select coalesce(max(u.units), 0) into used from usage_private.ai_daily_usage u where u.subject = p_subject and u.day = d and u.kind = p_kind;
    return jsonb_build_object('ok', false, 'used', used, 'limit', p_limit, 'day', d);
  end if;
  insert into usage_private.ai_daily_usage as u (subject, day, kind, units) values (p_subject, d, p_kind, p_units)
  on conflict (subject, day, kind) do update set units = u.units + excluded.units, updated_at = now()
    where u.units + excluded.units <= p_limit
  returning u.units into used;
  if used is null then
    select u.units into used from usage_private.ai_daily_usage u where u.subject = p_subject and u.day = d and u.kind = p_kind;
    return jsonb_build_object('ok', false, 'used', coalesce(used, 0), 'limit', p_limit, 'day', d);
  end if;
  -- 그날 그 종류의 첫 사용(새 행)이면 30일 지난 행을 치운다 — 하루 몇 번뿐이라 비용이 작다.
  if used = p_units then delete from usage_private.ai_daily_usage u where u.day < d - 30; end if;
  return jsonb_build_object('ok', true, 'used', used, 'limit', p_limit, 'day', d);
end
$function$;

revoke all on function public.consume_ai_daily_quota(text, text, integer, integer) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.consume_ai_daily_quota(text, text, integer, integer) from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on function public.consume_ai_daily_quota(text, text, integer, integer) from authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.consume_ai_daily_quota(text, text, integer, integer) to service_role'; end if;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and (has_function_privilege('anon', 'public.consume_ai_daily_quota(text,text,integer,integer)', 'EXECUTE')
          or has_schema_privilege('anon', 'usage_private', 'USAGE')) then
    raise exception 'ai quota must be closed to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and (has_function_privilege('authenticated', 'public.consume_ai_daily_quota(text,text,integer,integer)', 'EXECUTE')
          or has_schema_privilege('authenticated', 'usage_private', 'USAGE')) then
    raise exception 'ai quota must be closed to authenticated';
  end if;
end $$;

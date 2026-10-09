-- manabi 운영 DB 읽기 전용 확인 묶음 (2026-10-07 KST, Claude 작성)
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 아래 Q1~Q3를 "하나씩" 실행하고 결과를 그대로 붙여 주세요.
-- 전부 SELECT만 하고, 각 블록을 read only 트랜잭션으로 감싸 쓰기가 불가능합니다.
-- 개인 식별값(이메일·ID)과 학습 원문은 출력하지 않습니다. Q3는 함수 소스(코드)만 출력합니다.

-- ─────────────────────────────────────────────────────────────
-- Q1. 팀 없이 쓴 교재 설명 규모 (뷰어 경계 작업 PR-2b 필요 여부)
--     rows_without_team = 0 이면 별도 화면이 필요 없습니다. 집계 숫자만 나옵니다.
-- ─────────────────────────────────────────────────────────────
begin read only;
select count(*) filter (where t.id is null)                     as rows_without_team,
       count(distinct a.material_id) filter (where t.id is null) as materials_without_team,
       count(*)                                                  as rows_total,
       count(*) filter (where a.archived)                        as rows_archived
from public.textbook_annotations a
join public.reading_materials m on m.id = a.material_id
left join lateral (
  select r.id from public.reading_materials r
  where r.owner_id = m.owner_id
    and r.processed_json #>> '{metadata,team,root}' = 'true'
    and r.processed_json #>> '{metadata,team,bookKey}' = m.processed_json #>> '{metadata,book,key}'
  limit 1) t on true;
rollback;

-- ─────────────────────────────────────────────────────────────
-- Q2. 운영 마이그레이션 이력 (2026-09 이후) — main의 supabase/migrations와 대조용
--     main에 있는 9월 이후 버전: 20260910024120, 20260910070535, 20260911072945,
--     20260930135103, 20260930154448. 이 밖의 버전이 나오면 main에 파일이 없는 것입니다.
-- ─────────────────────────────────────────────────────────────
begin read only;
select version, name
from supabase_migrations.schema_migrations
where version >= '20260901'
order by version;
rollback;

-- ─────────────────────────────────────────────────────────────
-- Q3. 실제로 운영에서 도는 함수 본문과 실행 권한
--     - save_vocabulary_context: #1321 스택 마이그레이션이 덮어썼는지(main 코드가 호출함)
--     - update_streak: 10-05 래퍼 전환 뒤 일반 학습 호출에도 스트릭이 오르는지
--     출력은 함수 소스 코드와 권한(ACL)뿐입니다.
-- ─────────────────────────────────────────────────────────────
begin read only;
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       p.proacl::text as acl,
       md5(p.prosrc) as body_md5,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('update_streak', 'save_vocabulary_context', 'save_vocabulary_context_for', 'classroom_save_vocabulary')
order by p.proname, args;
rollback;

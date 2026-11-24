-- 복원(필요할 때만) — 20261124010000_library_level_sort_rank. personal_library_page_v2의 급수 키를 옛 글자순으로 되돌리고 순위 함수를 지운다.
-- 데이터는 바꾸지 않은 마이그레이션이라 함수 정의만 되돌린다. 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.personal_library_page_v2(p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$
 with rows as(select item from library_private.managed_rows(p_filters) item), page as (
 select item||jsonb_build_object('match_child',(
  select jsonb_build_object('id',c->>'id','title',c->>'title') from jsonb_array_elements(item->'children') c
  where coalesce(btrim(p_filters->>'query'),'')<>'' and strpos(lower(c->>'title'),lower(left(btrim(p_filters->>'query'),120)))>0
  order by coalesce((c->>'order')::numeric,0),c->>'id' limit 1
 )) item from rows order by
  case when p_filters->>'sort'='opened' or p_filters->>'recent'='true' then item->>'opened_at' end desc nulls last,
  case when p_filters->>'sort'='title' then lower(item->>'title') end,
  case when p_filters->>'sort'='level' then item->>'level' end,
  item->>'created_at' desc nulls last,item->>'target_kind',item->>'target_id'
 offset greatest(0,least(coalesce(p_offset,0),100000)) limit greatest(1,least(coalesce(p_limit,20),100)))
 select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(item-'children'-'listed') from page),'[]'))
$$;
DROP FUNCTION IF EXISTS library_private.material_level_rank(text, text);

COMMIT;

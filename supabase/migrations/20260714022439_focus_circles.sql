create schema if not exists private;

create table if not exists public.focus_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  meeting_weekday smallint not null default 6 check (meeting_weekday between 0 and 6),
  start_time time not null default '18:00',
  end_time time not null default '20:00',
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.focus_circle_members (
  circle_id uuid not null references public.focus_circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.focus_meetings (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.focus_circles(id) on delete cascade,
  meeting_date date not null,
  kind text not null default 'weekly' check (kind in ('weekly', 'monthly')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (circle_id, meeting_date)
);

create table if not exists public.focus_entries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.focus_meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_state text not null default '',
  focus_goal text not null default '',
  completed text not null default '',
  learned text not null default '',
  blocker text not null default '',
  next_action text not null default '',
  help_needed text not null default '',
  advice_mode text not null default 'listen' check (advice_mode in ('listen', 'questions', 'advice')),
  meaningful text not null default '',
  energy_gain text not null default '',
  energy_drain text not null default '',
  repeated_issue text not null default '',
  keep_doing text not null default '',
  stop_doing text not null default '',
  monthly_priority text not null default '',
  monthly_experiment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index if not exists focus_circles_owner_idx
  on public.focus_circles(owner_id);
create index if not exists focus_circle_members_user_idx
  on public.focus_circle_members(user_id, circle_id);
create index if not exists focus_meetings_circle_date_idx
  on public.focus_meetings(circle_id, meeting_date desc);
create index if not exists focus_meetings_created_by_idx
  on public.focus_meetings(created_by);
create index if not exists focus_entries_meeting_idx
  on public.focus_entries(meeting_id, user_id);
create index if not exists focus_entries_user_idx
  on public.focus_entries(user_id);

create or replace function private.is_focus_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.focus_circle_members member
    where member.circle_id = target_circle_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_focus_circle_owner(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.focus_circles circle
    where circle.id = target_circle_id
      and circle.owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_access_focus_meeting(target_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.focus_meetings meeting
    join public.focus_circle_members member
      on member.circle_id = meeting.circle_id
    where meeting.id = target_meeting_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_focus_circle_member(uuid) from public;
revoke all on function private.is_focus_circle_owner(uuid) from public;
revoke all on function private.can_access_focus_meeting(uuid) from public;
grant execute on function private.is_focus_circle_member(uuid) to authenticated;
grant execute on function private.is_focus_circle_owner(uuid) to authenticated;
grant execute on function private.can_access_focus_meeting(uuid) to authenticated;

alter table public.focus_circles enable row level security;
alter table public.focus_circle_members enable row level security;
alter table public.focus_meetings enable row level security;
alter table public.focus_entries enable row level security;

create policy "focus circles are visible to members"
on public.focus_circles for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_focus_circle_member(id))
);

create policy "users can create focus circles"
on public.focus_circles for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "owners can update focus circles"
on public.focus_circles for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "owners can delete focus circles"
on public.focus_circles for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy "focus members are visible to circle members"
on public.focus_circle_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_focus_circle_member(circle_id))
  or (select private.is_focus_circle_owner(circle_id))
);

create policy "users can join focus circles"
on public.focus_circle_members for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    role = 'member'
    or (
      role = 'owner'
      and (select private.is_focus_circle_owner(circle_id))
    )
  )
);

create policy "members can leave focus circles"
on public.focus_circle_members for delete
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_focus_circle_owner(circle_id))
);

create policy "focus meetings are visible to members"
on public.focus_meetings for select
to authenticated
using ((select private.is_focus_circle_member(circle_id)));

create policy "members can create focus meetings"
on public.focus_meetings for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_focus_circle_member(circle_id))
);

create policy "members can update focus meetings"
on public.focus_meetings for update
to authenticated
using ((select private.is_focus_circle_member(circle_id)))
with check ((select private.is_focus_circle_member(circle_id)));

create policy "meeting creators and owners can delete focus meetings"
on public.focus_meetings for delete
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_focus_circle_owner(circle_id))
);

create policy "focus entries are visible to meeting members"
on public.focus_entries for select
to authenticated
using ((select private.can_access_focus_meeting(meeting_id)));

create policy "users can create their own focus entries"
on public.focus_entries for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_access_focus_meeting(meeting_id))
);

create policy "users can update their own focus entries"
on public.focus_entries for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_focus_meeting(meeting_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.can_access_focus_meeting(meeting_id))
);

create policy "users can delete their own focus entries"
on public.focus_entries for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_focus_meeting(meeting_id))
);

grant select, insert, update, delete on public.focus_circles to authenticated;
grant select, insert, delete on public.focus_circle_members to authenticated;
grant select, insert, update, delete on public.focus_meetings to authenticated;
grant select, insert, update, delete on public.focus_entries to authenticated;

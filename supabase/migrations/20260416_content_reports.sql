-- 공용 자료 신고 테이블
-- 부적절한 공개 자료를 다른 사용자가 신고할 수 있도록 함
-- 관리자는 profiles.role='admin'에서 대시보드 또는 SQL로 review

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  material_id bigint not null references reading_materials(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,            -- 'inappropriate' | 'copyright' | 'spam' | 'other'
  details text,                    -- 선택 입력 (상세 설명)
  status text not null default 'pending',  -- 'pending' | 'reviewed' | 'dismissed' | 'actioned'
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text,
  unique (material_id, reporter_id)  -- 같은 사용자가 같은 자료 중복 신고 방지
);

create index if not exists idx_content_reports_status on content_reports(status) where status = 'pending';
create index if not exists idx_content_reports_material on content_reports(material_id);

alter table content_reports enable row level security;

-- 로그인 사용자는 본인 신고 내역 조회 가능
create policy "users can view own reports"
  on content_reports for select
  using (auth.uid() = reporter_id);

-- 로그인 사용자는 신고 작성 가능 (본인 자료는 신고 불가)
create policy "users can create reports"
  on content_reports for insert
  with check (
    auth.uid() = reporter_id
    and not exists (
      select 1 from reading_materials m
      where m.id = content_reports.material_id
        and m.owner_id = auth.uid()
    )
  );

-- 관리자는 모든 신고 열람/수정 가능
create policy "admins can view all reports"
  on content_reports for select
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

create policy "admins can update reports"
  on content_reports for update
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

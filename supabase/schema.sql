-- ─────────────────────────────────────────────────────────────────────────────
-- Songs table — shared catalog. Public read, write restricted by RLS to admin
-- + collection 멤버 (see migrations/0003_song_change_requests.sql).
-- id는 uuid (gen_random_uuid()로 자동 발급). 0004 마이그레이션에서 통일됨.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists songs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  artist      text default '',
  key         text default 'C',
  capo        integer default 0,
  bpm         integer default 80,
  folder      text,
  content     text not null,
  notes       jsonb default '{}',
  created_at  timestamptz default now()
);

-- 기존 DB에 신규 컬럼 추가용 마이그레이션
alter table songs add column if not exists bpm    integer default 80;
alter table songs add column if not exists folder text;
alter table songs add column if not exists notes  jsonb default '{}';

alter table songs enable row level security;

-- Drop legacy policies if present
drop policy if exists "Public read songs"        on songs;
drop policy if exists "Public insert songs"      on songs;
drop policy if exists "Public update songs"      on songs;
drop policy if exists "Public delete songs"      on songs;
drop policy if exists "Authenticated read songs" on songs;

-- Read is public so non-authenticated visitors can browse the song catalog.
create policy "Public read songs"
  on songs for select
  using (true);

-- Write 정책 (insert/update/delete)는 0003_song_change_requests.sql에서
-- is_admin() / can_edit_song(id)로 교체됨. 신규 셋업이면 0003 적용 후 정책 활성.

-- ─────────────────────────────────────────────────────────────────────────────
-- User songs — per-user tunings, only the owner can read/write their rows.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists user_songs (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  song_id    uuid not null references songs(id) on delete cascade,
  semitones  integer default 0,
  notes      jsonb default '{}',
  content    text,
  created_at timestamptz default now(),
  unique(user_id, song_id)
);

alter table user_songs enable row level security;

drop policy if exists "Users read own songs"   on user_songs;
drop policy if exists "Users insert own songs" on user_songs;
drop policy if exists "Users update own songs" on user_songs;
drop policy if exists "Users delete own songs" on user_songs;

create policy "Users read own songs"   on user_songs for select using (auth.uid() = user_id);
create policy "Users insert own songs" on user_songs for insert with check (auth.uid() = user_id);
create policy "Users update own songs" on user_songs for update using (auth.uid() = user_id);
create policy "Users delete own songs" on user_songs for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Rooms — collaborative session, restricted to authenticated users.
-- (Code-based sharing happens in-app via the rooms.code column.)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  song_id     uuid references songs(id),
  semitones   integer default 0,
  play_idx    integer default 0,
  is_playing  boolean default false,
  created_at  timestamptz default now()
);

alter table rooms enable row level security;

drop policy if exists "Public read rooms"   on rooms;
drop policy if exists "Public insert rooms" on rooms;
drop policy if exists "Public update rooms" on rooms;

create policy "Authenticated read rooms"   on rooms for select using (auth.role() = 'authenticated');
create policy "Authenticated insert rooms" on rooms for insert with check (auth.role() = 'authenticated');
create policy "Authenticated update rooms" on rooms for update using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- Migrations 적용 순서 (Supabase Dashboard SQL Editor에서 차례대로 실행):
--   0002_collections.sql            — collections / collection_members / collection_songs / invites
--   0003_song_change_requests.sql   — admin/editor RLS + 변경 요청 워크플로우
--   0004_unify_uuid_and_reseed.sql  — songs.id를 uuid로 통일 + 65곡 seed 일괄 등록
-- 별도의 카탈로그 sample seed는 두지 않음 (곡 데이터는 0004가 단일 출처).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Songs table — shared catalog. Read/write restricted to authenticated users.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists songs (
  id          text primary key,
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

-- Drop legacy policies if present (both legacy `Public *` and the earlier `Authenticated read`)
drop policy if exists "Public read songs"        on songs;
drop policy if exists "Public insert songs"      on songs;
drop policy if exists "Public update songs"      on songs;
drop policy if exists "Public delete songs"      on songs;
drop policy if exists "Authenticated read songs" on songs;

-- Read is public so non-authenticated visitors can browse the song catalog.
create policy "Public read songs"
  on songs for select
  using (true);

-- Writes still require an authenticated session.
create policy "Authenticated insert songs"
  on songs for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated update songs"
  on songs for update
  using (auth.role() = 'authenticated');

create policy "Authenticated delete songs"
  on songs for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- User songs — per-user tunings, only the owner can read/write their rows.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists user_songs (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  song_id    text not null references songs(id) on delete cascade,
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
  song_id     text references songs(id),
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
-- Sample songs — seed for first-time setup.
-- ─────────────────────────────────────────────────────────────────────────────
insert into songs (id, title, artist, key, capo, bpm, content) values
(
  'neoege', '너에게난 나에게넌', '자전거탄 풍경', 'G', 0, 74,
  E'{title: 너에게 난 나에게 넌}\n{artist: 자전거 탄 풍경}\n{key: G}\n{capo: 0}\n{bpm: 74}\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Verse 1]\n[G.D.]나에게 넌 | [Em.Bm.]내 외롭던 지난 시간을 | [C.G.]환하게 비춰주던 | [Am.D.]햇살이 되고 |\n[G.D.]조그맣던 | [Em.G.]너의 하얀 손 위에 | [C.G.]빛나는 보석처럼 | [Am.D.]영원의 약속이 되어 |\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Interlude]\n[C.D.] ||\n[G.D.] | [Em.Bm.] | [C.G.] | [Am.D.] |\n\n[Verse 2]\n[G.D.]나에게 넌 | [Em.Bm.]초록의 슬픈 노래로 | [C.G.]내 작은 가슴 속에 | [Am.D.]이렇게 남아 |\n[G.D.]반짝이던 | [Em.G.]너의 예쁜 눈망울에 | [C.G.]수많은 별이 되어 | [Am.D.]영원토록 빛나고 싶어 |\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Outro]\n[Am.C.]그림처럼 남아주기를 | [D.G.] |\n'
)
on conflict (id) do nothing;

-- Songs table
create table if not exists songs (
  id          text primary key,
  title       text not null,
  artist      text default '',
  key         text default 'C',
  capo        integer default 0,
  bpm         integer default 80,
  folder      text,             -- 폴더명 (null = 기본 목록)
  content     text not null,    -- 악보 원문 ([코드.]가사 | 포맷)
  created_at  timestamptz default now()
);

-- 기존 DB에 신규 컬럼 추가용 마이그레이션
alter table songs add column if not exists bpm    integer default 80;
alter table songs add column if not exists folder text;
alter table songs add column if not exists notes  jsonb default '{}';

alter table songs enable row level security;

create policy "Public read songs"
  on songs for select using (true);
create policy "Public insert songs"
  on songs for insert with check (true);
create policy "Public update songs"
  on songs for update using (true);
create policy "Public delete songs"
  on songs for delete using (true);

-- Sample songs
insert into songs (id, title, artist, key, capo, bpm, content) values
(
  'noeul', '노을', '김광석', 'G', 0, 80,
  E'---\ntitle: 노을\nartist: 김광석\nkey: G\ncapo: 0\nbpm: 80\n---\n\n[G][D][Em][G7]\n너에게난 해질 | 녘노을 처럼\n\n[C][G][Am7][D]\n한편의 아름다운 | 추억이 되고\n\n[G][D][Em][G7]\n기나긴 이 하루도 | 저물어가면\n\n[C][D][G]\n행복했던 그 | 기억에 | 잠겨\n\n[G][D][Em][G7]\n붉게 물든 노을 | 바라보면서\n\n[C][G][Am7][D]\n왠지 모를 서러 | 움에 눈물 지네\n\n[G][D][Em][G7]\n이 세상에 나 | 홀로 남겨진 것 | 같아\n\n[C][D][G]\n안개처럼 피어 | 오른 | 외로움\n'
),
(
  'neoege', '너에게난 나에게넌', '자전거탄 풍경', 'G', 0, 74,
  E'{title: 너에게 난 나에게 넌}\n{artist: 자전거 탄 풍경}\n{key: G}\n{capo: 0}\n{bpm: 74}\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Verse 1]\n[G.D.]나에게 넌 | [Em.Bm.]내 외롭던 지난 시간을 | [C.G.]환하게 비춰주던 | [Am.D.]햇살이 되고 |\n[G.D.]조그맣던 | [Em.G.]너의 하얀 손 위에 | [C.G.]빛나는 보석처럼 | [Am.D.]영원의 약속이 되어 |\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Interlude]\n[C.D.] ||\n[G.D.] | [Em.Bm.] | [C.G.] | [Am.D.] |\n\n[Verse 2]\n[G.D.]나에게 넌 | [Em.Bm.]초록의 슬픈 노래로 | [C.G.]내 작은 가슴 속에 | [Am.D.]이렇게 남아 |\n[G.D.]반짝이던 | [Em.G.]너의 예쁜 눈망울에 | [C.G.]수많은 별이 되어 | [Am.D.]영원토록 빛나고 싶어 |\n\n[Chorus]\n[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |\n[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |\n\n[Outro]\n[Am.C.]그림처럼 남아주기를 | [D.G.] |\n'
)
on conflict (id) do nothing;

-- User songs (개인 튜닝 저장)
create table if not exists user_songs (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  song_id    text not null references songs(id) on delete cascade,
  semitones  integer default 0,
  notes      jsonb default '{}',
  content    text,   -- 커스텀 악보 (null = 원본 사용)
  created_at timestamptz default now(),
  unique(user_id, song_id)
);

alter table user_songs enable row level security;

create policy "Users read own songs"
  on user_songs for select using (auth.uid() = user_id);
create policy "Users insert own songs"
  on user_songs for insert with check (auth.uid() = user_id);
create policy "Users update own songs"
  on user_songs for update using (auth.uid() = user_id);
create policy "Users delete own songs"
  on user_songs for delete using (auth.uid() = user_id);

-- Rooms table (합주 모드 – Supabase Realtime으로 실시간 동기화)
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  song_id     text references songs(id),
  semitones   integer default 0,    -- 현재 키 변경
  play_idx    integer default 0,    -- 현재 재생 위치
  is_playing  boolean default false,
  created_at  timestamptz default now()
);

alter table rooms enable row level security;

create policy "Public read rooms"   on rooms for select using (true);
create policy "Public insert rooms" on rooms for insert with check (true);
create policy "Public update rooms" on rooms for update using (true);

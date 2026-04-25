-- Songs table
create table if not exists songs (
  id        text primary key,
  title     text not null,
  artist    text,
  key       text,
  capo      integer default 0,
  content   text not null,  -- raw markdown
  created_at timestamptz default now()
);

alter table songs enable row level security;

create policy "Public read songs"
  on songs for select using (true);

-- Insert sample song
insert into songs (id, title, artist, key, capo, content) values (
  'noeul',
  '노을',
  '김광석',
  'G',
  0,
  E'---\ntitle: 노을\nartist: 김광석\nkey: G\ncapo: 0\n---\n\n[G][D][Em][G7]\n너에게난 해질 | 녘노을 처럼\n\n[C][G][Am7][D]\n한편의 아름다운 | 추억이 되고\n\n[G][D][Em][G7]\n기나긴 이 하루도 | 저물어가면\n\n[C][D][G]\n행복했던 그 | 기억에 | 잠겨\n\n[G][D][Em][G7]\n붉게 물든 노을 | 바라보면서\n\n[C][G][Am7][D]\n왠지 모를 서러 | 움에 눈물 지네\n'
) on conflict (id) do nothing;

-- Rooms table (합주 모드)
create table if not exists rooms (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  song_id   text references songs(id),
  created_at timestamptz default now()
);

alter table rooms enable row level security;

create policy "Public read rooms"
  on rooms for select using (true);
create policy "Public insert rooms"
  on rooms for insert with check (true);

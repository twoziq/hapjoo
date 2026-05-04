-- 1) manager 역할 테이블
create table if not exists user_roles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  role    text not null check (role = 'manager')
);
alter table user_roles enable row level security;
create policy "read own role"      on user_roles for select using (auth.uid() = user_id);
create policy "admin manages roles" on user_roles for all   using (is_admin());

-- 2) is_manager(): admin 포함
create or replace function is_manager() returns boolean
  language sql stable security definer as $$
    select is_admin() or exists (
      select 1 from user_roles where user_id = auth.uid() and role = 'manager'
    );
  $$;

-- 3) songs insert: admin → manager 로 확대
drop policy if exists "Admin inserts songs" on songs;
create policy "Managers insert songs"
  on songs for insert with check (is_manager());

-- songs update: can_edit_song 내부도 manager 포함으로 교체
create or replace function can_edit_song(sid uuid) returns boolean
  language sql stable security definer as $$
    select is_manager() or exists (
      select 1 from collection_songs cs
        join collection_members cm on cm.collection_id = cs.collection_id
       where cs.song_id = sid and cm.user_id = auth.uid()
    );
  $$;

-- 4) chords 테이블
create table if not exists chords (
  name        text primary key,
  frets       text not null,
  fingers     text,
  difficulty  int  default 1,
  alternatives jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);
alter table chords enable row level security;
create policy "public read chords"   on chords for select using (true);
create policy "manager insert chord" on chords for insert with check (is_manager());
create policy "manager update chord" on chords for update using  (is_manager());
create policy "admin delete chord"   on chords for delete using  (is_admin());

-- 5) 기존 24개 코드 시드
insert into chords (name, frets, fingers, difficulty, alternatives) values
('G',     '320003', '210003', 1, '[{"frets":"320033"},{"frets":"355433"}]'),
('Em',    '022000', '023000', 1, '[{"frets":"x79987"}]'),
('G7',    '320001', '210001', 1, '[{"frets":"353433"}]'),
('C',     'x32010', '032010', 1, '[{"frets":"x3555x"}]'),
('Am7',   'x02010', '002010', 1, '[{"frets":"575555"}]'),
('D',     'xx0232', '000132', 1, '[{"frets":"x57775"}]'),
('Am',    'x02210', '002310', 1, '[{"frets":"577555"}]'),
('Bm',    'x24432', '013421', 2, '[{"frets":"x20232"}]'),
('Dm',    'xx0231', '000231', 1, '[{"frets":"x57765"}]'),
('E',     '022100', '023100', 1, '[{"frets":"x79997"}]'),
('A',     'x02220', '002220', 1, '[{"frets":"577655"}]'),
('F',     '133211', '134211', 2, '[{"frets":"xx3211"}]'),
('B7',    'x21202', '021303', 2, '[{"frets":"x24242"}]'),
('Dm7',   'xx0211', '000211', 1, '[{"frets":"x57565"}]'),
('Em7',   '022030', '023040', 1, '[{"frets":"x79787"}]'),
('D7',    'xx0212', '000213', 1, '[{"frets":"x57575"}]'),
('A7',    'x02020', '002030', 1, '[{"frets":"575655"}]'),
('E7',    '020100', '020100', 1, '[{"frets":"x79797"}]'),
('Cmaj7', 'x32000', '032000', 1, '[{"frets":"x3555x"}]'),
('Fmaj7', 'xx3210', '003210', 1, '[{"frets":"133210"}]'),
('Bm7',   'x20202', '020102', 2, '[{"frets":"x24232"}]'),
('Cadd9', 'x32030', '032040', 1, '[{"frets":"x35533"}]'),
('Dsus2', 'xx0230', '000230', 1, '[{"frets":"x57755"}]'),
('Gsus4', '320013', '210014', 1, '[{"frets":"335533"}]')
on conflict (name) do nothing;

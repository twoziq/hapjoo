-- ─────────────────────────────────────────────────────────────────────────────
-- Song change requests — 곡 추가/수정 요청 워크플로우
-- 관리자(kshh423@gmail.com)만 직접 카탈로그를 변경할 수 있고, 일반 사용자는
-- song_change_requests 테이블에 'create' 또는 'edit' 요청을 쌓는다.
-- 단, 어떤 곡이 본인이 멤버인 collection에 속한다면 그 곡의 편집은 직접 허용.
-- 0002_collections.sql의 is_member/is_owner 패턴과 동일.
-- ─────────────────────────────────────────────────────────────────────────────

-- helper: 관리자 여부 (auth.jwt() 의 email claim 비교)
create or replace function is_admin() returns boolean
  language sql stable security definer as $$
    select coalesce((auth.jwt() ->> 'email') = 'kshh423@gmail.com', false);
$$;

-- helper: 이 곡을 직접 편집할 권한이 있는가?
-- 관리자거나, 그 곡이 속한 collection 중 하나에 멤버이면 true
create or replace function can_edit_song(sid text) returns boolean
  language sql stable security definer as $$
    select is_admin() or exists (
      select 1 from collection_songs cs
        join collection_members cm on cm.collection_id = cs.collection_id
       where cs.song_id = sid and cm.user_id = auth.uid()
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- songs RLS 교체 — 카탈로그 직접 변경은 관리자/멤버 권한 기반
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "Authenticated insert songs" on songs;
drop policy if exists "Authenticated update songs" on songs;
drop policy if exists "Authenticated delete songs" on songs;
drop policy if exists "Editors update songs"      on songs;
drop policy if exists "Editors delete songs"      on songs;
drop policy if exists "Admin inserts songs"       on songs;
drop policy if exists "Admin deletes songs"       on songs;

create policy "Admin inserts songs"
  on songs for insert with check (is_admin());

create policy "Editors update songs"
  on songs for update using (can_edit_song(id));

create policy "Admin deletes songs"
  on songs for delete using (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- collection_songs DELETE 정책: 멤버 → owner 만 (현재 0002의 정책 변경)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "members delete collection songs" on collection_songs;
drop policy if exists "owner deletes collection songs"  on collection_songs;

create policy "owner deletes collection songs"
  on collection_songs for delete using (is_owner(collection_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 변경 요청 (추가 + 수정 통합)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists song_change_requests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('create', 'edit')),
  -- edit이면 기존 곡 id, create면 null (승인 시 새 uuid 자동 발급)
  song_id       uuid references songs(id) on delete cascade,
  requester_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  -- 적용 대상 메타 + content. songs.insert/update와 같은 모양
  title         text not null,
  artist        text default '',
  music_key     text default 'G',
  capo          integer default 0,
  bpm           integer default 80,
  content       text not null,
  reason        text,
  reject_reason text,
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint song_change_requests_kind_consistency check (
    (kind = 'create' and song_id is null) or
    (kind = 'edit'   and song_id is not null)
  )
);

create index if not exists song_change_requests_pending_idx
  on song_change_requests (created_at desc) where status = 'pending';
create index if not exists song_change_requests_requester_idx
  on song_change_requests (requester_id);

alter table song_change_requests enable row level security;

drop policy if exists "requester or admin reads" on song_change_requests;
drop policy if exists "self insert"              on song_change_requests;
drop policy if exists "admin updates"            on song_change_requests;
drop policy if exists "admin deletes"            on song_change_requests;

create policy "requester or admin reads"
  on song_change_requests for select
  using (requester_id = auth.uid() or is_admin());

create policy "self insert"
  on song_change_requests for insert
  with check (requester_id = auth.uid());

create policy "admin updates"
  on song_change_requests for update using (is_admin());

create policy "admin deletes"
  on song_change_requests for delete using (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 승인/거절 RPC
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function approve_song_change_request(req_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  applied_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from song_change_requests where id = req_id and status = 'pending';
  if r is null then raise exception 'not found or not pending'; end if;

  if r.kind = 'create' then
    insert into songs (title, artist, key, capo, bpm, content)
    values (r.title, r.artist, r.music_key, r.capo, r.bpm, r.content)
    returning id into applied_id;
  else
    update songs set
      title = r.title, artist = r.artist, key = r.music_key,
      capo = r.capo, bpm = r.bpm, content = r.content
     where id = r.song_id;
    applied_id := r.song_id;
  end if;

  update song_change_requests set
    status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = req_id;
  return applied_id;
end $$;

create or replace function reject_song_change_request(req_id uuid, reason text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update song_change_requests set
    status = 'rejected', reject_reason = reason,
    reviewed_at = now(), reviewed_by = auth.uid()
   where id = req_id and status = 'pending';
end $$;

revoke all on function approve_song_change_request(uuid)        from public;
revoke all on function reject_song_change_request(uuid, text)   from public;
grant execute on function approve_song_change_request(uuid)      to authenticated;
grant execute on function reject_song_change_request(uuid, text) to authenticated;

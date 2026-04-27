-- ─────────────────────────────────────────────────────────────────────────────
-- Collections (저장소) — Kakao-Map-favorites style. Each user gets a personal
-- "개인" collection on first login, and can create more (shared with invitees).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);

-- One personal collection per user.
create unique index if not exists collections_one_personal_per_owner
  on collections (owner_id) where is_personal = true;

create table if not exists collection_members (
  collection_id uuid not null references collections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create index if not exists collection_members_user_idx
  on collection_members (user_id);

create table if not exists collection_songs (
  collection_id uuid not null references collections(id) on delete cascade,
  song_id       text not null references songs(id) on delete cascade,
  added_by      uuid references auth.users(id) on delete set null,
  added_at      timestamptz not null default now(),
  primary key (collection_id, song_id)
);

create index if not exists collection_songs_collection_idx
  on collection_songs (collection_id);

create table if not exists collection_invites (
  code          text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  created_by    uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null default now() + interval '7 days',
  created_at    timestamptz not null default now()
);

create index if not exists collection_invites_collection_idx
  on collection_invites (collection_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table collections         enable row level security;
alter table collection_members  enable row level security;
alter table collection_songs    enable row level security;
alter table collection_invites  enable row level security;

-- Helper: is current user a member of this collection?
create or replace function is_member(cid uuid) returns boolean
  language sql stable security definer as $$
    select exists (
      select 1 from collection_members
       where collection_id = cid and user_id = auth.uid()
    );
$$;

-- Helper: is current user the owner of this collection?
create or replace function is_owner(cid uuid) returns boolean
  language sql stable security definer as $$
    select exists (
      select 1 from collection_members
       where collection_id = cid and user_id = auth.uid() and role = 'owner'
    );
$$;

-- collections
drop policy if exists "members can read collections"   on collections;
drop policy if exists "users can create collections"   on collections;
drop policy if exists "owners can update collections"  on collections;
drop policy if exists "owners can delete collections"  on collections;

create policy "members can read collections"
  on collections for select using (is_member(id));

create policy "users can create collections"
  on collections for insert
  with check (owner_id = auth.uid());

create policy "owners can update collections"
  on collections for update
  using (is_owner(id));

create policy "owners can delete collections"
  on collections for delete
  using (is_owner(id) and is_personal = false);

-- collection_members
drop policy if exists "members read members of shared collections" on collection_members;
drop policy if exists "self insert as member"    on collection_members;
drop policy if exists "self leave or owner kick" on collection_members;
drop policy if exists "owner updates roles"      on collection_members;

create policy "members read members of shared collections"
  on collection_members for select
  using (is_member(collection_id));

create policy "self insert as member"
  on collection_members for insert
  with check (user_id = auth.uid());

create policy "self leave or owner kick"
  on collection_members for delete
  using (user_id = auth.uid() or is_owner(collection_id));

create policy "owner updates roles"
  on collection_members for update
  using (is_owner(collection_id));

-- collection_songs
drop policy if exists "members read collection songs"   on collection_songs;
drop policy if exists "members insert collection songs" on collection_songs;
drop policy if exists "members delete collection songs" on collection_songs;

create policy "members read collection songs"
  on collection_songs for select using (is_member(collection_id));

create policy "members insert collection songs"
  on collection_songs for insert
  with check (is_member(collection_id) and added_by = auth.uid());

create policy "members delete collection songs"
  on collection_songs for delete
  using (is_member(collection_id));

-- collection_invites — owner-only to manage (members use RPC to redeem)
drop policy if exists "owner reads invites"   on collection_invites;
drop policy if exists "owner creates invites" on collection_invites;
drop policy if exists "owner deletes invites" on collection_invites;

create policy "owner reads invites"
  on collection_invites for select using (is_owner(collection_id));

create policy "owner creates invites"
  on collection_invites for insert
  with check (is_owner(collection_id) and created_by = auth.uid());

create policy "owner deletes invites"
  on collection_invites for delete
  using (is_owner(collection_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: 초대 코드로 가입
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function join_collection_via_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  select collection_id into cid
    from collection_invites
   where code = invite_code and expires_at > now();
  if cid is null then
    raise exception 'invalid or expired invite';
  end if;
  insert into collection_members (collection_id, user_id, role)
  values (cid, auth.uid(), 'member')
  on conflict (collection_id, user_id) do nothing;
  return cid;
end;
$$;

revoke all on function join_collection_via_invite(text) from public;
grant execute on function join_collection_via_invite(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: 신규 사용자 생성 시 "개인" 저장소 자동 생성
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_personal_collection_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  insert into collections (name, owner_id, is_personal)
  values ('개인', new.id, true)
  on conflict do nothing
  returning id into cid;
  if cid is not null then
    insert into collection_members (collection_id, user_id, role)
    values (cid, new.id, 'owner')
    on conflict (collection_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_personal_collection_for_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: 기존 사용자도 "개인" 저장소 보장
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare u record;
        cid uuid;
begin
  for u in select id from auth.users loop
    if not exists (
      select 1 from collections where owner_id = u.id and is_personal = true
    ) then
      insert into collections (name, owner_id, is_personal)
      values ('개인', u.id, true)
      returning id into cid;
      insert into collection_members (collection_id, user_id, role)
      values (cid, u.id, 'owner')
      on conflict (collection_id, user_id) do nothing;
    end if;
  end loop;
end $$;

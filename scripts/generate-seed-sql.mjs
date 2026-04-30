// 일회성 generator: data/songs/ 아래 모든 .txt를 읽어
// supabase/migrations/0004_unify_uuid_and_reseed.sql 생성.
//
// 기존 text 기반 id를 uuid로 통일한다.
//  - songs.id 및 모든 FK 참조 컬럼을 text → uuid로 ALTER
//  - song_change_requests.proposed_id 컬럼 제거 (uuid는 INSERT 시 자동 생성됨)
//  - approve_song_change_request RPC 갱신: returning id로 새 uuid 캡쳐
//  - songs 테이블 truncate cascade 후 65곡 reseed
//
// 같은 곡이 두 .txt 파일에 들어있는 경우 SKIP_PATHS에 명시.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SONGS_DIR = path.join(ROOT, 'data', 'songs');
const OUT = path.join(ROOT, 'supabase', 'migrations', '0004_unify_uuid_and_reseed.sql');

const SKIP_PATHS = new Set(['output/너에게 난 나에게 넌.txt']);

function parseMeta(content) {
  const get = (field) => content.match(new RegExp(`\\{${field}:\\s*(.+?)\\}`))?.[1]?.trim() ?? '';
  return {
    title: get('title'),
    artist: get('artist'),
    key: get('key') || 'G',
    capo: Number(get('capo') || 0),
    bpm: Number(get('bpm') || 80),
  };
}

function escapeIdent(s) {
  return s.replace(/'/g, "''");
}

function dollarQuote(s) {
  let tag = 'song';
  while (s.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${s}$${tag}$`;
}

const rows = [];
const seenIds = new Set();

function pushRow(srcId, folder, filePath) {
  if (seenIds.has(srcId)) {
    console.error(`  ⚠ 같은 파일명 중복 — ${srcId} (${filePath} 무시)`);
    return;
  }
  seenIds.add(srcId);
  const content = fs.readFileSync(filePath, 'utf8');
  const meta = parseMeta(content);
  rows.push({ srcId, folder, content, ...meta });
}

const topEntries = fs.readdirSync(SONGS_DIR, { withFileTypes: true });
for (const e of topEntries) {
  if (!e.isDirectory() && e.name.endsWith('.txt')) {
    const id = e.name.replace(/\.txt$/, '');
    pushRow(id, null, path.join(SONGS_DIR, e.name));
  }
}
for (const e of topEntries) {
  if (e.isDirectory()) {
    const subDir = path.join(SONGS_DIR, e.name);
    const subs = fs.readdirSync(subDir);
    for (const name of subs) {
      if (!name.endsWith('.txt')) continue;
      const rel = `${e.name}/${name}`;
      if (SKIP_PATHS.has(rel)) {
        console.error(`  ⊘ 명시적 skip — ${rel}`);
        continue;
      }
      const id = name.replace(/\.txt$/, '');
      pushRow(id, e.name, path.join(subDir, name));
    }
  }
}

const sql = [];
sql.push('-- 자동 생성: scripts/generate-seed-sql.mjs');
sql.push('-- songs.id를 uuid로 통일 + 65곡 reseed.');
sql.push('-- 실행: Supabase Dashboard SQL Editor에서 통째 붙여넣기.');
sql.push('-- 0001(schema) ~ 0003(song_change_requests) 적용된 DB가 전제.');
sql.push('');
sql.push('begin;');
sql.push('');
sql.push('-- 1) 기존 songs 데이터 + cascade로 의존 테이블(user_songs/collection_songs/rooms/song_change_requests) 비우기');
sql.push('truncate table songs cascade;');
sql.push('');
sql.push('-- 2) songs.id를 참조하는 의존성(policy, function, FK) 모두 떼기');
sql.push('--    PostgreSQL: 컬럼 타입 변경 시 그 컬럼을 참조하는 policy/FK가 있으면 ERROR 0A000.');
sql.push('drop policy if exists "Editors update songs" on songs;');
sql.push('drop function if exists can_edit_song(text);');
sql.push('alter table user_songs           drop constraint if exists user_songs_song_id_fkey;');
sql.push('alter table collection_songs     drop constraint if exists collection_songs_song_id_fkey;');
sql.push('alter table rooms                drop constraint if exists rooms_song_id_fkey;');
sql.push('alter table song_change_requests drop constraint if exists song_change_requests_song_id_fkey;');
sql.push('');
sql.push('-- 3) 모든 관련 컬럼 text → uuid (테이블 비어있어 cast 트리거 없음)');
sql.push('alter table songs alter column id drop default;');
sql.push('alter table songs alter column id type uuid using id::uuid;');
sql.push('alter table songs alter column id set default gen_random_uuid();');
sql.push('alter table user_songs           alter column song_id type uuid using song_id::uuid;');
sql.push('alter table collection_songs     alter column song_id type uuid using song_id::uuid;');
sql.push('alter table rooms                alter column song_id type uuid using song_id::uuid;');
sql.push('alter table song_change_requests alter column song_id type uuid using song_id::uuid;');
sql.push('');
sql.push('-- 4) function/policy/FK 재생성 (signature는 uuid 기반으로)');
sql.push('create or replace function can_edit_song(sid uuid) returns boolean');
sql.push('  language sql stable security definer as $$');
sql.push('    select is_admin() or exists (');
sql.push('      select 1 from collection_songs cs');
sql.push('        join collection_members cm on cm.collection_id = cs.collection_id');
sql.push('       where cs.song_id = sid and cm.user_id = auth.uid()');
sql.push('    );');
sql.push('$$;');
sql.push('');
sql.push('create policy "Editors update songs" on songs for update using (can_edit_song(id));');
sql.push('');
sql.push('alter table user_songs add constraint user_songs_song_id_fkey');
sql.push('  foreign key (song_id) references songs(id) on delete cascade;');
sql.push('alter table collection_songs add constraint collection_songs_song_id_fkey');
sql.push('  foreign key (song_id) references songs(id) on delete cascade;');
sql.push('alter table rooms add constraint rooms_song_id_fkey');
sql.push('  foreign key (song_id) references songs(id);');
sql.push('alter table song_change_requests add constraint song_change_requests_song_id_fkey');
sql.push('  foreign key (song_id) references songs(id) on delete cascade;');
sql.push('');
sql.push('-- 4) song_change_requests: proposed_id 제거 + 일관성 제약 갱신');
sql.push('alter table song_change_requests drop constraint if exists song_change_requests_kind_consistency;');
sql.push('alter table song_change_requests drop column if exists proposed_id;');
sql.push('alter table song_change_requests add constraint song_change_requests_kind_consistency check (');
sql.push("  (kind = 'create' and song_id is null) or");
sql.push("  (kind = 'edit'   and song_id is not null)");
sql.push(');');
sql.push('');
sql.push('-- 5) approve RPC 재정의: create 시 RETURNING으로 새 uuid 받기');
sql.push('-- (CREATE OR REPLACE는 return type 변경 불가 → DROP 먼저)');
sql.push('drop function if exists approve_song_change_request(uuid);');
sql.push('create function approve_song_change_request(req_id uuid) returns uuid');
sql.push('  language plpgsql security definer set search_path = public as $$');
sql.push('declare');
sql.push('  r record;');
sql.push('  applied_id uuid;');
sql.push('begin');
sql.push("  if not is_admin() then raise exception 'forbidden'; end if;");
sql.push("  select * into r from song_change_requests where id = req_id and status = 'pending';");
sql.push("  if r is null then raise exception 'not found or not pending'; end if;");
sql.push('');
sql.push("  if r.kind = 'create' then");
sql.push('    insert into songs (title, artist, key, capo, bpm, content)');
sql.push('    values (r.title, r.artist, r.music_key, r.capo, r.bpm, r.content)');
sql.push('    returning id into applied_id;');
sql.push('  else');
sql.push('    update songs set');
sql.push('      title = r.title, artist = r.artist, key = r.music_key,');
sql.push('      capo = r.capo, bpm = r.bpm, content = r.content');
sql.push('     where id = r.song_id;');
sql.push('    applied_id := r.song_id;');
sql.push('  end if;');
sql.push('');
sql.push('  update song_change_requests set');
sql.push("    status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()");
sql.push('   where id = req_id;');
sql.push('  return applied_id;');
sql.push('end $$;');
sql.push('revoke all on function approve_song_change_request(uuid) from public;');
sql.push('grant execute on function approve_song_change_request(uuid) to authenticated;');
sql.push('');
sql.push('-- 6) 65곡 seed (id는 DB가 gen_random_uuid()로 자동 발급)');
for (const r of rows) {
  const folder = r.folder === null ? 'null' : `'${escapeIdent(r.folder)}'`;
  sql.push('insert into songs (title, artist, key, capo, bpm, folder, content) values (');
  sql.push(`  '${escapeIdent(r.title)}',`);
  sql.push(`  '${escapeIdent(r.artist)}',`);
  sql.push(`  '${escapeIdent(r.key)}',`);
  sql.push(`  ${r.capo},`);
  sql.push(`  ${r.bpm},`);
  sql.push(`  ${folder},`);
  sql.push(`  ${dollarQuote(r.content)}`);
  sql.push(');');
  sql.push('');
}
sql.push('commit;');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, sql.join('\n'));
console.log(`✓ ${rows.length}개 곡으로 ${path.relative(ROOT, OUT)} 생성`);
for (const r of rows) console.log(`  - [${r.folder ?? '(root)'}] ${r.title} / ${r.artist}`);

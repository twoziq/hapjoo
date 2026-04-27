import { NextRequest } from 'next/server';
import { scanSeedSongs, readSeedSongContent } from '@/scripts/seed-songs';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

// Seed migration endpoint — guarded by MIGRATE_SECRET.
// Use header `x-migrate-secret: <secret>` to invoke.
export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return Response.json(
      { error: 'MIGRATE_SECRET이 서버에 설정되지 않았습니다.' },
      { status: 503 },
    );
  }
  if (req.headers.get('x-migrate-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!supabaseConfigured) {
    return Response.json({ error: 'Supabase가 설정되지 않았습니다.' }, { status: 503 });
  }

  const sb = getSupabase();
  const songs = scanSeedSongs();
  const results: { id: string; status: string }[] = [];

  for (const song of songs) {
    const content = readSeedSongContent(song.id);
    if (!content) {
      results.push({ id: song.id, status: 'content 없음 (skip)' });
      continue;
    }

    const { error } = await sb.from('songs').upsert(
      {
        id: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        capo: 0,
        bpm: 80,
        folder: song.folder ?? null,
        content,
      },
      { onConflict: 'id' },
    );

    results.push({ id: song.id, status: error ? `실패: ${error.message}` : '완료' });
  }

  const ok = results.filter((r) => r.status === '완료').length;
  const fail = results.filter((r) => r.status.startsWith('실패')).length;
  return Response.json({ summary: `${ok}개 완료, ${fail}개 실패`, results });
}

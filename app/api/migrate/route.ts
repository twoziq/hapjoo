import { scanSongs, getSongContent } from '@/lib/songLoader';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) {
    return Response.json({ error: 'Supabase가 설정되지 않았습니다. .env.local을 확인해주세요.' }, { status: 503 });
  }

  const songs = scanSongs();
  const results: { id: string; status: string }[] = [];

  for (const song of songs) {
    const content = getSongContent(song.id);
    if (!content) { results.push({ id: song.id, status: 'content 없음 (skip)' }); continue; }

    const { error } = await supabase.from('songs').upsert({
      id:      song.id,
      title:   song.title,
      artist:  song.artist,
      key:     song.key,
      capo:    0,
      bpm:     80,
      folder:  song.folder ?? null,
      content,
    }, { onConflict: 'id' });

    results.push({ id: song.id, status: error ? `실패: ${error.message}` : '완료' });
  }

  const ok    = results.filter(r => r.status === '완료').length;
  const fail  = results.filter(r => r.status.startsWith('실패')).length;
  return Response.json({ summary: `${ok}개 완료, ${fail}개 실패`, results });
}

import type { DbSong } from '@/types/song';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export type SongRow = Pick<DbSong, 'id' | 'title' | 'artist' | 'key' | 'capo' | 'bpm' | 'folder'>;

export async function getSongs(): Promise<SongRow[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('id, title, artist, key, capo, bpm, folder')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getSongs: ${error.message}`);
  return (data ?? []) as SongRow[];
}

export async function getSongContent(id: string): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('songs').select('content').eq('id', id).single();
  if (error) return null;
  return data?.content ?? null;
}

export async function insertSong(song: Omit<DbSong, 'created_at'>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('songs').insert(song);
  if (error) throw new Error(error.message);
}

export async function updateSong(
  id: string,
  patch: Partial<Omit<DbSong, 'id' | 'created_at'>>,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('songs').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSong(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('songs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

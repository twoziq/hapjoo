import { unstable_cache } from 'next/cache';
import type { DbSong } from '@/types/song';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export type SongRow = Pick<DbSong, 'id' | 'title' | 'artist' | 'key' | 'capo' | 'bpm'>;

export const SONGS_TAG = 'songs';
export const SONGS_PAGE_SIZE = 50;

export interface SongsPage {
  rows: SongRow[];
  hasMore: boolean;
}

export async function fetchSongsPage(offset: number, limit: number): Promise<SongsPage> {
  if (!supabaseConfigured) return { rows: [], hasMore: false };
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('id, title, artist, key, capo, bpm')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(`fetchSongsPage: ${error.message}`);
  const all = (data ?? []) as SongRow[];
  return { rows: all.slice(0, limit), hasMore: all.length > limit };
}

export const getSongsPageCached = unstable_cache(fetchSongsPage, ['songs-page'], {
  tags: [SONGS_TAG],
  revalidate: 60,
});

export async function searchSongsPage(
  query: string,
  offset: number,
  limit: number,
): Promise<SongsPage> {
  if (!supabaseConfigured) return { rows: [], hasMore: false };
  const sanitized = query.trim().replace(/[%_,()*]/g, '');
  if (!sanitized) return { rows: [], hasMore: false };
  const sb = getSupabase();
  const pat = `%${sanitized}%`;
  const { data, error } = await sb
    .from('songs')
    .select('id, title, artist, key, capo, bpm')
    .or(`title.ilike.${pat},artist.ilike.${pat}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(`searchSongsPage: ${error.message}`);
  const all = (data ?? []) as SongRow[];
  return { rows: all.slice(0, limit), hasMore: all.length > limit };
}

async function fetchSongContent(id: string): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('songs').select('content').eq('id', id).single();
  if (error) return null;
  return data?.content ?? null;
}

export const getSongContent = unstable_cache(fetchSongContent, ['song-content'], {
  tags: [SONGS_TAG],
  revalidate: 300,
});

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  bpm: number;
  content: string;
}

export async function fetchSongMeta(id: string): Promise<SongMeta | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('songs')
    .select('id, title, artist, key, capo, bpm, content')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as SongMeta;
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

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const configured =
  !!url && url !== 'https://your-project.supabase.co' && !!key && key !== 'your-anon-key';

export const supabase = configured ? createClient(url!, key!) : null;

// ── Song types ────────────────────────────────────────────────────────────────
export interface DbSong {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  bpm: number;
  folder?: string | null;
  content: string;
  created_at?: string;
}

// ── Songs CRUD ────────────────────────────────────────────────────────────────
export async function dbGetSongs(): Promise<DbSong[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist, key, capo, bpm, folder')
    .order('created_at', { ascending: true });
  if (error) { console.error('dbGetSongs:', error.message); return null; }
  return data as DbSong[];
}

export async function dbGetSongContent(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('songs')
    .select('content')
    .eq('id', id)
    .single();
  if (error) return null;
  return data?.content ?? null;
}

export async function dbInsertSong(song: Omit<DbSong, 'created_at'>): Promise<string | null> {
  if (!supabase) return '환경변수 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY를 설정해주세요.';
  const { error } = await supabase.from('songs').insert(song);
  return error?.message ?? null;
}

export async function dbUpdateSong(id: string, patch: Partial<Omit<DbSong, 'id' | 'created_at'>>): Promise<string | null> {
  if (!supabase) return 'Supabase not configured';
  const { error } = await supabase.from('songs').update(patch).eq('id', id);
  return error?.message ?? null;
}

export async function dbDeleteSong(id: string): Promise<string | null> {
  if (!supabase) return 'Supabase not configured';
  const { error } = await supabase.from('songs').delete().eq('id', id);
  return error?.message ?? null;
}

export const supabaseConfigured = configured;

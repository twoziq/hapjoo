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

export async function dbGetSongNotes(songId: string): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('songs').select('notes').eq('id', songId).single();
    if (error) return null;
    return (data?.notes as Record<string, string>) ?? null;
  } catch { return null; }
}

export async function dbSaveSongNotes(songId: string, notes: Record<string, string>): Promise<void> {
  if (!supabase) return;
  try { await supabase.from('songs').update({ notes }).eq('id', songId); } catch {}
}

export async function dbDeleteSong(id: string): Promise<string | null> {
  if (!supabase) return 'Supabase not configured';
  const { error } = await supabase.from('songs').delete().eq('id', id);
  return error?.message ?? null;
}

export const supabaseConfigured = configured;

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
  });
}

export async function signInWithKakao() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (session: any) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

// ── User songs (personal tunings) ────────────────────────────────────────────
export interface UserSong {
  id?: string;
  user_id?: string;
  song_id: string;
  semitones: number;
  notes: Record<string, string>;
  content?: string | null;
}

export async function getUserSong(songId: string): Promise<UserSong | null> {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('user_songs')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('song_id', songId)
    .single();
  return data as UserSong | null;
}

export async function upsertUserSong(songId: string, patch: Partial<UserSong>): Promise<string | null> {
  if (!supabase) return 'Supabase not configured';
  const session = await getSession();
  if (!session) return '로그인이 필요합니다.';
  const { error } = await supabase
    .from('user_songs')
    .upsert({ ...patch, user_id: session.user.id, song_id: songId }, { onConflict: 'user_id,song_id' });
  return error?.message ?? null;
}

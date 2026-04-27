import type { UserSong } from '@/types/song';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';
import { getSession } from '@/lib/auth';

export async function getUserSong(songId: string): Promise<UserSong | null> {
  if (!supabaseConfigured) return null;
  const session = await getSession();
  if (!session) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from('user_songs')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('song_id', songId)
    .single();
  return (data as UserSong | null) ?? null;
}

export async function upsertUserSong(songId: string, patch: Partial<UserSong>): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  const sb = getSupabase();
  const { error } = await sb
    .from('user_songs')
    .upsert(
      { ...patch, user_id: session.user.id, song_id: songId },
      { onConflict: 'user_id,song_id' },
    );
  if (error) throw new Error(error.message);
}

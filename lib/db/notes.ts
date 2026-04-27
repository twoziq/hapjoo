import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export async function getSongNotes(songId: string): Promise<Record<string, string> | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('songs').select('notes').eq('id', songId).single();
  if (error || !data) return null;
  return (data.notes as Record<string, string>) ?? null;
}

export async function saveSongNotes(songId: string, notes: Record<string, string>): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase();
  await sb.from('songs').update({ notes }).eq('id', songId);
}

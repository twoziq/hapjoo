import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';
import type { SongReport } from '@/types/songReport';

export async function insertSongReport(args: {
  songId: string;
  reporterId: string;
  title: string;
  reason: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('song_reports').insert({
    song_id: args.songId,
    reporter_id: args.reporterId,
    title: args.title,
    reason: args.reason,
  });
  if (error) throw new Error(error.message);
}

export async function listPendingSongReports(): Promise<SongReport[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('song_reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SongReport[];
}

export async function resolveSongReport(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('song_reports').update({ status: 'resolved' }).eq('id', id);
  if (error) throw new Error(error.message);
}

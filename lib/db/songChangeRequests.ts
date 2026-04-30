import type {
  ChangeRequestKind,
  SongChangeRequest,
  SongChangeRequestPatch,
} from '@/types/songChangeRequest';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

interface InsertArgs {
  kind: ChangeRequestKind;
  songId?: string | null;
  proposedId?: string | null;
  requesterId: string;
  patch: SongChangeRequestPatch;
  reason?: string | null;
}

export async function insertChangeRequest(args: InsertArgs): Promise<SongChangeRequest> {
  const sb = getSupabase();
  const row = {
    kind: args.kind,
    song_id: args.songId ?? null,
    proposed_id: args.proposedId ?? null,
    requester_id: args.requesterId,
    title: args.patch.title,
    artist: args.patch.artist,
    music_key: args.patch.music_key,
    capo: args.patch.capo,
    bpm: args.patch.bpm,
    content: args.patch.content,
    reason: args.reason ?? null,
  };
  const { data, error } = await sb
    .from('song_change_requests')
    .insert(row)
    .select(
      'id, kind, song_id, proposed_id, requester_id, status, title, artist, music_key, capo, bpm, content, reason, reject_reason, reviewed_at, reviewed_by, created_at',
    )
    .single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  return data as SongChangeRequest;
}

const SELECT_COLS =
  'id, kind, song_id, proposed_id, requester_id, status, title, artist, music_key, capo, bpm, content, reason, reject_reason, reviewed_at, reviewed_by, created_at';

export async function listPendingRequests(): Promise<SongChangeRequest[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('song_change_requests')
    .select(SELECT_COLS)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPendingRequests: ${error.message}`);
  return (data ?? []) as SongChangeRequest[];
}

export async function listMyRequests(requesterId: string): Promise<SongChangeRequest[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('song_change_requests')
    .select(SELECT_COLS)
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`listMyRequests: ${error.message}`);
  return (data ?? []) as SongChangeRequest[];
}

export async function approveRequest(id: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('approve_song_change_request', { req_id: id });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}

export async function rejectRequest(id: string, reason: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc('reject_song_change_request', { req_id: id, reason });
  if (error) throw new Error(error.message);
}

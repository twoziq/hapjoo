import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';

export interface Room {
  id: string;
  code: string;
  song_id: string;
  semitones: number;
  play_idx: number;
  is_playing: boolean;
  created_at?: string;
}

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export async function createRoom(songId: string): Promise<Room> {
  const sb = getSupabase();
  const code = generateRoomCode();
  const { data, error } = await sb
    .from('rooms')
    .insert({ code, song_id: songId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function joinRoom(code: string): Promise<Room> {
  const sb = getSupabase();
  const { data, error } = await sb.from('rooms').select('*').eq('code', code).single();
  if (error) throw new Error(error.message);
  return data as Room;
}

export function subscribeToRoom(
  roomId: string,
  onUpdate: (payload: unknown) => void,
): RealtimeChannel {
  const sb = getSupabase();
  return sb
    .channel(`room:${roomId}`)
    .on('broadcast', { event: 'pointer' }, ({ payload }) => onUpdate(payload))
    .subscribe();
}

export async function broadcastPointer(channel: RealtimeChannel, position: unknown): Promise<void> {
  await channel.send({ type: 'broadcast', event: 'pointer', payload: position });
}

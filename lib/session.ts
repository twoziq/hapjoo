// Ensemble session — Supabase Realtime
import { supabase } from './supabase';

export async function createRoom(songId: string) {
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, song_id: songId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinRoom(code: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToRoom(roomId: string, onUpdate: (payload: unknown) => void) {
  return supabase
    .channel(`room:${roomId}`)
    .on('broadcast', { event: 'pointer' }, ({ payload }) => onUpdate(payload))
    .subscribe();
}

export async function broadcastPointer(
  channel: ReturnType<typeof supabase.channel>,
  position: unknown
) {
  await channel.send({ type: 'broadcast', event: 'pointer', payload: position });
}

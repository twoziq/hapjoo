'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export interface RoomPlayPayload {
  playIdx: number;
  bpm: number;
  timeSig: string;
}

interface Options {
  songId: string;
  enabled: boolean;
  onRemotePlay: (p: RoomPlayPayload) => void;
  onRemoteStop: () => void;
}

export function useRoomSync({ songId, enabled, onRemotePlay, onRemoteStop }: Options) {
  const onPlayRef = useRef(onRemotePlay);
  onPlayRef.current = onRemotePlay;
  const onStopRef = useRef(onRemoteStop);
  onStopRef.current = onRemoteStop;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !supabaseConfigured) {
      channelRef.current = null;
      return;
    }

    const sb = getSupabase();
    const channel = sb.channel(`room:song:${songId}`);

    channel
      .on('broadcast', { event: 'play' }, ({ payload }) => {
        onPlayRef.current(payload as RoomPlayPayload);
      })
      .on('broadcast', { event: 'stop' }, () => {
        onStopRef.current();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [songId, enabled]);

  const broadcastPlay = useCallback((p: RoomPlayPayload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'play', payload: p });
  }, []);

  const broadcastStop = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'stop', payload: {} });
  }, []);

  return { broadcastPlay, broadcastStop };
}

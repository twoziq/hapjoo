'use client';

/**
 * 합주 모드 (Room Sync)
 *
 * 채널: room:collection:{collectionId}:song:{songId}  — Supabase Realtime Broadcast
 * 진입: 저장소 상세 → 곡 링크에 ?room={collectionId} 포함 시 자동 활성화
 * 이벤트:
 *   play  { playIdx, bpm, timeSig }  — 마지막 발신자가 모두를 override
 *   stop  {}                         — 정지
 * DB 저장 없음, 휘발성 broadcast만 사용.
 */

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
  roomId: string | undefined;
  onRemotePlay: (p: RoomPlayPayload) => void;
  onRemoteStop: () => void;
}

export function useRoomSync({ songId, roomId, onRemotePlay, onRemoteStop }: Options) {
  const onPlayRef = useRef(onRemotePlay);
  onPlayRef.current = onRemotePlay;
  const onStopRef = useRef(onRemoteStop);
  onStopRef.current = onRemoteStop;

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !supabaseConfigured) {
      channelRef.current = null;
      return;
    }

    const sb = getSupabase();
    const channel = sb.channel(`room:collection:${roomId}:song:${songId}`);

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
  }, [songId, roomId]);

  const broadcastPlay = useCallback((p: RoomPlayPayload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'play', payload: p });
  }, []);

  const broadcastStop = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'stop', payload: {} });
  }, []);

  return { broadcastPlay, broadcastStop };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { safeGetInt, safeSetItem } from '@/lib/storage';
import { getUserSong, upsertUserSong } from '@/lib/db/userSongs';
import { useSession } from '@/lib/hooks/useSession';

export function useSemitones(songId: string) {
  const storageKey = STORAGE_KEYS.semitones(songId);
  const { session, isAuthenticated } = useSession();
  const [semitones, setSemitones] = useState<number>(() => safeGetInt(storageKey, 0));
  const hydrated = useRef(false);

  // Hydrate from user_songs on login.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getUserSong(songId)
      .then((row) => {
        if (cancelled || row == null) return;
        if (typeof row.semitones === 'number') {
          setSemitones(row.semitones);
          safeSetItem(storageKey, String(row.semitones));
        }
        hydrated.current = true;
      })
      .catch(() => {
        hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [songId, storageKey, isAuthenticated, session?.user.id]);

  // Persist locally + remotely when changed.
  useEffect(() => {
    safeSetItem(storageKey, String(semitones));
    if (isAuthenticated && hydrated.current) {
      void upsertUserSong(songId, { semitones }).catch(() => {
        // best-effort sync
      });
    }
  }, [semitones, storageKey, songId, isAuthenticated]);

  return [semitones, setSemitones] as const;
}

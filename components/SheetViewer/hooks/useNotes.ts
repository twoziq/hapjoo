'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { safeGetJSON, safeSetJSON } from '@/lib/storage';
import { getUserSong, upsertUserSong } from '@/lib/db/userSongs';
import { useSession } from '@/lib/hooks/useSession';

export function useNotes(songId: string) {
  const storageKey = STORAGE_KEYS.notes(songId);
  const { session, isAuthenticated } = useSession();
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    safeGetJSON<Record<string, string>>(storageKey, {}),
  );

  // Hydrate from user_songs once we know the user is signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getUserSong(songId)
      .then((row) => {
        if (cancelled || !row?.notes) return;
        setNotes(row.notes);
        safeSetJSON(storageKey, row.notes);
      })
      .catch(() => {
        // ignore — fall back to localStorage cache
      });
    return () => {
      cancelled = true;
    };
  }, [songId, storageKey, isAuthenticated, session?.user.id]);

  function persistNotes(next: Record<string, string>) {
    setNotes(next);
    safeSetJSON(storageKey, next);
    if (isAuthenticated) {
      void upsertUserSong(songId, { notes: next }).catch(() => {
        // best-effort sync; local copy already stored
      });
    }
  }

  function saveNote(key: string, text: string) {
    const next = { ...notes };
    if (text.trim()) next[key] = text.trim();
    else delete next[key];
    persistNotes(next);
  }

  return { notes, saveNote };
}

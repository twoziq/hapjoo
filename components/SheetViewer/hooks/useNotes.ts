'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { safeGetJSON, safeSetJSON } from '@/lib/storage';
import { getSongNotes } from '@/lib/db/notes';
import { saveNotesAction } from '@/app/(tabs)/viewer/[id]/actions';

export function useNotes(songId: string) {
  const storageKey = STORAGE_KEYS.notes(songId);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    safeGetJSON<Record<string, string>>(storageKey, {}),
  );

  useEffect(() => {
    let cancelled = false;
    getSongNotes(songId)
      .then((shared) => {
        if (cancelled) return;
        if (shared && Object.keys(shared).length > 0) {
          setNotes(shared);
          safeSetJSON(storageKey, shared);
        }
      })
      .catch(() => {
        // ignore — local notes still usable
      });
    return () => {
      cancelled = true;
    };
  }, [songId, storageKey]);

  function persistNotes(next: Record<string, string>) {
    setNotes(next);
    safeSetJSON(storageKey, next);
    void saveNotesAction(songId, next);
  }

  function saveNote(key: string, text: string) {
    const next = { ...notes };
    if (text.trim()) next[key] = text.trim();
    else delete next[key];
    persistNotes(next);
  }

  return { notes, saveNote };
}

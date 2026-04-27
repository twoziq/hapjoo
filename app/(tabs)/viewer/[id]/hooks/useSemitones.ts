'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { safeGetInt, safeSetItem } from '@/lib/storage';

export function useSemitones(songId: string) {
  const storageKey = STORAGE_KEYS.semitones(songId);
  const [semitones, setSemitones] = useState<number>(() => safeGetInt(storageKey, 0));

  useEffect(() => {
    safeSetItem(storageKey, String(semitones));
  }, [semitones, storageKey]);

  return [semitones, setSemitones] as const;
}

'use server';

import { saveSongNotes } from '@/lib/db/notes';

export async function saveNotesAction(
  songId: string,
  notes: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveSongNotes(songId, notes);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '메모 저장 실패' };
  }
}

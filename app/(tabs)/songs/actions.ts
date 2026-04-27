'use server';

import { revalidatePath } from 'next/cache';
import type { DbSong } from '@/types/song';
import { insertSong, updateSong, deleteSong } from '@/lib/db/songs';

export type SongInput = Omit<DbSong, 'created_at'>;

export async function createSongAction(
  song: SongInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await insertSong(song);
    revalidatePath('/songs');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function updateSongAction(
  id: string,
  patch: Partial<Omit<DbSong, 'id' | 'created_at'>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateSong(id, patch);
    revalidatePath('/songs');
    revalidatePath(`/viewer/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function deleteSongAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteSong(id);
    revalidatePath('/songs');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
}

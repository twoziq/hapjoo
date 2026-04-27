'use server';

import { revalidatePath } from 'next/cache';
import type { DbSong } from '@/types/song';
import { getSession } from '@/lib/auth';
import { deleteSong, insertSong, updateSong } from '@/lib/db/songs';

export type SongInput = Omit<DbSong, 'created_at'>;
type ActionResult = { ok: true } | { ok: false; error: string };

async function requireSession(): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: '로그인이 필요합니다.' };
  return null;
}

export async function createSongAction(song: SongInput): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
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
): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    await updateSong(id, patch);
    revalidatePath('/songs');
    revalidatePath(`/viewer/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function deleteSongAction(id: string): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    await deleteSong(id);
    revalidatePath('/songs');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
}

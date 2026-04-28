import type { DbSong } from '@/types/song';
import { getSupabase } from '@/lib/supabase/client';
import { deleteSong, insertSong, updateSong } from '@/lib/db/songs';
import { revalidateSongDetail, revalidateSongsList } from './revalidate';

export type SongInput = Omit<DbSong, 'created_at'>;
type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser(): Promise<ActionResult | null> {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: '로그인이 필요합니다.' };
  return null;
}

export async function createSongAction(song: SongInput): Promise<ActionResult> {
  const denied = await requireUser();
  if (denied) return denied;
  try {
    await insertSong(song);
    await revalidateSongsList();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function updateSongAction(
  id: string,
  patch: Partial<Omit<DbSong, 'id' | 'created_at'>>,
): Promise<ActionResult> {
  const denied = await requireUser();
  if (denied) return denied;
  try {
    await updateSong(id, patch);
    await revalidateSongDetail(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function deleteSongAction(id: string): Promise<ActionResult> {
  const denied = await requireUser();
  if (denied) return denied;
  try {
    await deleteSong(id);
    await revalidateSongsList();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
}

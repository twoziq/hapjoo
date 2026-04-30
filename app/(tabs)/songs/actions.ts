import type { DbSong } from '@/types/song';
import type { SongChangeRequestPatch } from '@/types/songChangeRequest';
import { getSupabase } from '@/lib/supabase/client';
import { deleteSong, insertSong, updateSong } from '@/lib/db/songs';
import {
  approveRequest,
  insertChangeRequest,
  rejectRequest,
} from '@/lib/db/songChangeRequests';
import { revalidateSongDetail, revalidateSongsList } from './revalidate';

export type SongInput = Omit<DbSong, 'created_at'>;
type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: '로그인이 필요합니다.' };
  return { ok: true, userId: data.user.id };
}

export async function createSongAction(song: SongInput): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
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
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    await updateSong(id, patch);
    await revalidateSongDetail(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function deleteSongAction(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    await deleteSong(id);
    await revalidateSongsList();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
}

// ─── 변경 요청 워크플로우 ─────────────────────────────────────────────────────

export async function requestSongCreateAction(
  patch: SongChangeRequestPatch,
  reason?: string,
): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    await insertChangeRequest({
      kind: 'create',
      requesterId: auth.userId,
      patch,
      reason: reason ?? null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '요청 실패' };
  }
}

export async function requestSongEditAction(
  songId: string,
  patch: SongChangeRequestPatch,
  reason?: string,
): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    await insertChangeRequest({
      kind: 'edit',
      songId,
      requesterId: auth.userId,
      patch,
      reason: reason ?? null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '요청 실패' };
  }
}

export async function approveChangeRequestAction(
  requestId: string,
): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    const appliedId = await approveRequest(requestId);
    await revalidateSongsList();
    if (appliedId) await revalidateSongDetail(appliedId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '승인 실패' };
  }
}

export async function rejectChangeRequestAction(
  requestId: string,
  reason: string,
): Promise<ActionResult> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  try {
    await rejectRequest(requestId, reason);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '거절 실패' };
  }
}

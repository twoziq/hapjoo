import { getSupabase } from '@/lib/supabase/client';
import {
  createCollection,
  deleteCollection,
  renameCollection,
  removeSongFromCollections,
  addSongsToCollections,
} from '@/lib/db/collections';
import { leaveCollection, removeMember } from '@/lib/db/collectionMembers';
import { createInvite, deleteInvite } from '@/lib/db/collectionInvites';

type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: '로그인이 필요합니다.' };
  return { ok: true, userId: data.user.id };
}

export async function createCollectionAction(name: string): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '이름을 입력해주세요.' };
  try {
    const c = await createCollection(trimmed, auth.userId);
    return { ok: true, data: { id: c.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '생성 실패' };
  }
}

export async function renameCollectionAction(id: string, name: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '이름을 입력해주세요.' };
  try {
    await renameCollection(id, trimmed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '수정 실패' };
  }
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await deleteCollection(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
}

export async function leaveCollectionAction(id: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await leaveCollection(id, auth.userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '나가기 실패' };
  }
}

export async function removeMemberAction(
  collectionId: string,
  userId: string,
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await removeMember(collectionId, userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '강퇴 실패' };
  }
}

export async function createInviteAction(
  collectionId: string,
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const invite = await createInvite(collectionId, auth.userId);
    return { ok: true, data: { code: invite.code, expiresAt: invite.expires_at } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '초대 생성 실패' };
  }
}

export async function deleteInviteAction(code: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await deleteInvite(code);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '초대 삭제 실패' };
  }
}

export async function addSongsToCollectionAction(
  collectionId: string,
  songIds: string[],
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!songIds.length) return { ok: true };
  try {
    await Promise.all(songIds.map((sid) => addSongsToCollections(sid, [collectionId], auth.userId)));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function saveSongToCollectionsAction(
  songId: string,
  addCollectionIds: string[],
  removeCollectionIds: string[],
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    if (addCollectionIds.length > 0) {
      await addSongsToCollections(songId, addCollectionIds, auth.userId);
    }
    if (removeCollectionIds.length > 0) {
      await removeSongFromCollections(songId, removeCollectionIds);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

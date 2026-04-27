import type { CollectionInvite } from '@/types/collection';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

function generateInviteCode(): string {
  // 16자 hex (8 bytes) — brute-force 사실상 불가
  const arr = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createInvite(
  collectionId: string,
  userId: string,
): Promise<CollectionInvite> {
  const sb = getSupabase();
  const code = generateInviteCode();
  const { data, error } = await sb
    .from('collection_invites')
    .insert({ code, collection_id: collectionId, created_by: userId })
    .select('code, collection_id, created_by, expires_at, created_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'invite creation failed');
  return data as CollectionInvite;
}

export async function listInvites(collectionId: string): Promise<CollectionInvite[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collection_invites')
    .select('code, collection_id, created_by, expires_at, created_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionInvite[];
}

export async function deleteInvite(code: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('collection_invites').delete().eq('code', code);
  if (error) throw new Error(error.message);
}

// RPC: 초대 코드로 가입 — security definer Postgres function
export async function joinByCode(code: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('join_collection_via_invite', { invite_code: code });
  if (error) throw new Error(error.message);
  return data as string;
}

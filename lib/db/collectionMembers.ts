import type { CollectionMember, CollectionMemberWithProfile } from '@/types/collection';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export async function listMembers(collectionId: string): Promise<CollectionMemberWithProfile[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collection_members')
    .select('collection_id, user_id, role, joined_at')
    .eq('collection_id', collectionId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(`listMembers: ${error.message}`);
  return (data ?? []) as CollectionMemberWithProfile[];
}

export async function leaveCollection(collectionId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function removeMember(collectionId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function getMyMembership(
  collectionId: string,
  userId: string,
): Promise<CollectionMember | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collection_members')
    .select('collection_id, user_id, role, joined_at')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as CollectionMember;
}

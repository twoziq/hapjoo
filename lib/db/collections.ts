import type { Collection, CollectionWithCounts } from '@/types/collection';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

interface CollectionRow extends Collection {
  collection_members: { count: number }[];
  collection_songs: { count: number }[];
}

export async function listMyCollections(): Promise<CollectionWithCounts[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collections')
    .select(
      'id, name, owner_id, is_personal, created_at, collection_members(count), collection_songs(count)',
    )
    .order('is_personal', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listMyCollections: ${error.message}`);
  return ((data ?? []) as unknown as CollectionRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    owner_id: row.owner_id,
    is_personal: row.is_personal,
    created_at: row.created_at,
    member_count: row.collection_members[0]?.count ?? 0,
    song_count: row.collection_songs[0]?.count ?? 0,
  }));
}

export async function getCollection(id: string): Promise<Collection | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collections')
    .select('id, name, owner_id, is_personal, created_at')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Collection;
}

export async function createCollection(name: string, ownerId: string): Promise<Collection> {
  const sb = getSupabase();
  const id = crypto.randomUUID();
  const { error: insertErr } = await sb
    .from('collections')
    .insert({ id, name, owner_id: ownerId, is_personal: false });
  if (insertErr) throw new Error(insertErr.message);
  const { error: memberErr } = await sb.from('collection_members').insert({
    collection_id: id,
    user_id: ownerId,
    role: 'owner',
  });
  if (memberErr) throw new Error(memberErr.message);
  return {
    id,
    name,
    owner_id: ownerId,
    is_personal: false,
    created_at: new Date().toISOString(),
  };
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('collections').update({ name }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCollection(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('collections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

import type { SongRow } from './songs';

export async function listCollectionSongs(collectionId: string): Promise<SongRow[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collection_songs')
    .select('songs(id, title, artist, key, capo, bpm)')
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false });
  if (error) throw new Error(`listCollectionSongs: ${error.message}`);
  type Row = { songs: SongRow | SongRow[] | null };
  return ((data ?? []) as unknown as Row[])
    .map((r) => (Array.isArray(r.songs) ? r.songs[0] : r.songs))
    .filter((s): s is SongRow => !!s);
}

export async function addSongsToCollections(
  songId: string,
  collectionIds: string[],
  userId: string,
): Promise<void> {
  if (!collectionIds.length) return;
  const sb = getSupabase();
  const rows = collectionIds.map((cid) => ({
    collection_id: cid,
    song_id: songId,
    added_by: userId,
  }));
  const { error } = await sb
    .from('collection_songs')
    .upsert(rows, { onConflict: 'collection_id,song_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeSongFromCollections(
  songId: string,
  collectionIds: string[],
): Promise<void> {
  if (!collectionIds.length) return;
  const sb = getSupabase();
  const { error } = await sb
    .from('collection_songs')
    .delete()
    .eq('song_id', songId)
    .in('collection_id', collectionIds);
  if (error) throw new Error(error.message);
}

export async function listCollectionsContainingSong(songId: string): Promise<string[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('collection_songs')
    .select('collection_id')
    .eq('song_id', songId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { collection_id: string }).collection_id);
}

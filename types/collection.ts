export interface Collection {
  id: string;
  name: string;
  owner_id: string;
  is_personal: boolean;
  created_at?: string;
}

export interface CollectionWithCounts extends Collection {
  member_count: number;
  song_count: number;
}

export type CollectionRole = 'owner' | 'member';

export interface CollectionMember {
  collection_id: string;
  user_id: string;
  role: CollectionRole;
  joined_at?: string;
}

export interface CollectionMemberWithProfile extends CollectionMember {
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export interface CollectionSong {
  collection_id: string;
  song_id: string;
  added_by: string | null;
  added_at?: string;
}

export interface CollectionInvite {
  code: string;
  collection_id: string;
  created_by: string | null;
  expires_at: string;
  created_at?: string;
}

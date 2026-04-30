export type ChangeRequestKind = 'create' | 'edit';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SongChangeRequestPatch {
  title: string;
  artist: string;
  music_key: string;
  capo: number;
  bpm: number;
  content: string;
}

export interface SongChangeRequest extends SongChangeRequestPatch {
  id: string;
  kind: ChangeRequestKind;
  song_id: string | null;
  proposed_id: string | null;
  requester_id: string;
  status: ChangeRequestStatus;
  reason: string | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

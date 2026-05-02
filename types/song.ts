export interface DbSong {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  bpm: number;
  folder?: string | null;
  content: string;
  created_at?: string;
}

export interface UserSong {
  id?: string;
  user_id?: string;
  song_id: string;
  semitones: number;
  notes: Record<string, string>;
  content?: string | null;
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  key: string;
  folder?: string | null;
}

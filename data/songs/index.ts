// Songs are auto-discovered from data/songs/**/*.txt — no registration needed.
// Drop a .txt file in the right folder and it will appear automatically.

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  key: string;
  gender?: '남' | '여';
  folder?: string | null;
}

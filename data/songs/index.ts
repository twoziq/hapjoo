import neoege from './너에게난_나에게넌';

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  key: string;
  gender?: '남' | '여';
  folder?: string;
}

export const SONGS: SongEntry[] = [
  { id: 'neoege', title: '너에게난 나에게넌', artist: '자전거탄 풍경', key: 'G' },
];

const CONTENT: Record<string, string> = {
  neoege,
};

export function getSongMarkdown(id: string): string {
  return CONTENT[id] ?? '';
}

export function getSongsByFolder(): { folder: string | null; songs: SongEntry[] }[] {
  const map = new Map<string | null, SongEntry[]>();
  for (const s of SONGS) {
    const f = s.folder ?? null;
    if (!map.has(f)) map.set(f, []);
    map.get(f)!.push(s);
  }
  const result: { folder: string | null; songs: SongEntry[] }[] = [];
  if (map.has(null)) result.push({ folder: null, songs: map.get(null)! });
  map.forEach((songs, folder) => { if (folder !== null) result.push({ folder, songs }); });
  return result;
}

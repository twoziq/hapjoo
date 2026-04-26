import { scanSongs } from '@/lib/songLoader';
import { dbGetSongs } from '@/lib/supabase';
import SongsClient, { type SongItem } from './SongsClient';
import Link from 'next/link';

export default async function SongsPage() {
  const fileSongs = scanSongs();
  const dbSongs = await dbGetSongs();

  const merged: SongItem[] = fileSongs.map(s => ({
    id: s.id, title: s.title, artist: s.artist, key: s.key, folder: s.folder,
  }));

  if (dbSongs) {
    const fileIds = new Set(fileSongs.map(s => s.id));
    for (const db of dbSongs) {
      if (fileIds.has(db.id)) {
        const idx = merged.findIndex(s => s.id === db.id);
        if (idx >= 0) {
          merged[idx] = { id: db.id, title: db.title, artist: db.artist, key: db.key, folder: db.folder ?? null };
        }
      } else {
        merged.push({ id: db.id, title: db.title, artist: db.artist, key: db.key, folder: db.folder ?? null });
      }
    }
  }

  const map = new Map<string | null, SongItem[]>();
  for (const s of merged) {
    const f = s.folder ?? null;
    if (!map.has(f)) map.set(f, []);
    map.get(f)!.push(s);
  }

  const groups: { folder: string | null; songs: SongItem[] }[] = [];
  if (map.has(null)) groups.push({ folder: null, songs: map.get(null)! });
  map.forEach((songs, folder) => { if (folder !== null) groups.push({ folder, songs }); });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">악보 목록</h1>
        <div className="flex items-center gap-2">
          <Link href="/songs/new"
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white">
            + 악보 추가
          </Link>
        </div>
      </div>
      <SongsClient groups={groups} />
    </div>
  );
}

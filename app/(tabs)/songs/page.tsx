import Link from 'next/link';
import type { SongItem } from '@/types/song';
import { ROUTES } from '@/lib/constants';
import { getSongs } from '@/lib/db/songs';
import SongsClient from './SongsClient';

export default async function SongsPage() {
  const dbSongs = await getSongs();

  const items: SongItem[] = dbSongs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    key: s.key,
    folder: s.folder ?? null,
  }));

  const map = new Map<string | null, SongItem[]>();
  for (const s of items) {
    const f = s.folder ?? null;
    if (!map.has(f)) map.set(f, []);
    map.get(f)!.push(s);
  }

  const groups: { folder: string | null; songs: SongItem[] }[] = [];
  if (map.has(null)) groups.push({ folder: null, songs: map.get(null)! });
  map.forEach((songs, folder) => {
    if (folder !== null) groups.push({ folder, songs });
  });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">악보 목록</h1>
        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.songsNew}
            prefetch
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white"
          >
            + 악보 추가
          </Link>
        </div>
      </div>
      <SongsClient groups={groups} />
    </div>
  );
}

import Link from 'next/link';
import type { SongItem } from '@/types/song';
import { ROUTES } from '@/lib/constants';
import { SONGS_PAGE_SIZE, getSongsPageCached } from '@/lib/db/songs';
import SongsClient from './SongsClient';

export default async function SongsPage() {
  const { rows, hasMore } = await getSongsPageCached(0, SONGS_PAGE_SIZE);

  const initialItems: SongItem[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    key: s.key,
  }));

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
      <SongsClient
        initialItems={initialItems}
        initialHasMore={hasMore}
        pageSize={SONGS_PAGE_SIZE}
      />
    </div>
  );
}

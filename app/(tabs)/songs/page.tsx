import Link from 'next/link';
import type { SongItem } from '@/types/song';
import { ROUTES } from '@/lib/constants';
import { SONGS_PAGE_SIZE, getSongsPageCached, getFolderSongsCached } from '@/lib/db/songs';
import SongsClient from './SongsClient';

const FOLDER_LABELS: Record<string, string> = {
  entertain: 'SK엔터',
};

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { folder } = await searchParams;
  const activeFolder = typeof folder === 'string' ? folder : null;

  if (activeFolder) {
    const rows = await getFolderSongsCached(activeFolder);
    const items: SongItem[] = rows.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      key: s.key,
      folder: s.folder,
    }));

    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={ROUTES.songs}
            prefetch
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← 뒤로
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-bold">{FOLDER_LABELS[activeFolder] ?? activeFolder}</h1>
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((song) => (
            <li key={song.id}>
              <Link
                href={ROUTES.viewer(song.id)}
                prefetch
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
              >
                <div>
                  <p className="font-semibold">{song.title}</p>
                  <p className="text-sm text-gray-400">{song.artist}</p>
                </div>
                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                  {song.key}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { rows, hasMore } = await getSongsPageCached(0, SONGS_PAGE_SIZE);
  const initialItems: SongItem[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    key: s.key,
    folder: s.folder,
  }));

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">악보 목록</h1>
        <Link
          href={ROUTES.songsNew}
          prefetch
          className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white"
        >
          + 악보 추가
        </Link>
      </div>
      <SongsClient
        initialItems={initialItems}
        initialHasMore={hasMore}
        pageSize={SONGS_PAGE_SIZE}
      />
    </div>
  );
}

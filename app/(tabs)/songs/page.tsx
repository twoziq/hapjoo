import Link from 'next/link';
import { SONGS } from '@/data/songs/index';

export default function SongsPage() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">악보 목록</h1>

      <input
        type="search"
        placeholder="곡 제목 또는 아티스트 검색"
        className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-gray-50"
      />

      <ul className="flex flex-col gap-2">
        {SONGS.map((song) => (
          <li key={song.id}>
            <Link
              href={`/viewer/${song.id}`}
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

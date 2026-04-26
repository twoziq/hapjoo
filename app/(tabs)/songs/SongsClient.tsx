'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  key: string;
  folder: string | null;
}

export default function SongsClient({ groups }: { groups: { folder: string | null; songs: SongItem[] }[] }) {
  const [query, setQuery]         = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleFolder(folder: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  }

  const filtered = (songs: SongItem[]) =>
    query.trim() ? songs.filter(s => s.title.includes(query) || s.artist.includes(query)) : songs;

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="곡 제목 또는 아티스트 검색"
        className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-gray-50"
      />

      {groups.map(({ folder, songs }) => {
        const list = filtered(songs);
        if (!list.length) return null;
        const isOpen = !folder || !collapsed.has(folder);

        return (
          <div key={folder ?? '__root__'} className="mb-4">
            {folder && (
              <button
                onClick={() => toggleFolder(folder)}
                className="w-full flex items-center gap-2 mb-2 py-2 px-1 text-left select-none"
              >
                <span className="text-base leading-none">{isOpen ? '📂' : '📁'}</span>
                <span className="flex-1 text-sm font-bold text-gray-700 tracking-wide">{folder}</span>
                <span className="text-xs text-gray-400">{songs.length}곡</span>
                <span className="text-gray-400 text-xs ml-1">{isOpen ? '▾' : '▸'}</span>
              </button>
            )}

            {isOpen && (
              <ul className="flex flex-col gap-2">
                {list.map(song => (
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
            )}
          </div>
        );
      })}
    </>
  );
}

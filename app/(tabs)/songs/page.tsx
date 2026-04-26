'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getSongsByFolder, type SongEntry } from '@/data/songs/index';
import AuthButton from '@/components/AuthButton';

export default function SongsPage() {
  const [query, setQuery] = useState('');
  const groups = getSongsByFolder();

  const filtered = (songs: SongEntry[]) =>
    query.trim()
      ? songs.filter(s =>
          s.title.includes(query) || s.artist.includes(query)
        )
      : songs;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">악보 목록</h1>
        <div className="flex items-center gap-2">
          <AuthButton />
          <Link href="/songs/new"
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white">
            + 악보 추가
          </Link>
        </div>
      </div>

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
        return (
          <div key={folder ?? '__default__'} className="mb-6">
            {folder && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
                  📁 {folder}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )}
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
          </div>
        );
      })}
    </div>
  );
}

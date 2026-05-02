'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SongItem } from '@/types/song';
import type { SongRow } from '@/lib/db/songs';
import { ROUTES } from '@/lib/constants';
import { fetchSongsPage, searchSongsPage } from '@/lib/db/songs';

export type { SongItem } from '@/types/song';

interface Props {
  initialItems: SongItem[];
  initialHasMore: boolean;
  pageSize: number;
}

function rowToItem(s: SongRow): SongItem {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    key: s.key,
    folder: s.folder,
  };
}

export default function SongsClient({ initialItems, initialHasMore, pageSize }: Props) {
  const [browseItems, setBrowseItems] = useState<SongItem[]>(initialItems);
  const [browseHasMore, setBrowseHasMore] = useState<boolean>(initialHasMore);

  const [searchItems, setSearchItems] = useState<SongItem[]>([]);
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setActiveQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (activeQuery === '') return;
    let cancelled = false;
    searchSongsPage(activeQuery, 0, pageSize)
      .then(({ rows, hasMore: more }) => {
        if (cancelled) return;
        setSearchItems(rows.map(rowToItem));
        setSearchHasMore(more);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchItems([]);
        setSearchHasMore(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, pageSize]);

  const isSearching = activeQuery.length > 0;
  const items = isSearching ? searchItems : browseItems;
  const hasMore = isSearching ? searchHasMore : browseHasMore;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loading) return;
        setLoading(true);
        const offset = items.length;
        const promise = isSearching
          ? searchSongsPage(activeQuery, offset, pageSize)
          : fetchSongsPage(offset, pageSize);
        promise
          .then(({ rows, hasMore: more }) => {
            const newItems = rows.map(rowToItem);
            if (isSearching) {
              setSearchItems((prev) => [...prev, ...newItems]);
              setSearchHasMore(more);
            } else {
              setBrowseItems((prev) => [...prev, ...newItems]);
              setBrowseHasMore(more);
            }
          })
          .catch(() => {
            if (isSearching) setSearchHasMore(false);
            else setBrowseHasMore(false);
          })
          .finally(() => setLoading(false));
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, items.length, pageSize, isSearching, activeQuery]);

  const showEmptyState = isSearching && !loading && items.length === 0;

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="곡 제목 또는 아티스트 검색"
        className="w-full mb-4 px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-gray-50"
      />

      {!isSearching && (
        <Link
          href={ROUTES.songsFolder('entertain')}
          prefetch
          className="flex items-center justify-between w-full mb-4 p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📁</span>
            <span className="font-semibold">SK엔터</span>
          </div>
          <span className="text-xs text-gray-400">›</span>
        </Link>
      )}

      {showEmptyState && (
        <p className="text-center text-xs text-gray-400 py-8">검색 결과가 없어요.</p>
      )}

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

      {hasMore && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-gray-400">
          {loading ? '불러오는 중…' : ''}
        </div>
      )}
    </>
  );
}

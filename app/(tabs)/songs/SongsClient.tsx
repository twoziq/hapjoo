'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
    folder: s.folder ?? null,
  };
}

export default function SongsClient({ initialItems, initialHasMore, pageSize }: Props) {
  // Browse-mode state (when search is empty).
  const [browseItems, setBrowseItems] = useState<SongItem[]>(initialItems);
  const [browseHasMore, setBrowseHasMore] = useState<boolean>(initialHasMore);

  // Search-mode state (when activeQuery is non-empty).
  const [searchItems, setSearchItems] = useState<SongItem[]>([]);
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setActiveQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch first page of search results when activeQuery changes.
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

  // Infinite scroll: branch on whether searching.
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

  const groups = useMemo(() => {
    const map = new Map<string | null, SongItem[]>();
    for (const s of items) {
      const f = s.folder ?? null;
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(s);
    }
    const out: { folder: string | null; songs: SongItem[] }[] = [];
    if (map.has(null)) out.push({ folder: null, songs: map.get(null)! });
    map.forEach((songs, folder) => {
      if (folder !== null) out.push({ folder, songs });
    });
    return out;
  }, [items]);

  function toggleFolder(folder: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

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

      {showEmptyState && (
        <p className="text-center text-xs text-gray-400 py-8">검색 결과가 없어요.</p>
      )}

      {groups.map(({ folder, songs }) => {
        const isOpen = !folder || !collapsed.has(folder);

        return (
          <div key={folder ?? '__root__'} className="mb-4">
            {folder && (
              <button
                onClick={() => toggleFolder(folder)}
                className="w-full flex items-center gap-2 mb-2 py-2 px-1 text-left select-none"
              >
                <span className="text-base leading-none">{isOpen ? '📂' : '📁'}</span>
                <span className="flex-1 text-sm font-bold text-gray-700 tracking-wide">
                  {folder}
                </span>
                <span className="text-xs text-gray-400">{songs.length}곡</span>
                <span className="text-gray-400 text-xs ml-1">{isOpen ? '▾' : '▸'}</span>
              </button>
            )}

            {isOpen && (
              <ul className="flex flex-col gap-2">
                {songs.map((song) => (
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
            )}
          </div>
        );
      })}

      {hasMore && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-gray-400">
          {loading ? '불러오는 중…' : ''}
        </div>
      )}
    </>
  );
}

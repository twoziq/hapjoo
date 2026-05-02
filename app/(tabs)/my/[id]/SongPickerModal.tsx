'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { SongRow } from '@/lib/db/songs';
import { fetchSongsPage, fetchFolderSongs, searchSongsPage } from '@/lib/db/songs';
import { addSongsToCollectionAction } from '../actions';

interface Props {
  collectionId: string;
  existingSongIds: Set<string>;
  onClose: () => void;
  onSaved: (newSongs: SongRow[]) => void;
}

const PAGE_SIZE = 50;
const FOLDER_LABELS: Record<string, string> = { entertain: 'SK엔터' };
const FOLDERS = Object.keys(FOLDER_LABELS);

export default function SongPickerModal({ collectionId, existingSongIds, onClose, onSaved }: Props) {
  const [items, setItems] = useState<SongRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<Map<string, SongRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setActiveQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setHasMore(false);

    const promise = activeQuery
      ? searchSongsPage(activeQuery, 0, PAGE_SIZE)
      : activeFolder
        ? fetchFolderSongs(activeFolder).then((rows) => ({ rows, hasMore: false }))
        : fetchSongsPage(0, PAGE_SIZE);

    promise
      .then(({ rows, hasMore: more }) => {
        if (cancelled) return;
        setItems(rows);
        setHasMore(more);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, activeFolder]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loading) return;
        setLoading(true);
        const offset = items.length;
        const promise = activeQuery
          ? searchSongsPage(activeQuery, offset, PAGE_SIZE)
          : fetchSongsPage(offset, PAGE_SIZE);
        promise
          .then(({ rows, hasMore: more }) => {
            setItems((prev) => [...prev, ...rows]);
            setHasMore(more);
          })
          .catch(() => setHasMore(false))
          .finally(() => setLoading(false));
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, items.length, activeQuery]);

  function toggleSong(song: SongRow) {
    setSelectedSongs((prev) => {
      const next = new Map(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.set(song.id, song);
      return next;
    });
  }

  function handleSave() {
    if (!selectedSongs.size) {
      onClose();
      return;
    }
    setError(null);
    startTransition(async () => {
      const ids = [...selectedSongs.keys()];
      const r = await addSongsToCollectionAction(collectionId, ids);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSaved([...selectedSongs.values()]);
    });
  }

  const isSearching = activeQuery.length > 0;
  const isInFolder = !isSearching && activeFolder !== null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        {isInFolder && (
          <button
            onClick={() => setActiveFolder(null)}
            aria-label="뒤로"
            className="text-gray-400 text-lg px-1"
          >
            ←
          </button>
        )}
        <span className="flex-1 text-base font-bold">
          {isInFolder ? FOLDER_LABELS[activeFolder!] : '곡 추가'}
        </span>
        <button
          onClick={onClose}
          disabled={isPending}
          className="text-sm text-gray-500 px-3 py-1.5 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-sm font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white disabled:opacity-50"
        >
          {isPending ? '저장 중…' : selectedSongs.size ? `저장 (${selectedSongs.size})` : '저장'}
        </button>
      </div>

      {!isInFolder && (
        <div className="px-4 pt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="곡 제목 또는 아티스트 검색"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-gray-50"
          />
        </div>
      )}

      {error && (
        <div className="mx-4 mt-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {!isSearching && !isInFolder &&
          FOLDERS.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className="flex items-center justify-between w-full mb-4 p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <span className="font-semibold">{FOLDER_LABELS[folder]}</span>
              </div>
              <span className="text-xs text-gray-400">›</span>
            </button>
          ))}

        <ul className="flex flex-col gap-2">
          {items.map((song) => {
            const isExisting = existingSongIds.has(song.id);
            const isSelected = selectedSongs.has(song.id);
            return (
              <li key={song.id}>
                <button
                  onClick={() => !isExisting && toggleSong(song)}
                  disabled={isExisting}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${
                    isExisting
                      ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'bg-white border-gray-200 active:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{song.title}</p>
                    <p className="text-sm text-gray-400">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full ${
                        isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-indigo-50 text-indigo-500'
                      }`}
                    >
                      {song.key}
                    </span>
                    {isExisting && <span className="text-xs text-gray-400">추가됨</span>}
                    {isSelected && <span className="text-indigo-600 font-bold text-base">✓</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {loading && <p className="text-center text-xs text-gray-400 py-4">불러오는 중…</p>}
        {!loading && items.length === 0 && isSearching && (
          <p className="text-center text-xs text-gray-400 py-8">검색 결과가 없어요.</p>
        )}
        {hasMore && <div ref={sentinelRef} className="py-2" />}
      </div>
    </div>
  );
}

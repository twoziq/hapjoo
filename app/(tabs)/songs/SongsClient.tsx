'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SongItem } from '@/types/song';
import type { SongRow } from '@/lib/db/songs';
import { ROUTES, STORAGE_KEYS } from '@/lib/constants';
import { fetchSongsPage, searchSongsPage } from '@/lib/db/songs';
import { useSession } from '@/lib/hooks/useSession';
import { supabaseConfigured } from '@/lib/supabase/client';
import SaveToCollectionModal from '@/components/SaveToCollectionModal';
import { deleteSongAction, reportSongAction } from './actions';

export type { SongItem } from '@/types/song';

const LONG_PRESS_MS = 500;

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

interface ContextMenu {
  song: SongItem;
  x: number;
  y: number;
}

interface ReportModal {
  songId: string;
  songTitle: string;
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

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [saveModalSongId, setSaveModalSongId] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<ReportModal | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const { isAdmin, isAuthenticated } = useSession();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTarget = useRef<SongItem | null>(null);

  // Scroll save/restore
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const saved = sessionStorage.getItem(STORAGE_KEYS.songsScroll);
    if (saved) main.scrollTop = parseInt(saved, 10);

    const onScroll = () => {
      sessionStorage.setItem(STORAGE_KEYS.songsScroll, String(main.scrollTop));
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

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

  function startLongPress(song: SongItem, e: React.PointerEvent) {
    longPressTarget.current = song;
    longPressRef.current = setTimeout(() => {
      setContextMenu({ song, x: e.clientX, y: e.clientY });
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    longPressTarget.current = null;
  }

  function handleDelete(songId: string) {
    setContextMenu(null);
    if (!confirm('이 악보를 삭제할까요?')) return;
    deleteSongAction(songId).catch(() => {});
  }

  function openReportModal(song: SongItem) {
    setContextMenu(null);
    setReportTitle('');
    setReportReason('');
    setReportMsg(null);
    setReportModal({ songId: song.id, songTitle: song.title });
  }

  async function submitReport() {
    if (!reportModal || !reportTitle.trim() || !reportReason.trim()) return;
    setReportSending(true);
    const r = await reportSongAction(reportModal.songId, reportTitle.trim(), reportReason.trim());
    setReportSending(false);
    if (r.ok) {
      setReportMsg('신고가 접수되었어요.');
      setTimeout(() => setReportModal(null), 1500);
    } else {
      setReportMsg(r.error);
    }
  }

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
              onPointerDown={(e) => startLongPress(song, e)}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ song, x: e.clientX, y: e.clientY });
              }}
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

      {/* Context menu (long press) */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="absolute bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-52"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800 truncate">{contextMenu.song.title}</p>
              <p className="text-xs text-gray-400 truncate">{contextMenu.song.artist}</p>
            </div>
            {isAuthenticated && supabaseConfigured && (
              <button
                onClick={() => { setContextMenu(null); setSaveModalSongId(contextMenu.song.id); }}
                className="w-full px-4 py-3 text-sm text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3"
              >
                <span>⭐</span> 저장
              </button>
            )}
            <button
              onClick={() => openReportModal(contextMenu.song)}
              className="w-full px-4 py-3 text-sm text-left text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3"
            >
              <span>🚨</span> 오류 신고
            </button>
            {isAdmin && supabaseConfigured && (
              <button
                onClick={() => handleDelete(contextMenu.song.id)}
                className="w-full px-4 py-3 text-sm text-left text-red-500 hover:bg-red-50 active:bg-red-100 flex items-center gap-3 border-t border-gray-100"
              >
                <span>🗑</span> 삭제
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save to collection modal */}
      {saveModalSongId && (
        <SaveToCollectionModal songId={saveModalSongId} onClose={() => setSaveModalSongId(null)} />
      )}

      {/* Report modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setReportModal(null)}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-sm font-bold text-gray-800">오류 신고</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{reportModal.songTitle}</p>
            </div>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="제목 (예: 코드가 틀렸어요)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="어떤 부분이 잘못됐는지 간단히 적어주세요"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
            />
            {reportMsg && (
              <p className={`text-xs font-semibold ${reportMsg.includes('접수') ? 'text-green-600' : 'text-red-500'}`}>
                {reportMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
              >
                취소
              </button>
              <button
                onClick={submitReport}
                disabled={reportSending || !reportTitle.trim() || !reportReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {reportSending ? '전송 중…' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

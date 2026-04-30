'use client';

import { useEffect, useState, useTransition } from 'react';
import type { CollectionWithCounts } from '@/types/collection';
import {
  listMyCollections,
  listCollectionsContainingSong,
} from '@/lib/db/collections';
import { useSession } from '@/lib/hooks/useSession';
import {
  createCollectionAction,
  saveSongToCollectionsAction,
} from '@/app/(tabs)/my/actions';

interface Props {
  songId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SaveToCollectionModal({ songId, onClose, onSaved }: Props) {
  const { session } = useSession();
  const myUserId = session?.user.id ?? null;
  const [collections, setCollections] = useState<CollectionWithCounts[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMyCollections(), listCollectionsContainingSong(songId)])
      .then(([cols, containingIds]) => {
        if (cancelled) return;
        setCollections(cols);
        const containing = new Set(containingIds);
        setSelected(new Set(containing));
        setInitialSelected(new Set(containing));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function createNew() {
    setError(null);
    startTransition(async () => {
      const r = await createCollectionAction(draft);
      if (r.ok) {
        // refresh collections + auto-select new one
        const cols = await listMyCollections();
        setCollections(cols);
        setSelected((prev) => new Set(prev).add(r.data.id));
        setShowCreate(false);
        setDraft('');
      } else {
        setError(r.error);
      }
    });
  }

  function commit() {
    setError(null);
    const add = [...selected].filter((id) => !initialSelected.has(id));
    const remove = [...initialSelected].filter((id) => !selected.has(id));
    if (add.length === 0 && remove.length === 0) {
      onClose();
      return;
    }
    startTransition(async () => {
      const r = await saveSongToCollectionsAction(songId, add, remove);
      if (r.ok) {
        onSaved?.();
        onClose();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-3 text-gray-700 shrink-0">어디에 저장할까요?</h3>

        <div className="flex-1 overflow-y-auto -mx-1">
          {loading ? (
            <p className="text-center text-xs text-gray-400 py-6">불러오는 중…</p>
          ) : collections.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-6">
              저장소가 없어요. 아래에서 만들어주세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {collections.map((c) => {
                const checked = selected.has(c.id);
                const wasInitiallyChecked = initialSelected.has(c.id);
                const isOwner = myUserId !== null && c.owner_id === myUserId;
                // 비-owner 멤버는 이미 담겨있던 곡을 빼지는 못함 (RLS: owner만 DELETE 가능)
                const cannotUncheck = !isOwner && wasInitiallyChecked;
                return (
                  <li key={c.id}>
                    <label
                      className={`flex items-center gap-3 px-2 py-2.5 rounded-lg ${
                        cannotUncheck ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${checked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={cannotUncheck}
                        onChange={() => !cannotUncheck && toggle(c.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm flex-1 truncate">
                        {c.is_personal && <span className="mr-1">👤</span>}
                        {c.name}
                        {cannotUncheck && (
                          <span className="ml-2 text-[10px] text-amber-600">owner만 제거 가능</span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-400">{c.song_count}곡</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 mt-3 border-t border-gray-100 pt-3">
          {showCreate ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createNew()}
                placeholder="저장소 이름"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <button
                onClick={createNew}
                disabled={isPending || !draft.trim()}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                만들기
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setDraft('');
                }}
                className="text-xs text-gray-400 px-2"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 font-semibold hover:border-indigo-300 hover:text-indigo-500"
            >
              + 새 저장소 만들기
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 mt-3 shrink-0">
          <button
            onClick={commit}
            disabled={isPending}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? '저장 중…' : '완료'}
          </button>
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-sm text-gray-400"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}


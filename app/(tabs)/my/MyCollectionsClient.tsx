'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CollectionWithCounts } from '@/types/collection';
import { ROUTES } from '@/lib/constants';
import { listMyCollections } from '@/lib/db/collections';
import { useSession } from '@/lib/hooks/useSession';
import { createCollectionAction } from './actions';

export default function MyCollectionsClient() {
  const router = useRouter();
  const { isAuthenticated, loading: sessionLoading } = useSession();
  const [collections, setCollections] = useState<CollectionWithCounts[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !isAuthenticated) return;
    let cancelled = false;
    listMyCollections()
      .then((cols) => {
        if (!cancelled) setCollections(cols);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionLoading]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createCollectionAction(draft);
      if (r.ok) {
        setShowCreate(false);
        setDraft('');
        router.push(ROUTES.myDetail(r.data.id));
      } else {
        setError(r.error);
      }
    });
  }

  if (sessionLoading) {
    return <p className="text-center text-sm text-gray-400 py-8">불러오는 중…</p>;
  }

  if (!isAuthenticated) {
    // 로그인 가드는 부모 MyClient에서 처리. 여기 도달하지 않음.
    return null;
  }

  if (collections === null) {
    return <p className="text-center text-sm text-gray-400 py-8">컬렉션 불러오는 중…</p>;
  }

  return (
    <>
      <button
        onClick={() => setShowCreate(true)}
        className="w-full mb-3 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 font-semibold hover:border-indigo-300 hover:text-indigo-500 transition-colors"
      >
        + 새 저장소
      </button>

      <ul className="flex flex-col gap-2">
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={ROUTES.myDetail(c.id)}
              prefetch
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">{c.is_personal ? '👤' : '📁'}</span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.song_count}곡 · 멤버 {c.member_count}명
                  </p>
                </div>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          </li>
        ))}
        {collections.length === 0 && (
          <li className="text-center text-xs text-gray-400 py-8">
            저장소가 아직 없어요. 위에서 만들어보세요.
          </li>
        )}
      </ul>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
          onClick={() => !isPending && setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-3 text-gray-700">새 저장소</h3>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="저장소 이름 (예: 합주팀 A)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={submit}
                disabled={isPending}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {isPending ? '만드는 중…' : '만들기'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm text-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

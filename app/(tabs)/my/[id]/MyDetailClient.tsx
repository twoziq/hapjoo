'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, notFound } from 'next/navigation';
import type {
  Collection,
  CollectionMember,
  CollectionMemberWithProfile,
} from '@/types/collection';
import type { SongRow } from '@/lib/db/songs';
import { ROUTES } from '@/lib/constants';
import { getCollection, listCollectionSongs } from '@/lib/db/collections';
import { getMyMembership, listMembers } from '@/lib/db/collectionMembers';
import { useSession } from '@/lib/hooks/useSession';
import {
  deleteCollectionAction,
  leaveCollectionAction,
  removeMemberAction,
  renameCollectionAction,
} from '../actions';
import InviteModal from './InviteModal';
import SongPickerModal from './SongPickerModal';

interface Props {
  collectionId: string;
}

interface DetailData {
  collection: Collection;
  songs: SongRow[];
  members: CollectionMemberWithProfile[];
  membership: CollectionMember;
}

export default function MyDetailClient({ collectionId }: Props) {
  const router = useRouter();
  const { session, loading: sessionLoading, isAuthenticated } = useSession();
  const [data, setData] = useState<DetailData | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not_found' | 'not_member'>(
    'loading',
  );
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (sessionLoading || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const collection = await getCollection(collectionId);
        if (!collection) {
          if (!cancelled) setLoadState('not_found');
          return;
        }
        const [songs, members, membership] = await Promise.all([
          listCollectionSongs(collectionId),
          listMembers(collectionId),
          getMyMembership(collectionId, session.user.id),
        ]);
        if (cancelled) return;
        if (!membership) {
          setLoadState('not_member');
          return;
        }
        setData({ collection, songs, members, membership });
        setName(collection.name);
        setLoadState('ready');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId, session, sessionLoading]);

  function refetch() {
    if (!session) return;
    (async () => {
      const [members] = await Promise.all([listMembers(collectionId)]);
      setData((prev) => (prev ? { ...prev, members } : prev));
    })();
  }

  if (sessionLoading) {
    return <div className="p-6 text-center text-sm text-gray-400">불러오는 중…</div>;
  }
  if (!isAuthenticated || !session) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        저장소는 로그인 후 사용할 수 있어요.
      </div>
    );
  }
  if (loadState === 'not_found') {
    notFound();
  }
  if (loadState === 'not_member') {
    return (
      <div className="p-6 text-center text-sm text-gray-400">이 저장소의 멤버가 아니에요.</div>
    );
  }
  if (loadState === 'loading' || !data) {
    return <div className="p-6 text-center text-sm text-gray-400">불러오는 중…</div>;
  }

  const { collection, songs, members, membership } = data;
  const currentUserId = session.user.id;
  const isOwner = membership.role === 'owner';

  function commitRename() {
    if (name.trim() === collection.name) {
      setEditingName(false);
      return;
    }
    startTransition(async () => {
      const r = await renameCollectionAction(collection.id, name);
      if (r.ok) {
        setEditingName(false);
        setData((prev) => (prev ? { ...prev, collection: { ...prev.collection, name } } : prev));
      } else {
        setError(r.error);
        setName(collection.name);
        setEditingName(false);
      }
    });
  }

  function doDelete() {
    setError(null);
    startTransition(async () => {
      const r = await deleteCollectionAction(collection.id);
      if (r.ok) {
        router.push(ROUTES.my);
      } else {
        setError(r.error);
        setConfirmDelete(false);
      }
    });
  }

  function doLeave() {
    setError(null);
    startTransition(async () => {
      const r = await leaveCollectionAction(collection.id);
      if (r.ok) {
        router.push(ROUTES.my);
      } else {
        setError(r.error);
        setConfirmLeave(false);
      }
    });
  }

  function kickMember(userId: string) {
    setError(null);
    startTransition(async () => {
      const r = await removeMemberAction(collection.id, userId);
      if (!r.ok) setError(r.error);
      else refetch();
    });
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="sticky top-0 bg-white border-b border-gray-100 -mx-4 px-4 py-3 mb-4 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(ROUTES.my)}
            aria-label="뒤로"
            className="text-gray-400 text-lg px-1"
          >
            ←
          </button>
          {editingName && isOwner && !collection.is_personal ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setName(collection.name);
                  setEditingName(false);
                }
              }}
              className="flex-1 text-base font-bold bg-transparent border-b border-indigo-400 outline-none"
            />
          ) : (
            <button
              onClick={() => isOwner && !collection.is_personal && setEditingName(true)}
              className="flex-1 text-left text-base font-bold truncate"
            >
              {collection.is_personal && <span className="mr-1">👤</span>}
              {collection.name}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <section className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">멤버</h2>
          {isOwner && (
            <button
              onClick={() => setShowInvite(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700"
            >
              + 멤버 초대
            </button>
          )}
        </div>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full text-xs text-gray-700"
            >
              <span className="font-semibold">
                {m.user_id === currentUserId ? '나' : m.user_id.slice(0, 6)}
              </span>
              <span className="text-gray-400 text-[10px]">{m.role}</span>
              {isOwner && m.user_id !== currentUserId && (
                <button
                  onClick={() => kickMember(m.user_id)}
                  aria-label="멤버 강퇴"
                  className="ml-1 text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            저장된 곡 ({songs.length})
          </h2>
          <button
            onClick={() => setShowSongPicker(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700"
          >
            + 곡 추가
          </button>
        </div>
        {songs.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">
            아직 저장된 곡이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {songs.map((s) => (
              <li key={s.id}>
                <Link
                  href={ROUTES.viewer(s.id)}
                  prefetch
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
                >
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-gray-400">{s.artist}</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                    {s.key}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 flex gap-2 justify-end">
        {!collection.is_personal && (
          <button
            onClick={() => setConfirmLeave(true)}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-gray-100"
          >
            나가기
          </button>
        )}
        {isOwner && !collection.is_personal && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-500 px-3 py-1.5 rounded-full bg-red-50"
          >
            저장소 삭제
          </button>
        )}
      </section>

      {showInvite && (
        <InviteModal collectionId={collection.id} onClose={() => setShowInvite(false)} />
      )}

      {showSongPicker && (
        <SongPickerModal
          collectionId={collection.id}
          existingSongIds={new Set(songs.map((s) => s.id))}
          onClose={() => setShowSongPicker(false)}
          onSaved={(newSongs) => {
            setData((prev) =>
              prev ? { ...prev, songs: [...prev.songs, ...newSongs] } : prev,
            );
            setShowSongPicker(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="저장소를 삭제할까요?"
          desc="저장된 곡 목록과 멤버 정보가 모두 사라집니다. 곡 자체는 카탈로그에 남습니다."
          confirmLabel="삭제"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          isPending={isPending}
        />
      )}

      {confirmLeave && (
        <ConfirmModal
          title="저장소에서 나갈까요?"
          desc="다시 들어오려면 멤버에게 초대 링크를 받아야 해요."
          confirmLabel="나가기"
          onConfirm={doLeave}
          onCancel={() => setConfirmLeave(false)}
          isPending={isPending}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  desc,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  isPending,
}: {
  title: string;
  desc: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
      onClick={() => !isPending && onCancel()}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-2 text-gray-700">{title}</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">{desc}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${
              danger ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
            }`}
          >
            {isPending ? '처리 중…' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
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

'use client';

import { useEffect, useState, useTransition } from 'react';
import type { SongChangeRequest } from '@/types/songChangeRequest';
import { listPendingRequests } from '@/lib/db/songChangeRequests';
import { fetchSongMeta, type SongMeta } from '@/lib/db/songs';
import {
  approveChangeRequestAction,
  rejectChangeRequestAction,
} from '@/app/(tabs)/songs/actions';

export default function PendingRequests() {
  const [requests, setRequests] = useState<SongChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listPendingRequests()
      .then((rs) => {
        if (!cancelled) setRequests(rs);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function reload() {
    setRequests(null);
    setRefresh((n) => n + 1);
  }

  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (requests === null) return <p className="text-xs text-gray-400">불러오는 중…</p>;
  if (requests.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">대기 중인 요청이 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((req) => (
        <RequestCard key={req.id} request={req} onResolved={reload} />
      ))}
    </ul>
  );
}

function RequestCard({
  request,
  onResolved,
}: {
  request: SongChangeRequest;
  onResolved: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentMeta, setCurrentMeta] = useState<SongMeta | null>(null);

  useEffect(() => {
    if (request.kind !== 'edit' || !showDetail || !request.song_id) return;
    let cancelled = false;
    fetchSongMeta(request.song_id).then((m) => {
      if (!cancelled) setCurrentMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [request.kind, request.song_id, showDetail]);

  function approve() {
    setError(null);
    startTransition(async () => {
      const r = await approveChangeRequestAction(request.id);
      if (r.ok) onResolved();
      else setError(r.error);
    });
  }

  function reject() {
    if (!rejectReason.trim()) {
      setError('거절 사유를 입력해주세요.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await rejectChangeRequestAction(request.id, rejectReason);
      if (r.ok) onResolved();
      else setError(r.error);
    });
  }

  const kindLabel = request.kind === 'create' ? '+ 추가' : '✎ 수정';
  const targetLabel =
    request.kind === 'create'
      ? '새 곡 (승인 시 id 발급)'
      : `편집: ${request.song_id?.slice(0, 8)}…`;

  return (
    <li className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                request.kind === 'create'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {kindLabel}
            </span>
            <span className="text-xs text-gray-400 truncate">{targetLabel}</span>
          </div>
          <p className="text-sm font-semibold truncate">{request.title}</p>
          <p className="text-xs text-gray-500 truncate">
            {request.artist || '(아티스트 미상)'} · {request.music_key} · 카포 {request.capo} · BPM{' '}
            {request.bpm}
          </p>
        </div>
        <button
          onClick={() => setShowDetail((v) => !v)}
          className="shrink-0 text-[11px] text-indigo-600 font-semibold"
        >
          {showDetail ? '접기' : '자세히'}
        </button>
      </div>

      {request.reason && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          요청 사유: {request.reason}
        </p>
      )}

      {showDetail && (
        <div className="mt-3 flex flex-col gap-2">
          {request.kind === 'edit' && currentMeta && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-gray-500">
                현재 카탈로그 값 (비교)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto bg-gray-900 text-gray-300 text-[11px] font-mono p-3 rounded-lg whitespace-pre-wrap">
                {`${currentMeta.title} / ${currentMeta.artist} / ${currentMeta.key} / 카포 ${currentMeta.capo} / BPM ${currentMeta.bpm}\n\n${currentMeta.content}`}
              </pre>
            </details>
          )}
          <details className="text-xs" open>
            <summary className="cursor-pointer font-semibold text-gray-500">요청 내용</summary>
            <pre className="mt-2 max-h-48 overflow-auto bg-gray-900 text-green-300 text-[11px] font-mono p-3 rounded-lg whitespace-pre-wrap">
              {request.content}
            </pre>
          </details>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}

      {showReject ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="거절 사유 (요청자에게 표시됩니다)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={isPending}
              className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {isPending ? '처리 중…' : '거절 보내기'}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setRejectReason('');
              }}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm text-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={approve}
            disabled={isPending}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? '처리 중…' : '승인'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200"
          >
            거절
          </button>
        </div>
      )}

      <p className="mt-2 text-[10px] text-gray-400">
        요청자 {request.requester_id.slice(0, 8)}… · {new Date(request.created_at).toLocaleString()}
      </p>
    </li>
  );
}

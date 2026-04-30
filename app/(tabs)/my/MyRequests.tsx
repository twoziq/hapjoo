'use client';

import { useEffect, useState } from 'react';
import type { SongChangeRequest } from '@/types/songChangeRequest';
import { listMyRequests } from '@/lib/db/songChangeRequests';

interface Props {
  userId: string;
}

const STATUS_LABEL: Record<SongChangeRequest['status'], { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인됨', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절됨', className: 'bg-red-100 text-red-700' },
};

export default function MyRequests({ userId }: Props) {
  const [requests, setRequests] = useState<SongChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyRequests(userId)
      .then((rs) => {
        if (!cancelled) setRequests(rs);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (requests === null) return <p className="text-xs text-gray-400">불러오는 중…</p>;
  if (requests.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">아직 보낸 요청이 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((req) => {
        const status = STATUS_LABEL[req.status];
        return (
          <li
            key={req.id}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  req.kind === 'create'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {req.kind === 'create' ? '+ 추가' : '✎ 수정'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                {status.label}
              </span>
              <p className="text-sm font-semibold truncate ml-auto">{req.title}</p>
            </div>
            <p className="text-xs text-gray-400 truncate">
              {req.artist || '(아티스트 미상)'} · {new Date(req.created_at).toLocaleDateString()}
            </p>
            {req.status === 'rejected' && req.reject_reason && (
              <p className="mt-1 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                거절 사유: {req.reject_reason}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

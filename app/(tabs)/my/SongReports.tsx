'use client';

import { useEffect, useState, useTransition } from 'react';
import type { SongReport } from '@/types/songReport';
import { listPendingSongReports, resolveSongReport } from '@/lib/db/songReports';

export default function SongReports() {
  const [reports, setReports] = useState<SongReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listPendingSongReports()
      .then((rs) => { if (!cancelled) setReports(rs); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패'); });
    return () => { cancelled = true; };
  }, [refresh]);

  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (reports === null) return <p className="text-xs text-gray-400">불러오는 중…</p>;
  if (reports.length === 0)
    return <p className="text-xs text-gray-400 py-4 text-center">접수된 오류 신고가 없어요.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} onResolved={() => { setReports(null); setRefresh((n) => n + 1); }} />
      ))}
    </ul>
  );
}

function ReportCard({ report, onResolved }: { report: SongReport; onResolved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function resolve() {
    setErr(null);
    startTransition(async () => {
      try {
        await resolveSongReport(report.id);
        onResolved();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '처리 실패');
      }
    });
  }

  return (
    <li className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              🚨 오류 신고
            </span>
          </div>
          <p className="text-sm font-semibold truncate">{report.title}</p>
          <p className="text-xs text-gray-400 truncate">
            곡 ID: {report.song_id.slice(0, 8)}…
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
        {report.reason}
      </p>

      {err && (
        <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {err}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={resolve}
          disabled={isPending}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? '처리 중…' : '확인 완료'}
        </button>
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        신고자 {report.reporter_id.slice(0, 8)}… · {new Date(report.created_at).toLocaleString()}
      </p>
    </li>
  );
}

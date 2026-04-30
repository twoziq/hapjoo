'use client';

import { useState, useTransition } from 'react';
import { ROUTES } from '@/lib/constants';
import { createInviteAction } from '../actions';

interface Props {
  collectionId: string;
  onClose: () => void;
}

export default function InviteModal({ collectionId, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const r = await createInviteAction(collectionId);
      if (r.ok) {
        setCode(r.data.code);
        setExpiresAt(r.data.expiresAt);
      } else {
        setError(r.error);
      }
    });
  }

  const fullLink =
    typeof window !== 'undefined' && code
      ? `${window.location.origin}${ROUTES.invite(code)}`
      : '';

  async function copy() {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('클립보드 복사에 실패했어요. 직접 복사해주세요.');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-3 text-gray-700">멤버 초대</h3>

        {!code ? (
          <>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              초대 링크를 만들면 7일 동안 사용할 수 있어요. 받은 사람이 링크를 열고 로그인하면 자동으로
              멤버가 됩니다.
            </p>
            <button
              onClick={generate}
              disabled={isPending}
              className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {isPending ? '만드는 중…' : '초대 링크 만들기'}
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-1">
              초대 링크
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                readOnly
                value={fullLink}
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 outline-none"
              />
              <button
                onClick={copy}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white shrink-0"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
            {expiresAt && (
              <p className="text-[10px] text-gray-400">
                만료: {new Date(expiresAt).toLocaleString('ko-KR')}
              </p>
            )}
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 px-4 py-2 rounded-xl bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { signInWithGoogle, signInWithKakao } from '@/lib/auth';
import { useSession } from '@/lib/hooks/useSession';
import { joinByCode } from '@/lib/db/collectionInvites';

interface Props {
  code: string;
}

export default function InviteRedeemClient({ code }: Props) {
  const router = useRouter();
  const { isAuthenticated, loading } = useSession();
  const [status, setStatus] = useState<'idle' | 'joined' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || inflight.current) return;
    inflight.current = true;
    joinByCode(code)
      .then((cid) => {
        setStatus('joined');
        router.replace(ROUTES.storageDetail(cid));
      })
      .catch((e: unknown) => {
        setStatus('error');
        setError(e instanceof Error ? e.message : '가입 실패');
      });
  }, [isAuthenticated, code, router]);

  if (loading) {
    return <div className="text-sm text-gray-400">불러오는 중…</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-gray-200 text-center">
        <h1 className="text-base font-bold mb-2">저장소 초대</h1>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          초대받은 저장소에 합류하려면 먼저 로그인해주세요. 로그인 후 자동으로 가입됩니다.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => signInWithGoogle()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white"
          >
            Google로 로그인
          </button>
          <button
            onClick={() => signInWithKakao()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#FEE500', color: '#000000CC' }}
          >
            카카오로 로그인
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-gray-200 text-center">
        <h1 className="text-base font-bold mb-2 text-red-600">초대 처리 실패</h1>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">{error}</p>
        <button
          onClick={() => router.push(ROUTES.storage)}
          className="text-xs font-bold px-4 py-2 rounded-full bg-indigo-600 text-white"
        >
          저장소로 이동
        </button>
      </div>
    );
  }

  return <div className="text-sm text-gray-400">저장소에 합류 중…</div>;
}

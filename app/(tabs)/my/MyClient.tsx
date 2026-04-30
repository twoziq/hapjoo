'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithGoogle, signInWithKakao, signOut } from '@/lib/auth';
import { ROUTES } from '@/lib/constants';
import { useSession } from '@/lib/hooks/useSession';
import { supabaseConfigured } from '@/lib/supabase/client';
import MyCollectionsClient from './MyCollectionsClient';
import PendingRequests from './PendingRequests';
import MyRequests from './MyRequests';

export default function MyClient() {
  const router = useRouter();
  const search = useSearchParams();
  const { session, loading, isAuthenticated, isAdmin } = useSession();
  const [authError] = useState<string | null>(() => search.get('auth_error'));

  useEffect(() => {
    if (authError) router.replace(ROUTES.my);
  }, [authError, router]);

  const userMeta = session?.user.user_metadata as
    | { avatar_url?: string; full_name?: string }
    | undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">마이</h1>

      {authError && (
        <div className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-xl px-3 py-2">
          로그인 실패: {authError}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">계정</span>
        </div>

        {!supabaseConfigured ? (
          <div className="px-4 py-4 text-sm text-gray-400">Supabase가 설정되지 않았습니다.</div>
        ) : loading ? (
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : session ? (
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-3">
              {userMeta?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userMeta.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full border border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {(userMeta?.full_name ?? session.user.email ?? '?')[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {userMeta?.full_name ?? '사용자'}
                </div>
                <div className="text-xs text-gray-400 truncate">{session.user.email}</div>
              </div>
              {isAdmin && (
                <span className="ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  ADMIN
                </span>
              )}
            </div>
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-2">
            <button
              onClick={() => signInWithGoogle()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 로그인
            </button>
            <button
              onClick={() => signInWithKakao()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
              style={{ backgroundColor: '#FEE500', color: '#000000CC' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.632 1.553 4.95 3.9 6.3l-.993 3.697a.3.3 0 0 0 .434.338L9.74 18.54A11.3 11.3 0 0 0 12 18.75c5.523 0 10-3.477 10-7.75S17.523 3 12 3z" />
              </svg>
              카카오로 로그인
            </button>
          </div>
        )}
      </section>

      {isAuthenticated && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">저장소</h2>
          <MyCollectionsClient />
        </section>
      )}

      {isAuthenticated && isAdmin && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            변경 요청
          </h2>
          <PendingRequests />
        </section>
      )}

      {isAuthenticated && !isAdmin && session && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            내 요청
          </h2>
          <MyRequests userId={session.user.id} />
        </section>
      )}
    </div>
  );
}

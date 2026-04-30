'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured) {
      router.replace('/songs');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorDescription = params.get('error_description');

    if (errorDescription) {
      router.replace(`/my?auth_error=${encodeURIComponent(errorDescription)}`);
      return;
    }

    const sb = getSupabase();

    const finish = () => router.replace('/songs');

    if (code) {
      sb.auth.exchangeCodeForSession(code).finally(finish);
    } else {
      finish();
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
      로그인 처리 중...
    </div>
  );
}

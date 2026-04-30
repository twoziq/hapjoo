'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@/lib/auth';
import { getSession, onAuthStateChange } from '@/lib/auth';
import { ADMIN_EMAIL } from '@/lib/constants';
import { supabaseConfigured } from '@/lib/supabase/client';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    getSession()
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    const {
      data: { subscription },
    } = onAuthStateChange((s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const email = session?.user.email ?? null;
  return {
    session,
    loading,
    isAuthenticated: !!session,
    email,
    isAdmin: email === ADMIN_EMAIL,
  };
}

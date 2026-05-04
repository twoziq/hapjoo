'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@/lib/auth';
import { getSession, onAuthStateChange } from '@/lib/auth';
import { ADMIN_EMAILS } from '@/lib/constants';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(supabaseConfigured);
  const [isManager, setIsManager] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);

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
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);

  useEffect(() => {
    if (!session || !supabaseConfigured || isAdmin) {
      setIsManager(isAdmin);
      setManagerLoading(false);
      return;
    }
    let cancelled = false;
    setManagerLoading(true);
    getSupabase()
      .rpc('is_manager')
      .then(({ data }) => {
        if (cancelled) return;
        setIsManager(!!data);
        setManagerLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user.id, isAdmin]);

  return {
    session,
    loading: loading || managerLoading,
    isAuthenticated: !!session,
    email,
    isAdmin,
    isManager,
  };
}

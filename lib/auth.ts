import type { Session, Subscription } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

export type { Session };

const oauthRedirect = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';

export async function signInWithGoogle(): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase();
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirect() },
  });
}

export async function signInWithKakao(): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase();
  await sb.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: oauthRedirect() },
  });
}

export async function signOut(): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase();
  await sb.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session;
}

const noopSubscription: Subscription = {
  id: 'noop',
  callback: () => {},
  unsubscribe: () => {},
};

export function onAuthStateChange(cb: (session: Session | null) => void): {
  data: { subscription: Subscription };
} {
  if (!supabaseConfigured) {
    return { data: { subscription: noopSubscription } };
  }
  const sb = getSupabase();
  return sb.auth.onAuthStateChange((_event, session) => cb(session));
}

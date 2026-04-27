import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const looksConfigured =
  !!url && url !== 'https://your-project.supabase.co' && !!key && key !== 'your-anon-key';

export const supabaseConfigured = looksConfigured;

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!looksConfigured) {
    throw new Error(
      'Supabase가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 .env.local 에 설정해주세요.',
    );
  }
  if (!cached) {
    cached = createClient(url as string, key as string);
  }
  return cached;
}

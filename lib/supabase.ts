import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const configured =
  !!url && url !== 'https://your-project.supabase.co' && !!key;

export const supabase = configured ? createClient(url!, key!) : null;

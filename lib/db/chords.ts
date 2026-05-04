import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';
import type { ChordEntry } from '@/components/ChordDiagram/types';

export interface DbChord {
  name: string;
  frets: string;
  fingers?: string;
  difficulty?: number;
  alternatives?: { frets: string; label?: string }[];
}

export async function fetchAllChords(): Promise<Record<string, ChordEntry>> {
  if (!supabaseConfigured) return {};
  const sb = getSupabase();
  const { data, error } = await sb.from('chords').select('*');
  if (error || !data) return {};
  return Object.fromEntries(
    data.map((r) => [r.name, { frets: r.frets, fingers: r.fingers, alternatives: r.alternatives ?? [] }]),
  );
}

export async function upsertChord(chord: DbChord): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('chords').upsert(chord, { onConflict: 'name' });
  if (error) throw new Error(error.message);
}

export async function deleteChord(name: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('chords').delete().eq('name', name);
  if (error) throw new Error(error.message);
}

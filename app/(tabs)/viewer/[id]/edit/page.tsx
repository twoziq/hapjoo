import { parseSheet } from '@/lib/chordParser';
import { supabase } from '@/lib/supabase';
import { getSongContent } from '@/lib/songLoader';
import SongEditorClient from '@/components/SongEditor';

function sheetToEditorData(parsed: ReturnType<typeof parseSheet>) {
  const { meta, sections: parsedSections } = parsed;
  const makeId = () => Math.random().toString(36).slice(2, 8);
  const emptyRow = () => ({
    id: makeId(),
    measures: Array.from({ length: 4 }, () => ({ chord: '', lyric: '' })),
  });

  type EditorSection = {
    id: string;
    name: string;
    rows: { id: string; measures: { chord: string; lyric: string }[] }[];
  };

  const editorSections: EditorSection[] = [];
  let cur: EditorSection | null = null;

  for (const sec of parsedSections) {
    if (sec.chords.length === 0) {
      cur = { id: makeId(), name: sec.measures[0] ?? sec.lyrics ?? '', rows: [] };
      editorSections.push(cur);
    } else {
      if (!cur) {
        cur = { id: makeId(), name: '', rows: [] };
        editorSections.push(cur);
      }
      cur.rows.push({
        id: makeId(),
        measures: Array.from({ length: 4 }, (_, i) => ({
          chord: sec.chords[i] ?? '',
          lyric: sec.measures[i] ?? '',
        })),
      });
    }
  }

  for (const s of editorSections) {
    if (s.rows.length === 0) s.rows.push(emptyRow());
  }

  return {
    title:    String(meta.title  ?? ''),
    artist:   String(meta.artist ?? ''),
    key:      String(meta.key    ?? 'G'),
    gender:   String(meta.gender ?? ''),
    capo:     Number(meta.capo   ?? 0),
    bpm:      Number(meta.bpm    ?? 80),
    sections: editorSections.length > 0
      ? editorSections
      : [{ id: makeId(), name: 'Verse', rows: [emptyRow()] }],
  };
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  let markdown = getSongContent(id) ?? '';

  if (supabase) {
    const { data } = await supabase.from('songs').select('content').eq('id', id).single();
    if (data?.content) markdown = data.content;
  }

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        악보를 찾을 수 없어요.
      </div>
    );
  }

  const initialData = sheetToEditorData(parseSheet(markdown));
  return <SongEditorClient initialData={initialData} editSongId={id} />;
}

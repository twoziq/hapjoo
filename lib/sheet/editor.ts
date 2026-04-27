import type { EditorData, Measure, Row, Section } from '@/types/sheet';
import { parseSheet } from './parser';

export const uid = () => Math.random().toString(36).slice(2, 8);

export const emptyMeasure = (): Measure => ({ chord: '', lyric: '' });

export const emptyRow = (): Row => ({
  id: uid(),
  measures: [emptyMeasure(), emptyMeasure(), emptyMeasure(), emptyMeasure()],
});

export const emptySection = (name = ''): Section => ({
  id: uid(),
  name,
  rows: [emptyRow()],
});

const CHORD_RX =
  /[A-G][b#]?(?:maj7?|m7?|7|9|11|13|sus[24]?|dim7?|aug|add[0-9]+)*(?:\/[A-G][b#]?)?/gi;

// Smart chord input — split on dots ("G.D.Em.Am") or whitespace ("G D Em Am") → 4 cells.
// An empty segment means a deliberately blank cell (e.g. "G..D" → ['G','','','D']).
export function parseSmartChord(raw: string): string[] | null {
  const val = raw.trim();
  if (!val) return null;
  if (val.includes('.')) {
    const parts = val.split('.').slice(0, 4);
    const result = ['', '', '', ''];
    parts.forEach((p, i) => {
      const seg = p.trim();
      if (!seg) return;
      const m = seg.match(new RegExp('^(' + CHORD_RX.source + ')', 'i'));
      if (m) result[i] = m[1].toUpperCase();
    });
    return result;
  }
  const matches = [...val.matchAll(CHORD_RX)].map((m) => m[0]);
  if (matches.length < 2) return null;
  const result = ['', '', '', ''];
  matches.slice(0, 4).forEach((c, i) => {
    result[i] = c;
  });
  return result;
}

export function generateContent(
  title: string,
  artist: string,
  key: string,
  gender: string,
  capo: number,
  bpm: number,
  sections: Section[],
): string {
  const front =
    [
      `{title: ${title}}`,
      `{artist: ${artist}}`,
      `{key: ${key}}`,
      gender ? `{gender: ${gender}}` : '',
      `{capo: ${capo}}`,
      `{bpm: ${bpm}}`,
    ]
      .filter(Boolean)
      .join('\n') + '\n';

  const body = sections
    .map((sec) => {
      const header = `[${sec.name || '구간'}]`;
      const rows = sec.rows.map((row) => {
        const parts = row.measures.map((m) => {
          if (m.chord) return `[${m.chord}]${m.lyric}`;
          return m.lyric || '';
        });
        return parts.join(' | ') + ' |';
      });
      return [header, ...rows].join('\n');
    })
    .join('\n\n');

  return front + '\n' + body + '\n';
}

export function parseCodeToData(text: string): EditorData {
  const { meta, sections: ps } = parseSheet(text);
  const editorSections: Section[] = [];
  let cur: Section | null = null;
  for (const sec of ps) {
    if (sec.chords.length === 0) {
      cur = { id: uid(), name: sec.measures[0] ?? '', rows: [] };
      editorSections.push(cur);
    } else {
      if (!cur) {
        cur = { id: uid(), name: '', rows: [] };
        editorSections.push(cur);
      }
      cur.rows.push({
        id: uid(),
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
    title: String(meta.title ?? ''),
    artist: String(meta.artist ?? ''),
    key: String(meta.key ?? 'G'),
    gender: String(meta.gender ?? ''),
    capo: Number(meta.capo ?? 0),
    bpm: Number(meta.bpm ?? 80),
    sections: editorSections.length > 0 ? editorSections : [emptySection('Verse')],
  };
}

export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w가-힣]/g, '')
      .slice(0, 40) || `song_${uid()}`
  );
}

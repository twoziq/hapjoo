export interface SheetMeta {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  [key: string]: string | number | undefined;
}

export interface SheetSection {
  chords: string[];
  lyrics: string;
  measures: string[];
}

export interface ParsedSheet {
  meta: SheetMeta;
  sections: SheetSection[];
}

// ── Chord normalization ───────────────────────────────────────────────────────
// Accepts g → G, em → Em, am7 → Am7, cmaj7 → Cmaj7, f#m → F#m
const CHORD_ROOT = /^([a-gA-G])([b#]?)((?:maj7?|m7?|7|9|11|13|sus[24]?|dim7?|aug|add[0-9]+)*)(\/.+)?$/;

export function normalizeChord(raw: string): string {
  if (!raw?.trim()) return raw ?? '';
  const t = raw.trim();
  const m = t.match(CHORD_ROOT);
  if (!m) return t;
  const [, root, acc, quality, bass] = m;
  const q = quality.toLowerCase().replace(/^min$/, 'm');
  let b = '';
  if (bass) {
    const note = bass.slice(1);
    b = '/' + note[0].toUpperCase() + note.slice(1);
  }
  return root.toUpperCase() + acc + q + b;
}

// ── Inline measure line parser ────────────────────────────────────────────────
// Format: "G lyric / D lyric / Em lyric / Bm lyric //"
// Each segment = optional chord + optional lyric text
const SEG_CHORD = /^([a-gA-G][b#]?(?:maj7?|m7?|7|9|11|13|sus[24]?|dim7?|aug|add[0-9]+)*(?:\/[a-gA-G][b#]?)?)(\s+(.*))?$/;

function parseSegment(seg: string): { chord: string; lyric: string } {
  const t = seg.trim();
  if (!t) return { chord: '', lyric: '' };
  const m = t.match(SEG_CHORD);
  if (m) return { chord: normalizeChord(m[1]), lyric: (m[3] ?? '').trim() };
  return { chord: '', lyric: t };
}

function parseMeasureLine(line: string): SheetSection {
  const padTo4 = line.includes('//');
  const clean = line.replace(/\/\//g, '').trim();
  const segs = clean.split('/');
  const chords: string[] = [];
  const measures: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].trim() && i === segs.length - 1) continue; // trailing empty
    const { chord, lyric } = parseSegment(segs[i]);
    chords.push(chord);
    measures.push(lyric);
  }

  if (padTo4) {
    while (chords.length < 4) { chords.push(''); measures.push(''); }
  }

  return { chords, lyrics: measures.join(' | '), measures };
}

// ── Frontmatter parser ────────────────────────────────────────────────────────
function parseFrontmatter(text: string): { meta: SheetMeta; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const meta: SheetMeta = {};
  match[1].split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (key) meta[key.trim()] = rest.join(':').trim();
  });
  if (meta.capo) meta.capo = parseInt(meta.capo as unknown as string, 10) || 0;
  if (meta.bpm)  meta.bpm  = parseInt(meta.bpm  as unknown as string, 10) || 0;

  return { meta, body: match[2].trim() };
}

// ── Body parser ───────────────────────────────────────────────────────────────
// Supports both formats:
//   Old: plain label lines, [G][D]... chord lines, lyric | lyric | lines
//   New: [Section Name] headers, G lyric / D lyric // measure lines, @Ref references
function parseBody(body: string): SheetSection[] {
  const lines = body.split('\n');
  const result: SheetSection[] = [];
  // Named sections (for @Ref): tracks SheetSections that are content rows
  const named = new Map<string, SheetSection[]>();
  let activeName: string | null = null;
  let activeRows: SheetSection[] = [];
  let pendingChords: string[] = []; // old format: chord line awaiting lyric line

  function flushNamed() {
    // Only save if there are actual content rows — prevents empty repetitions
    // from overwriting a previously defined section (e.g. @Chorus under [Chorus])
    if (activeName && activeRows.length > 0) {
      named.set(activeName, [...activeRows]);
    }
  }

  function addRow(row: SheetSection) {
    result.push(row);
    activeRows.push(row);
  }

  function startSection(name: string) {
    flushNamed();
    activeName = name.trim().toUpperCase();
    activeRows = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { pendingChords = []; continue; }

    // ── @Reference (new format) ──────────────────────────────────────────────
    if (line.startsWith('@')) {
      pendingChords = [];
      flushNamed();
      const refKey = line.slice(1).trim().toUpperCase();
      const refRows = named.get(refKey) ?? [];
      for (const row of refRows) {
        result.push({ ...row, chords: [...row.chords], measures: [...row.measures] });
      }
      continue;
    }

    // ── [Single bracket content] ─────────────────────────────────────────────
    const singleBracket = line.match(/^\[([^\[\]]+)\]$/);
    if (singleBracket) {
      const content = singleBracket[1].trim();
      // Is it a section name? (contains space, or first char is uppercase non-chord)
      const looksLikeChord = CHORD_ROOT.test(content);
      if (!looksLikeChord) {
        // New format section header: [Chorus], [Verse 1], etc.
        pendingChords = [];
        startSection(content);
        result.push({ chords: [], lyrics: content, measures: [content] });
        // (label itself not added to activeRows so @Ref copies only content rows)
        continue;
      } else {
        // Old-style single chord: [G] — treat as start of old chord line
        pendingChords = [normalizeChord(content)];
        continue;
      }
    }

    // ── Old format: [G][D][Em]... chord line ─────────────────────────────────
    if (/^\[[a-gA-G]/.test(line)) {
      pendingChords = [];
      const rx = /\[([^\]]+)\]/g;
      let m;
      while ((m = rx.exec(line)) !== null) {
        pendingChords.push(normalizeChord(m[1]));
      }
      continue;
    }

    // ── New format: measure line containing / ────────────────────────────────
    if (line.includes('/')) {
      pendingChords = [];
      addRow(parseMeasureLine(line));
      continue;
    }

    // ── Other line: lyric (old format) or plain label ─────────────────────────
    if (pendingChords.length > 0) {
      // Old format lyric line following a chord line
      const measures = line.split('|').map((m) => m.trim());
      addRow({ chords: pendingChords, lyrics: line, measures });
      pendingChords = [];
    } else {
      // Plain label (old format section name like "Chorus", "Verse")
      startSection(line);
      result.push({ chords: [], lyrics: line, measures: [line] });
    }
  }

  flushNamed();
  return result;
}

// ── Entry point ───────────────────────────────────────────────────────────────
export function parseSheet(markdown: string): ParsedSheet {
  const { meta, body } = parseFrontmatter(markdown);
  const sections = parseBody(body);
  return { meta, sections };
}

export function extractChords(sections: SheetSection[]): string[] {
  const seen = new Set<string>();
  sections.forEach(({ chords }) => chords.forEach((c) => { if (c) seen.add(c); }));
  return [...seen];
}

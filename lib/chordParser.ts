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
  restFrom?: number; // index where // padding begins (rest cells)
}

export interface ParsedSheet {
  meta: SheetMeta;
  sections: SheetSection[];
}

// ── Chord normalization ───────────────────────────────────────────────────────
// Accepts: g→G, em→Em, FM7→Fmaj7, A(add9)→Aadd9, Gm7(b5)→Gm7b5, Eb6→Eb6
const CHORD_ROOT = /^([a-gA-G])([b#]?)((?:maj7?|M7?|m7?|7|9|11|13|6|sus[24]?|dim7?|aug|add[0-9]+|\(add[0-9]+\)|\([b#][0-9]+\))*)(\/.+)?$/;

// Uppercase root, lowercase quality — lets CHORD_ROOT match AADD9, BSUS4, etc.
function canonicalize(s: string): string {
  return s ? s[0] + s.slice(1).toLowerCase() : s ?? '';
}

export function normalizeChord(raw: string): string {
  if (!raw?.trim()) return raw ?? '';
  const t = raw.trim();
  const m = canonicalize(t).match(CHORD_ROOT);
  if (!m) return t;
  const [, root, acc, quality, bass] = m;
  const q = quality
    .replace(/M7/g, 'maj7')
    .replace(/M(?![a-zA-Z])/g, 'maj')
    .toLowerCase()
    .replace(/^min$/, 'm')
    .replace(/\(add([0-9]+)\)/g, 'add$1')
    .replace(/\(([b#][0-9]+)\)/g, '$1');
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
const SEG_CHORD = /^([a-gA-G][b#]?(?:maj7?|M7?|m7?|7|9|11|13|6|sus[24]?|dim7?|aug|add[0-9]+|\(add[0-9]+\)|\([b#][0-9]+\))*(?:\/[a-gA-G][b#]?)?)(\s+(.*))?$/;

function parseSegment(seg: string): { chord: string; lyric: string } {
  const t = seg.trim();
  if (!t) return { chord: '', lyric: '' };

  // ChordPro bracket format: [G.D.]lyric or [Am]lyric
  if (t.startsWith('[')) {
    const bm = t.match(/^\[([^\]]*)\](.*)/);
    if (bm) {
      const raw = bm[1].trim().replace(/\.+$/, ''); // strip trailing dots ([C.] [C..] → C)
      const lyric = bm[2].trim();
      if (raw.includes('.')) {
        const parts = raw.split('.');
        if (parts.some(p => p) && parts.every(p => !p || CHORD_ROOT.test(canonicalize(p)))) {
          return { chord: parts.map(p => p ? normalizeChord(p) : '').join('.'), lyric };
        }
      } else if (CHORD_ROOT.test(canonicalize(raw))) {
        return { chord: normalizeChord(raw), lyric };
      }
    }
    return { chord: '', lyric: t };
  }

  // Slash format multi-chord: G.D lyric
  const spaceIdx = t.indexOf(' ');
  const firstWord = spaceIdx === -1 ? t : t.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : t.slice(spaceIdx + 1).trim();
  if (firstWord.includes('.')) {
    const parts = firstWord.split('.');
    if (parts.some(p => p !== '') && parts.every(p => p === '' || CHORD_ROOT.test(canonicalize(p)))) {
      return { chord: parts.map(p => p ? normalizeChord(p) : '').join('.'), lyric: rest };
    }
  }

  const m = t.match(SEG_CHORD);
  if (m) return { chord: normalizeChord(m[1]), lyric: (m[3] ?? '').trim() };
  // Fallback: try canonicalizing chord token for uppercase quality (e.g. AADD9)
  const spIdx = t.search(/\s/);
  const chordToken = spIdx > 0 ? t.slice(0, spIdx) : t;
  if (CHORD_ROOT.test(canonicalize(chordToken))) {
    return { chord: normalizeChord(chordToken), lyric: spIdx > 0 ? t.slice(spIdx).trim() : '' };
  }
  return { chord: '', lyric: t };
}

function parseMeasureLine(line: string): SheetSection {
  const padTo4 = line.includes('||');
  const clean = line.replace(/\|\|/g, '').trim();
  const segs = clean.split('|');
  const chords: string[] = [];
  const measures: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].trim() && i === segs.length - 1) continue; // trailing empty
    const { chord, lyric } = parseSegment(segs[i]);
    chords.push(chord);
    measures.push(lyric);
  }

  const restFrom = padTo4 && chords.length < 4 ? chords.length : undefined;
  if (padTo4) {
    while (chords.length < 4) { chords.push(''); measures.push(''); }
  }

  return { chords, lyrics: measures.join(' | '), measures, restFrom };
}

// ── Frontmatter parser ────────────────────────────────────────────────────────
function parseFrontmatter(text: string): { meta: SheetMeta; body: string } {
  // ChordPro-style {key: value} metadata
  if (text.trimStart().startsWith('{')) {
    const lines = text.split('\n');
    const metaRe = /^\{(\w+):\s*(.+)\}$/;
    const meta: SheetMeta = {};
    let i = 0;
    while (i < lines.length && metaRe.test(lines[i].trim())) {
      const m = lines[i].trim().match(metaRe)!;
      meta[m[1]] = m[2].trim();
      i++;
    }
    while (i < lines.length && !lines[i].trim()) i++; // skip blank separator
    if (meta.capo) meta.capo = parseInt(meta.capo as unknown as string, 10) || 0;
    if (meta.bpm)  meta.bpm  = parseInt(meta.bpm  as unknown as string, 10) || 0;
    return { meta, body: lines.slice(i).join('\n').trim() };
  }

  // --- frontmatter fallback
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

    // ── ChordPro directive: {comment: text} → section label, others → skip ───
    if (line.startsWith('{')) {
      const dm = line.match(/^\{(?:comment|c):\s*(.+)\}$/i);
      if (dm) {
        pendingChords = [];
        const label = dm[1].trim();
        startSection(label);
        result.push({ chords: [], lyrics: label, measures: [label] });
      }
      continue;
    }

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

    // ── Measure line containing / (new bracket format or old slash format) ──────
    if (line.includes('|')) {
      pendingChords = [];
      addRow(parseMeasureLine(line));
      continue;
    }

    // ── [Single bracket content] ─────────────────────────────────────────────
    const singleBracket = line.match(/^\[([^\[\]]+)\]$/);
    if (singleBracket) {
      const content = singleBracket[1].trim();
      const looksLikeChord = CHORD_ROOT.test(canonicalize(content));
      if (!looksLikeChord) {
        pendingChords = [];
        startSection(content);
        result.push({ chords: [], lyrics: content, measures: [content] });
        continue;
      } else {
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
  sections.forEach(({ chords }) => chords.forEach((c) => {
    if (c) c.split('.').filter(Boolean).forEach(p => seen.add(p));
  }));
  return [...seen];
}

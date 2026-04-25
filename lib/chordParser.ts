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

// Parse frontmatter from sheet markdown
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

// Parse body into sections
function parseBody(body: string): SheetSection[] {
  const lines = body.split('\n');
  const sections: SheetSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith('[')) {
      const chords: string[] = [];
      const chordRegex = /\[([^\]]+)\]/g;
      let m;
      while ((m = chordRegex.exec(line)) !== null) {
        chords.push(m[1]);
      }

      let lyrics = '';
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next !== undefined && !next.trim().startsWith('[')) {
          lyrics = next;
          i++;
        }
      }

      const measures = lyrics.split('|').map((m) => m.trim());
      sections.push({ chords, lyrics, measures });
      i++;
    } else {
      sections.push({ chords: [], lyrics: line, measures: [line] });
      i++;
    }
  }

  return sections;
}

// Entry: parse full sheet markdown → { meta, sections }
export function parseSheet(markdown: string): ParsedSheet {
  const { meta, body } = parseFrontmatter(markdown);
  const sections = parseBody(body);
  return { meta, sections };
}

// Extract only chord names from a parsed sheet
export function extractChords(sections: SheetSection[]): string[] {
  const seen = new Set<string>();
  sections.forEach(({ chords }) => chords.forEach((c) => seen.add(c)));
  return [...seen];
}

import { describe, expect, it } from 'vitest';
import { extractChords, parseSheet } from '@/lib/sheet/parser';

describe('parseSheet', () => {
  it('extracts ChordPro frontmatter', () => {
    const md = `{title: My Song}\n{artist: Me}\n{key: G}\n{capo: 2}\n{bpm: 120}\n\n[Verse]\n[G.D.]hello | [Em.C.]world |`;
    const { meta } = parseSheet(md);
    expect(meta.title).toBe('My Song');
    expect(meta.artist).toBe('Me');
    expect(meta.key).toBe('G');
    expect(meta.capo).toBe(2);
    expect(meta.bpm).toBe(120);
  });

  it('parses sections with measure rows', () => {
    const md = `{title: t}\n\n[Verse]\n[G]hello | [D]world |`;
    const { sections } = parseSheet(md);
    // First section is the [Verse] label, then a measure row
    expect(sections.length).toBeGreaterThanOrEqual(2);
    const measureRow = sections.find((s) => s.chords.length > 0);
    expect(measureRow?.chords).toEqual(['G', 'D']);
  });

  it('parses dotted multi-chord cells', () => {
    const md = `[Chorus]\n[G.D.Em.Am]first |`;
    const { sections } = parseSheet(md);
    const row = sections.find((s) => s.chords.length > 0);
    expect(row?.chords[0]).toBe('G.D.Em.Am');
  });

  it('pads to 4 measures when terminating with ||', () => {
    const md = `[Bridge]\n[C.D.] ||`;
    const { sections } = parseSheet(md);
    const row = sections.find((s) => s.chords.length > 0);
    expect(row?.chords).toHaveLength(4);
    expect(row?.restFrom).toBe(1);
  });

  it('falls back to YAML frontmatter', () => {
    const md = `---\ntitle: Old\nartist: Foo\nkey: C\n---\n[V]\n[C]a |`;
    const { meta } = parseSheet(md);
    expect(meta.title).toBe('Old');
    expect(meta.key).toBe('C');
  });
});

describe('extractChords', () => {
  it('returns unique chord names', () => {
    const md = `[V]\n[G.D.] | [G.Em.] |`;
    const { sections } = parseSheet(md);
    const set = new Set(extractChords(sections));
    expect(set.has('G')).toBe(true);
    expect(set.has('D')).toBe(true);
    expect(set.has('Em')).toBe(true);
  });
});

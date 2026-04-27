import { describe, expect, it } from 'vitest';
import { generateContent, parseCodeToData, parseSmartChord, slugify } from '@/lib/sheet/editor';

describe('parseSmartChord', () => {
  it('returns null for empty input', () => {
    expect(parseSmartChord('')).toBeNull();
    expect(parseSmartChord('   ')).toBeNull();
  });

  it('splits dotted chord input into 4 cells', () => {
    expect(parseSmartChord('G.D.Em.Am')).toEqual(['G', 'D', 'EM', 'AM']);
  });

  it('parses space-separated chords', () => {
    expect(parseSmartChord('G D Em Am')).toEqual(['G', 'D', 'Em', 'Am']);
  });

  it('returns null for a single chord (cannot infer split)', () => {
    expect(parseSmartChord('G')).toBeNull();
  });

  it('handles partial dotted input (3 chords)', () => {
    expect(parseSmartChord('G.D.Em')).toEqual(['G', 'D', 'EM', '']);
  });
});

describe('generateContent → parseCodeToData', () => {
  it('round-trips meta values', () => {
    const sections = [
      {
        id: 's1',
        name: 'Verse',
        rows: [
          {
            id: 'r1',
            measures: [
              { chord: 'G', lyric: 'hello' },
              { chord: 'D', lyric: 'world' },
              { chord: '', lyric: '' },
              { chord: '', lyric: '' },
            ],
          },
        ],
      },
    ];
    const text = generateContent('Title', 'Artist', 'G', '남', 0, 100, sections);
    const data = parseCodeToData(text);
    expect(data.title).toBe('Title');
    expect(data.artist).toBe('Artist');
    expect(data.key).toBe('G');
    expect(data.gender).toBe('남');
    expect(data.bpm).toBe(100);
    expect(data.sections.length).toBeGreaterThan(0);
  });
});

describe('slugify', () => {
  it('replaces spaces with underscores', () => {
    expect(slugify('Hello World')).toBe('hello_world');
  });

  it('keeps Korean characters', () => {
    expect(slugify('너에게 난')).toBe('너에게_난');
  });

  it('strips special characters', () => {
    expect(slugify('Hello!@#World')).toBe('helloworld');
  });

  it('falls back to song_<uid> when result is empty', () => {
    const r = slugify('!!!@@@');
    expect(r.startsWith('song_')).toBe(true);
  });
});

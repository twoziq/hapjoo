import { describe, expect, it } from 'vitest';
import { FEMALE_KEY_OFFSET, parseChordName, transposeChord, transposeNote } from '@/lib/transpose';

describe('transposeNote', () => {
  it('returns same note when semitones=0', () => {
    expect(transposeNote('C', 0)).toBe('C');
    expect(transposeNote('A', 0)).toBe('A');
  });

  it('uses sharps when going up, flats when going down', () => {
    expect(transposeNote('C', 1)).toBe('C#');
    expect(transposeNote('C', -1)).toBe('B');
    expect(transposeNote('D', 1)).toBe('D#');
    expect(transposeNote('D', -1)).toBe('Db');
  });

  it('wraps around the octave', () => {
    expect(transposeNote('B', 1)).toBe('C');
    expect(transposeNote('C', -1)).toBe('B');
    expect(transposeNote('C', 12)).toBe('C');
  });

  it('returns input unchanged for unknown notes', () => {
    expect(transposeNote('H', 1)).toBe('H');
    expect(transposeNote('xyz', 5)).toBe('xyz');
  });

  it('handles flat input', () => {
    expect(transposeNote('Bb', 1)).toBe('B');
    expect(transposeNote('Eb', 1)).toBe('E');
  });
});

describe('parseChordName', () => {
  it('splits root and type', () => {
    expect(parseChordName('Cmaj7')).toEqual({ root: 'C', type: 'maj7' });
    expect(parseChordName('Am')).toEqual({ root: 'A', type: 'm' });
    expect(parseChordName('G')).toEqual({ root: 'G', type: '' });
  });

  it('handles accidentals', () => {
    expect(parseChordName('C#m')).toEqual({ root: 'C#', type: 'm' });
    expect(parseChordName('Bbmaj7')).toEqual({ root: 'Bb', type: 'maj7' });
  });
});

describe('transposeChord', () => {
  it('passes through when semitones=0', () => {
    expect(transposeChord('Cmaj7', 0)).toBe('Cmaj7');
  });

  it('shifts the root, keeps the type', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('Am', 2)).toBe('Bm');
    expect(transposeChord('Cmaj7', 2)).toBe('Dmaj7');
    expect(transposeChord('Bbm7', 1)).toBe('Bm7');
  });

  it('handles dotted multi-chord cells', () => {
    expect(transposeChord('C.G.Am.F', 2)).toBe('D.A.Bm.G');
    expect(transposeChord('C..F', 2)).toBe('D..G');
  });
});

describe('FEMALE_KEY_OFFSET', () => {
  it('is 5 semitones (a perfect fourth up)', () => {
    expect(FEMALE_KEY_OFFSET).toBe(5);
  });
});

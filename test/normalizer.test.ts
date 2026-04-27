import { describe, expect, it } from 'vitest';
import { isChordToken, normalizeChord } from '@/lib/sheet/normalizer';

describe('normalizeChord', () => {
  it('uppercases lowercase root', () => {
    expect(normalizeChord('g')).toBe('G');
    expect(normalizeChord('em')).toBe('Em');
  });

  it('preserves explicit maj7 spelling', () => {
    expect(normalizeChord('Fmaj7')).toBe('Fmaj7');
    expect(normalizeChord('Cmaj7')).toBe('Cmaj7');
    expect(normalizeChord('FMAJ7')).toBe('Fmaj7');
  });

  it('strips parentheses around add/alt', () => {
    expect(normalizeChord('A(add9)')).toBe('Aadd9');
    expect(normalizeChord('Gm7(b5)')).toBe('Gm7b5');
  });

  it('preserves accidentals', () => {
    expect(normalizeChord('Eb6')).toBe('Eb6');
    expect(normalizeChord('F#m7')).toBe('F#m7');
  });

  it('handles slash bass notes', () => {
    expect(normalizeChord('C/g')).toBe('C/G');
    expect(normalizeChord('G/b')).toBe('G/B');
  });

  it('returns trimmed input for non-chord strings', () => {
    expect(normalizeChord('hello')).toBe('hello');
    expect(normalizeChord('')).toBe('');
  });
});

describe('isChordToken', () => {
  it('accepts standard chord tokens', () => {
    expect(isChordToken('G')).toBe(true);
    expect(isChordToken('Cmaj7')).toBe(true);
    expect(isChordToken('F#m7')).toBe(true);
    expect(isChordToken('Bb')).toBe(true);
  });

  it('rejects non-chord strings', () => {
    expect(isChordToken('Hello')).toBe(false);
    expect(isChordToken('123')).toBe(false);
  });
});

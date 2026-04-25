const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const CHROMATIC_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type ChordType = 'm' | '7' | 'm7' | 'maj7' | 'sus4' | 'sus2' | 'dim' | 'aug' | 'add9' | '';

function getNoteIndex(note: string): number {
  let idx = CHROMATIC_SHARP.indexOf(note as any);
  if (idx !== -1) return idx;
  return CHROMATIC_FLAT.indexOf(note as any);
}

export function parseChordName(chordName: string) {
  const match = chordName.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return { root: chordName, type: '' as ChordType };
  return { 
    root: match[1], 
    type: match[2] as ChordType 
  };
}

export function transposeNote(note: string, semitones: number): string {
  const idx = getNoteIndex(note);
  if (idx === -1) return note;
  
  const newIdx = (idx + semitones + 12) % 12;
  // 올라가면(#), 내려가면(b)
  return semitones >= 0 ? CHROMATIC_SHARP[newIdx] : CHROMATIC_FLAT[newIdx];
}

export function transposeChord(chordName: string, semitones: number): string {
  if (semitones === 0) return chordName;
  const { root, type } = parseChordName(chordName);
  const newRoot = transposeNote(root, semitones);
  return newRoot + type;
}

export function getFemaleKeyOffset(originalKey: string): number {
  // 보통 여자키는 +5 또는 -7
  return 5;
}

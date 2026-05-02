// Accepts: g→G, em→Em, FM7→Fmaj7, A(add9)→Aadd9, Gm7(b5)→Gm7b5, Eb6→Eb6
export const CHORD_ROOT =
  /^([a-gA-G])([b#]?)((?:maj7?|M7?|m7?|7|9|11|13|6|sus[24]?|dim7?|aug|add[0-9]+|[b#][0-9]+|\(add[0-9]+\)|\([b#][0-9]+\))*)(\/.+)?$/;

// Uppercase root, lowercase quality — lets CHORD_ROOT match AADD9, BSUS4, etc.
export function canonicalize(s: string): string {
  if (!s) return s ?? '';
  return s[0] + s.slice(1).toLowerCase();
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

export function isChordToken(s: string): boolean {
  return CHORD_ROOT.test(canonicalize(s));
}

export const STORAGE_KEYS = {
  lastSong: 'hapjoo_lastSong',
  semitones: (id: string) => `hapjoo_semi_${id}`,
  notes: (id: string) => `hapjoo_notes_${id}`,
} as const;

export const ROUTES = {
  songs: '/songs',
  songsNew: '/songs/new',
  chords: '/chords',
  tuner: '/tuner',
  settings: '/settings',
  viewer: (id: string) => `/viewer/${id}`,
  viewerEdit: (id: string) => `/viewer/${id}/edit`,
} as const;

export const MUSIC_KEYS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;
export type MusicKey = (typeof MUSIC_KEYS)[number];

export const GENDERS = ['남', '여'] as const;
export type Gender = (typeof GENDERS)[number];

export const FRETBOARD = {
  strings: 6,
  fretsShown: 5,
} as const;
